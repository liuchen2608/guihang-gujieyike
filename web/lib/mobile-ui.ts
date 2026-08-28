export const MOBILE_QUERY = "(max-width: 720px)";
export const COMPACT_QUERY = "(max-width: 1050px)";

export function isNearBottom(scrollTop: number, scrollHeight: number, clientHeight: number) {
  return scrollHeight - scrollTop - clientHeight <= 96;
}

export function shouldSendOnEnter(event: { key: string; shiftKey: boolean; isComposing: boolean; keyCode: number }, mobile: boolean) {
  return !mobile && event.key === "Enter" && !event.shiftKey && !event.isComposing && event.keyCode !== 229;
}

export function visibleViewport(innerHeight: number, viewport?: { height: number; offsetTop: number; scale: number } | null) {
  // Do not resize the application while the reader pinch-zooms text.
  if (viewport && Math.abs(viewport.scale - 1) < 0.01) {
    return { height: Math.max(1, viewport.height), top: Math.max(0, viewport.offsetTop) };
  }
  return { height: innerHeight, top: 0 };
}
