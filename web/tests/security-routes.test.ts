import test from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { registerHooks } from "node:module";
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import { resolve } from "node:path";
import ts from "typescript";

// Exercise real routes/auth/storage/AI adapter against SQLite and a fake model.
// No server sockets, credentials or production endpoints are used.
test("HTTP security regression: real D1 routes, invitation ownership, quotas and AI guard", async t => {
  const root = fileURLToPath(new URL("../", import.meta.url));
  const db = new DatabaseSync(":memory:");
  const env: Record<string, unknown> = { AI_ENABLED: "true", DEEPSEEK_API_KEY: "test-only", MODEL_DAILY_CALL_LIMIT: "50", MODEL_MONTHLY_CALL_LIMIT: "500" };
  function prepare(sql: string, values: Array<string | number | null> = []) {
    const execute = () => {
      const statement = db.prepare(sql);
      if (statement.columns().length) return { results: statement.all(...values), meta: { changes: 0 } };
      const result = statement.run(...values); return { results: [], meta: { changes: Number(result.changes) } };
    };
    return { bind: (...args: Array<string | number | null>) => prepare(sql, args), run: async () => execute(), all: async () => execute(), first: async () => execute().results[0] ?? null, execute };
  }
  env.DB = { prepare, async batch(statements: Array<ReturnType<typeof prepare>>) {
    db.exec("BEGIN"); try { const result = statements.map(s => s.execute()); db.exec("COMMIT"); return result; } catch (error) { db.exec("ROLLBACK"); throw error; }
  } };
  Object.assign(globalThis, { __guihangSecurityTestEnv: env });
  const hooks = registerHooks({
    resolve(specifier, context, next) {
      if (specifier === "cloudflare:workers") return { url: "mock:cloudflare", shortCircuit: true };
      if (specifier === "next/server") return { url: "mock:next", shortCircuit: true };
      let path: string | null = null;
      if (specifier.startsWith("@/")) path = resolve(root, specifier.slice(2));
      else if (specifier.startsWith(".") && context.parentURL?.startsWith(pathToFileURL(root).href)) path = fileURLToPath(new URL(specifier, context.parentURL));
      if (path) {
        const raw = path.endsWith("?raw"); if (raw) path = path.slice(0, -4);
        if (!existsSync(path) && existsSync(path + ".ts")) path += ".ts";
        if (existsSync(path)) return { url: pathToFileURL(path).href + (raw ? "?raw" : ""), shortCircuit: true };
      }
      return next(specifier, context);
    },
    load(url, context, next) {
      if (url === "mock:cloudflare") return { format: "module", source: "export const env = globalThis.__guihangSecurityTestEnv;", shortCircuit: true };
      if (url === "mock:next") return { format: "module", source: `export class NextResponse extends Response {
        constructor(body, init) { super(body, init); this.cookies = { set: (name,value) => this.headers.append('set-cookie', name+'='+value), delete: name => this.headers.append('set-cookie', name+'=; Max-Age=0') }; }
        static json(value, init) { return new NextResponse(JSON.stringify(value), init); }
        static redirect(url) { return new NextResponse(null, {status:307,headers:{location:String(url)}}); }
      }`, shortCircuit: true };
      if (url.startsWith(pathToFileURL(root).href) && url.endsWith("?raw")) return { format: "module", source: "export default " + JSON.stringify(readFileSync(fileURLToPath(new URL(url)), "utf8")), shortCircuit: true };
      if (url.startsWith(pathToFileURL(root).href) && url.endsWith(".ts") && !url.includes("node_modules")) return { format: "module", source: ts.transpileModule(readFileSync(fileURLToPath(url), "utf8"), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText, shortCircuit: true };
      return next(url, context);
    },
  });
  const previousFetch = globalThis.fetch; let calls = 0;
  globalThis.fetch = async () => { calls++; await new Promise(r => setTimeout(r, 15)); return Response.json({ choices: [{ message: { content: "先观察周围，保存能源。" } }] }); };
  try {
    const storage = await import("../lib/server/storage.ts");
    const auth = await import("../lib/server/auth.ts");
    const invites = await import("../lib/server/invite-access.ts");
    const saves = await import("../app/api/saves/route.ts");
    const turns = await import("../app/api/saves/[saveId]/turns/route.ts");
    const feedback = await import("../app/api/feedback/route.ts");
    await storage.ensureSchema();
    const code = "GH" + "A".repeat(24), hash = await auth.hashToken(code);
    env.INVITE_CODES_JSON = JSON.stringify([{hash,maxUses:100,expiresAt:"2030-01-01T00:00:00Z"}]);
    const token = "a".repeat(64), otherToken = "b".repeat(64);
    for (const [value, owner] of [[token,"owner-a"],[otherToken,"owner-b"]]) db.prepare("INSERT INTO invite_grants (token_hash,invite_hash,owner_id,account_id,created_at,expires_at) VALUES (?,?,?,NULL,?,?)").run(await auth.hashToken(value),hash,owner,"2026-01-01","2030-01-01");
    const request = (path: string, body: unknown, cookie = token, origin = "https://game.example") => new Request("https://game.example" + path, {method:"POST",headers:{origin,"content-type":"application/json",cookie:"guihang_invite=" + cookie},body:JSON.stringify(body)});
    const context = (id: string) => ({params:Promise.resolve({saveId:id})});
    await t.test("forged owner IDs and GitHub IDs cannot replace a verified invite cookie", async () => {
      const denied = await saves.POST(request("/api/saves",{playerId:"owner-a",codename:"forged"},"c".repeat(64)));
      assert.equal(denied.status,403);
      const save = await storage.createSave("owner-a","pilot");
      const other = await turns.POST(request("/api/saves/x/turns",{playerId:"owner-a",mode:"ask",text:"你好",version:save.state.version},otherToken),context(save.state.saveId));
      assert.equal(other.status,404); assert.equal(calls,0);
    });
    await t.test("same-origin/body checks reject invalid requests before game/model work", async () => {
      assert.equal((await saves.POST(request("/api/saves",{},token,"https://outside.example"))).status,403);
      assert.equal((await saves.POST(request("/api/saves",{codename:"x".repeat(5000)}))).status,413);
      assert.equal(calls,0);
    });
    await t.test("parallel turns cause one model call and one durable settlement", async () => {
      const save = await storage.createSave("owner-a","pilot");
      const body = {mode:"ask",text:"这里发生了什么？",version:save.state.version,confirmed:false};
      const results = await Promise.all(Array.from({length:6},()=>turns.POST(request("/api/saves/x/turns",body),context(save.state.saveId))));
      assert.equal(results.filter(r=>r.status===200).length,1);
      assert.ok(results.every(r=>[200,409].includes(r.status))); assert.equal(calls,1);
      assert.equal((await storage.readSave(save.state.saveId,"owner-a"))?.state.version,save.state.version+1);
      assert.equal((await turns.POST(request("/api/saves/x/turns",body),context(save.state.saveId))).status,409);
      assert.equal(calls,1);
    });
    await t.test("AI emergency switch keeps local narration working with zero additional calls", async () => {
      env.AI_ENABLED="false";
      const save=await storage.createSave("owner-b","pilot");
      const response=await turns.POST(request("/api/saves/x/turns",{mode:"ask",text:"你好",version:save.state.version},otherToken),context(save.state.saveId));
      const payload = await response.json() as { ai: { provider: string } };
      assert.equal(response.status,200); assert.equal(payload.ai.provider,"local"); assert.equal(calls,1);
      env.AI_ENABLED="true";
    });
    await t.test("exhausted global budget blocks the external model, not local gameplay", async () => {
      env.MODEL_DAILY_CALL_LIMIT="0";
      const save=await storage.createSave("owner-b","pilot");
      const response=await turns.POST(request("/api/saves/x/turns",{mode:"ask",text:"你好",version:save.state.version},otherToken),context(save.state.saveId));
      assert.equal(response.status,200); assert.equal(calls,1);
      env.MODEL_DAILY_CALL_LIMIT="50";
    });
    await t.test("create and feedback quotas are enforced by the real API with Retry-After", async () => {
      for (let i=0;i<3;i++) assert.equal((await saves.POST(request("/api/saves",{codename:"pilot"}))).status,201);
      const denied=await saves.POST(request("/api/saves",{codename:"pilot"})); assert.equal(denied.status,429); assert.ok(Number(denied.headers.get("retry-after"))>0);
      const body={understoodGoal:true,trustedGuihang:true,continueChapterTwo:true,rating:5,detail:"test"};
      for (let i=0;i<3;i++) assert.equal((await feedback.POST(request("/api/feedback",body))).status,200);
      assert.equal((await feedback.POST(request("/api/feedback",body))).status,429);
    });
    await t.test("redeeming a valid code does not claim another player's legacy UUID", async () => {
      const legacy="11111111-1111-4111-8111-111111111111";
      const old=await storage.createSave(legacy,"old");
      const result=await invites.redeemInvitation(request("/api/access/redeem",{},"d".repeat(64)),{code,legacyPlayerId:legacy});
      assert.notEqual(result.access.grant.owner_id,legacy);
      assert.equal(await storage.readSave(old.state.saveId,result.access.grant.owner_id),null);
      assert.ok(await storage.readSave(old.state.saveId,legacy));
    });
  } finally { globalThis.fetch=previousFetch; hooks.deregister(); db.close(); Reflect.deleteProperty(globalThis,"__guihangSecurityTestEnv"); }
});
