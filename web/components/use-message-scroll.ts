"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { isNearBottom } from "@/lib/mobile-ui";

export function useMessageScroll(lastMessageId: string | undefined, pending: boolean) {
  const messagesRef = useRef<HTMLDivElement>(null);
  const following = useRef(true);
  const previousMessage = useRef(lastMessageId);
  const [hasNewMessages, setHasNewMessages] = useState(false);
  const scrollToLatest = useCallback(() => {
    following.current = true;
    const element = messagesRef.current;
    element?.scrollTo({ top: element.scrollHeight, behavior: "instant" });
    setHasNewMessages(false);
  }, []);
  useEffect(() => {
    const changed = previousMessage.current !== lastMessageId;
    previousMessage.current = lastMessageId;
    const frame = requestAnimationFrame(() => {
      if (following.current) scrollToLatest();
      else if (changed) setHasNewMessages(true);
    });
    const element = messagesRef.current;
    const observer = new ResizeObserver(() => {
      if (following.current && element) element.scrollTo({ top: element.scrollHeight, behavior: "instant" });
    });
    if (element) observer.observe(element);
    return () => { cancelAnimationFrame(frame); observer.disconnect(); };
  }, [lastMessageId, pending, scrollToLatest]);
  function onScroll() {
    const element = messagesRef.current;
    if (!element) return;
    following.current = isNearBottom(element.scrollTop, element.scrollHeight, element.clientHeight);
    if (following.current) setHasNewMessages(false);
  }
  return { messagesRef, onScroll, hasNewMessages, scrollToLatest };
}
