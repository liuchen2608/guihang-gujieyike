export async function ensureGuestSession() {
  const response = await fetch("/api/auth/guest", { method: "POST", headers: { "content-type": "application/json" }, body: "{}", cache: "no-store" });
  const data = await response.json() as { playerId?: string; error?: string };
  if (!response.ok || !data.playerId) throw new Error(data.error || "无法建立安全会话，请允许 Cookie 后重试。");
  const storage = window.localStorage;
  const previous = storage.getItem("guihang_player_id");
  if (previous && previous !== data.playerId && !storage.getItem("guihang_legacy_player_id")) {
    storage.setItem("guihang_legacy_player_id", previous);
    const save = storage.getItem("guihang_save_id");
    if (save) storage.setItem("guihang_legacy_save_id", save);
  }
  storage.setItem("guihang_player_id", data.playerId);
  return data.playerId;
}
