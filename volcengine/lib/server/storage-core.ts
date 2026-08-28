import { createHash, randomUUID } from 'node:crypto';
import { newGameState, initialMessages, normalizeGameState, type GameMessage, type GameState, type SaveView } from '../game.ts';
import { sanitizeNpcReply } from './npc-reply.ts';
import { mutate, type JsonStore } from './json-store.ts';

export type AuthUser = { id: string; githubId: string; login: string; name: string | null; avatarUrl: string | null };
type Player = { schema: 1; saves: Record<string, SaveView>; guests: string[]; adoptedBy?: string; feedback: Record<string, unknown> };
const emptyPlayer = (): Player => ({ schema: 1, saves: {}, guests: [], feedback: {} });
const digest = (id: string) => createHash('sha256').update(id).digest('hex');
const playerKey = (id: string) => `players/${digest(id)}.json`;
const cleanView = (save: SaveView): SaveView => ({
  ...save, state: normalizeGameState(save.state),
  messages: save.messages.map(message => ({ ...message, text: message.kind === 'npc' || message.kind === 'guihang' ? sanitizeNpcReply(message.text) : message.text })),
});

// State and messages commit together in one durable compare-and-swap write.
export function createStorage(store: JsonStore) {
  async function player(id: string) { return (await store.get<Player>(playerKey(id)))?.value; }
  async function ownerOf(saveId: string, id: string): Promise<string | null> {
    const own = await player(id);
    if (!own || own.adoptedBy) return null;
    if (own.saves[saveId]) return id;
    for (const guest of own.guests) {
      const source = await player(guest);
      if (source?.adoptedBy === id && source.saves[saveId]) return guest;
    }
    return null;
  }
  async function readSave(saveId: string, id: string): Promise<SaveView | null> {
    const owner = await ownerOf(saveId, id);
    if (!owner) return null;
    const source = await player(owner);
    if (!source || (owner === id ? Boolean(source.adoptedBy) : source.adoptedBy !== id)) return null;
    return source.saves[saveId] ? cleanView(source.saves[saveId]) : null;
  }
  return {
    async createSave(id: string, codename: string, homeAnchor?: string): Promise<SaveView> {
      const saveId = randomUUID();
      const save = { state: newGameState(saveId, codename.trim().slice(0, 20), homeAnchor), messages: structuredClone(initialMessages), updatedAt: new Date().toISOString() };
      return mutate(store, playerKey(id), emptyPlayer, current => {
        if (current.adoptedBy) throw new Error('PLAYER_ALREADY_ADOPTED');
        if (Object.keys(current.saves).length >= 20) throw new Error('TRIAL_SAVE_LIMIT');
        current.saves[saveId] = save;
        return { next: current, result: save };
      });
    },
    readSave,
    async readLatestSave(id: string): Promise<SaveView | null> {
      const own = await player(id);
      if (!own || own.adoptedBy) return null;
      const saves = Object.values(own.saves);
      for (const guest of own.guests) {
        const source = await player(guest);
        if (source?.adoptedBy === id) saves.push(...Object.values(source.saves));
      }
      const latest = saves.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0];
      return latest ? cleanView(latest) : null;
    },
    async saveTurn(saveId: string, id: string, expectedVersion: number, playerMessage: GameMessage, responses: GameMessage[], nextState: GameState) {
      const owner = await ownerOf(saveId, id);
      if (!owner) return 'not_found' as const;
      if (nextState.saveId !== saveId || nextState.version !== expectedVersion + 1) throw new Error('INVALID_TURN_VERSION');
      return mutate<Player, 'not_found' | 'conflict' | 'ok'>(store, playerKey(owner), emptyPlayer, current => {
        if ((owner === id ? Boolean(current.adoptedBy) : current.adoptedBy !== id) || !current.saves[saveId]) return { result: 'not_found' };
        const save = current.saves[saveId];
        if (save.state.version !== expectedVersion) return { result: 'conflict' };
        current.saves[saveId] = { state: nextState, messages: [...save.messages, playerMessage, ...responses], updatedAt: new Date().toISOString() };
        return { next: current, result: 'ok' };
      });
    },
    async submitFeedback(input: { saveId?: string; playerId: string; understoodGoal: boolean; trustedGuihang: boolean; continueChapterTwo: boolean; rating: number; detail: string; contact?: string }) {
      await mutate(store, playerKey(input.playerId), emptyPlayer, current => {
        if (current.adoptedBy) throw new Error('PLAYER_ALREADY_ADOPTED');
        current.feedback[input.saveId || 'general'] = { ...input, detail: input.detail.slice(0, 2000), contact: input.contact?.slice(0, 100), createdAt: new Date().toISOString() };
        return { next: current, result: undefined };
      });
    },
    async upsertGitHubUser(profile: { id: number; login: string; name?: string | null; avatar_url?: string | null }): Promise<AuthUser> {
      if (!Number.isSafeInteger(profile.id) || profile.id <= 0) throw new Error('INVALID_GITHUB_PROFILE');
      return mutate<AuthUser, AuthUser>(store, `users/${profile.id}.json`, () => ({ id: String(profile.id), githubId: String(profile.id), login: profile.login, name: null, avatarUrl: null }), current => {
        const next = { ...current, login: profile.login, name: profile.name || null, avatarUrl: profile.avatar_url || null };
        return { next, result: next };
      });
    },
    async createAuthSession(userId: string, tokenHash: string, expiresAt: string) {
      if (!await store.put(`sessions/${digest(tokenHash)}.json`, { userId, expiresAt }, null)) throw new Error('SESSION_ALREADY_EXISTS');
    },
    async readAuthUser(tokenHash: string): Promise<AuthUser | null> {
      const session = await store.get<{ userId: string; expiresAt: string }>(`sessions/${digest(tokenHash)}.json`);
      if (!session || !(Date.parse(session.value.expiresAt) > Date.now())) return null;
      if (!/^\d+$/.test(session.value.userId)) return null;
      return (await store.get<AuthUser>(`users/${session.value.userId}.json`))?.value ?? null;
    },
    async deleteAuthSession(tokenHash: string) { await store.remove(`sessions/${digest(tokenHash)}.json`); },
    async adoptAnonymousData(anonymousId: string, userId: string) {
      if (anonymousId === userId || !await player(anonymousId)) return;
      // Claim then link. A failed link can be retried without allowing another account to take the guest data.
      await mutate(store, playerKey(anonymousId), emptyPlayer, current => {
        if (current.adoptedBy && current.adoptedBy !== userId) throw new Error('PLAYER_ALREADY_ADOPTED');
        current.adoptedBy = userId;
        return { next: current, result: undefined };
      });
      await mutate(store, playerKey(userId), emptyPlayer, current => {
        if (current.adoptedBy) throw new Error('PLAYER_ALREADY_ADOPTED');
        if (!current.guests.includes(anonymousId)) current.guests.push(anonymousId);
        return { next: current, result: undefined };
      });
    },
    async reserveModelCall(monthlyLimit: number, dailyLimit: number, now = new Date()) {
      if (![monthlyLimit, dailyLimit].every(n => Number.isSafeInteger(n) && n >= 0)) throw new Error('INVALID_MODEL_QUOTA');
      if (!monthlyLimit || !dailyLimit) return false;
      const day = now.toISOString().slice(0, 10);
      return mutate(store, `quota/${day.slice(0, 7)}.json`, () => ({ calls: 0, day, dailyCalls: 0 }), current => {
        if (current.day !== day) { current.day = day; current.dailyCalls = 0; }
        if (current.calls >= monthlyLimit || current.dailyCalls >= dailyLimit) return { result: false };
        current.calls++; current.dailyCalls++;
        return { next: current, result: true };
      });
    },
  };
}
