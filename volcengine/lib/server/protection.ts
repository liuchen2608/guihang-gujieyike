import { tosStore } from "./tos-store";
import { reserveModelCall } from "./storage";
import { createProtection, digest, modelEnabled, type SecurityStore } from "./protection-core";

export const securityStore: SecurityStore = {
  get: key => tosStore.get("security/" + key + ".json"),
  put: (key, value, etag) => tosStore.put("security/" + key + ".json", value, etag),
};
export const protection = createProtection(securityStore);
export const aiEnabled = () => modelEnabled(process.env.AI_ENABLED);
export async function reserveAi(owner: string) {
  await protection.reservePersonalAi(owner);
  // Retain the existing persistent global quota, including already-used calls.
  if (!await reserveModelCall()) throw new Error("MODEL_QUOTA_REACHED");
}
export async function protectWrite(request: Request, owner: string, action: "create" | "feedback" | "turn") {
  const limits = { create: [3, 600_000], feedback: [3, 86400_000], turn: [30, 60_000] } as const;
  const [max, period] = limits[action];
  await protection.consume(action + ":owner:" + owner, max, period);
  // Set ONLY after gateway overwrite + direct-origin blocking is verified.
  // Without a trusted header, use a shared conservative bucket, not spoofable XFF.
  const header = process.env.TRUSTED_CLIENT_IP_HEADER?.trim();
  const ip = (header ? request.headers.get(header) : null) || "shared-unknown";
  await protection.consume(action + ":network:" + await digest(ip), action === "turn" ? 120 : 30, action === "feedback" ? 86400_000 : period);
}
