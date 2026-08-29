export const HOME_PLAYER_KEY = "guihang_player_id";
export const HOME_SAVE_KEY = "guihang_save_id";

export type HomeUser = { login: string; avatarUrl: string | null };

type StorageReader = Pick<Storage, "getItem" | "setItem" | "removeItem">;
type Fetcher = (input: string) => Promise<Response>;

export type HomeSession = {
  anonymousId: string | null;
  saveId: string | null;
  user: HomeUser | null;
};

function persistValidatedSave(storage: StorageReader, saveId: string | null) {
  if (saveId) storage.setItem(HOME_SAVE_KEY, saveId);
  else storage.removeItem(HOME_SAVE_KEY);
}

async function readLatestSaveId(fetcher: Fetcher, endpoint: string) {
  const response = await fetcher(endpoint);
  if (!response.ok) return { checked: false, saveId: null };
  const latest = await response.json() as { save: { state: { saveId: string } } | null };
  return { checked: true, saveId: latest.save?.state.saveId || null };
}

export async function loadHomeSession(storage: StorageReader, fetcher: Fetcher): Promise<HomeSession> {
  const anonymousId = storage.getItem(HOME_PLAYER_KEY);
  let saveId: string | null = null;
  let user: HomeUser | null = null;

  try {
    const authResponse = await fetcher("/api/auth/me");
    if (authResponse.ok) {
      const auth = await authResponse.json() as { user: HomeUser };
      user = auth.user;
      const latest = await readLatestSaveId(fetcher, "/api/saves");
      if (latest.checked) {
        saveId = latest.saveId;
        persistValidatedSave(storage, saveId);
      }
    } else {
      const latest = await readLatestSaveId(fetcher, "/api/saves");
      if (latest.checked) {
        saveId = latest.saveId;
        persistValidatedSave(storage, saveId);
      }
    }
  } catch {
    // A temporary network failure should hide resume instead of presenting an unverified destination.
  }

  return { anonymousId, saveId, user };
}

export function githubLoginHref(anonymousId: string | null) {
  const query = new URLSearchParams({ returnTo: "/" });
  if (anonymousId) query.set("anonymousId", anonymousId);
  return `/api/auth/github/start?${query.toString()}`;
}
