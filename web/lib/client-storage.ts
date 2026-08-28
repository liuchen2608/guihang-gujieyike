export const STORAGE_WARNING = "浏览器无法保存本机身份，请允许网站存储后重试。不会自动创建临时身份；请勿清理原浏览器数据，以免无法找回匿名存档。";

export function requireStorage(getStorage: () => Storage = () => window.localStorage): Storage {
  try {
    const storage = getStorage();
    const probe = `guihang_storage_check_${crypto.randomUUID()}`;
    storage.setItem(probe, "1");
    if (storage.getItem(probe) !== "1") throw new Error("storage unavailable");
    storage.removeItem(probe);
    return storage;
  } catch {
    throw new Error(STORAGE_WARNING);
  }
}

export function playerIdentity(create = false) {
  try {
    const storage = requireStorage();
    let playerId = storage.getItem("guihang_player_id");
    if (!playerId && create) {
      playerId = crypto.randomUUID();
      storage.setItem("guihang_player_id", playerId);
      if (storage.getItem("guihang_player_id") !== playerId) throw new Error("identity not persisted");
    }
    return playerId;
  } catch { throw new Error(STORAGE_WARNING); }
}

export function rememberSave(saveId: string) {
  try { requireStorage().setItem("guihang_save_id", saveId); }
  catch { throw new Error(STORAGE_WARNING); }
}
