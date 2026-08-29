import { createProtection, digest, type SecurityStore } from "./protection-core.ts";

type Guest = { owner: string; expires: number; claimedBy: string | null };
export function createGuestSessions(store: SecurityStore, clock = Date.now) {
  const protection = createProtection(store, clock);
  const keyFor = async (token: string) => "guest/" + await digest(token);
  const valid = (token: string | null): token is string => Boolean(token && /^[a-f0-9]{64}$/.test(token));
  async function read(token: string | null) {
    if (!valid(token)) return null;
    const guest = (await store.get<Guest>(await keyFor(token)))?.value;
    return guest && guest.expires > clock() && !guest.claimedBy ? guest : null;
  }
  async function create() {
    const token = (crypto.randomUUID() + crypto.randomUUID()).replaceAll("-", "");
    const guest: Guest = { owner: "guest:" + crypto.randomUUID(), expires: clock() + 30 * 86400_000, claimedBy: null };
    if (!await store.put(await keyFor(token), guest, null)) throw new Error("GUEST_SESSION_COLLISION");
    return { token, guest };
  }
  async function claim(token: string | null, expectedHash: string | null, userId: string) {
    if (!valid(token) || !expectedHash || await digest(token) !== expectedHash) return null;
    return protection.change<Guest, string | null>(await keyFor(token), () => ({ owner: "", expires: 0, claimedBy: null }), guest => {
      if (!guest.owner || guest.expires <= clock() || (guest.claimedBy && guest.claimedBy !== userId)) return { result: null };
      return { next: { ...guest, claimedBy: userId }, result: guest.owner };
    });
  }
  return { read, create, claim };
}
