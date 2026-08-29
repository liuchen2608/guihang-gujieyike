"use client";

import { createContext, ReactNode, useContext, useEffect, useState, useSyncExternalStore } from "react";
import { usePathname } from "next/navigation";
import { COMPACT_QUERY, visibleViewport } from "@/lib/mobile-ui";
import AudioSpace from "@/components/audio-space";
import InviteProvider from "@/components/invite-provider";

type Panel = "status" | "audio" | null;
const UiContext = createContext<{ panel: Panel; setPanel: (panel: Panel) => void }>({ panel: null, setPanel: () => {} });
export const useGameUI = () => useContext(UiContext);

export function useMediaQuery(query: string) {
  return useSyncExternalStore(
    (notify) => {
      const media = window.matchMedia(query);
      media.addEventListener("change", notify);
      return () => media.removeEventListener("change", notify);
    },
    () => window.matchMedia(query).matches,
    () => false,
  );
}

export default function GameUIProvider({ children }: { children: ReactNode }) {
  const [panel, setPanel] = useState<Panel>(null);
  const pathname = usePathname();
  const compact = useMediaQuery(COMPACT_QUERY);
  useEffect(() => {
    const timer = window.setTimeout(() => setPanel(null), 0);
    return () => window.clearTimeout(timer);
  }, [pathname, compact]);
  useEffect(() => {
    let frame = 0;
    const update = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const viewport = window.visualViewport;
        // Preserve the last layout during pinch zoom; the browser handles panning.
        if (viewport && Math.abs(viewport.scale - 1) >= 0.01) return;
        const { height, top } = visibleViewport(window.innerHeight, viewport);
        document.documentElement.style.setProperty("--visual-height", `${height}px`);
        document.documentElement.style.setProperty("--visual-top", `${top}px`);
        document.documentElement.dataset.shortViewport = String(height < 500);
      });
    };
    update();
    window.addEventListener("resize", update);
    window.visualViewport?.addEventListener("resize", update);
    window.visualViewport?.addEventListener("scroll", update);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("resize", update);
      window.visualViewport?.removeEventListener("resize", update);
      window.visualViewport?.removeEventListener("scroll", update);
    };
  }, []);
  return <UiContext.Provider value={{ panel, setPanel }}><InviteProvider>{children}</InviteProvider><AudioSpace /></UiContext.Provider>;
}
