"use client";

import { useCallback, useEffect, useRef, useState, type MutableRefObject } from "react";
import { distanceToLatest, scrollToLatest } from "@/lib/ui/conversationScroll";

/** The timeline owns scrolling; data polling never moves the document. */
export function useConversationScroll(
  identity: string,
  entryCount: number,
  chatEndRef: MutableRefObject<HTMLDivElement | null>,
) {
  const scrollBoxRef = useRef<HTMLDivElement | null>(null);
  const endNodeRef = useRef<HTMLDivElement | null>(null);
  const following = useRef(true);
  const [showJumpToLatest, setShowJumpToLatest] = useState(false);
  const internalScroll = useCallback(() => {
    const node = scrollBoxRef.current;
    return Boolean(node && /^(auto|scroll)$/.test(getComputedStyle(node).overflowY));
  }, []);
  const updateScrollIntent = useCallback(() => {
    const node = scrollBoxRef.current;
    const end = endNodeRef.current;
    if (!node || !end) return;
    const near = distanceToLatest({
      internal: internalScroll(), scrollHeight: node.scrollHeight,
      scrollTop: node.scrollTop, clientHeight: node.clientHeight,
      endBottom: end.getBoundingClientRect().bottom, viewportHeight: window.innerHeight,
    }) < 96;
    following.current = near;
    chatEndRef.current = near ? end : null;
    setShowJumpToLatest(!near);
  }, [chatEndRef, internalScroll]);
  const moveToEnd = useCallback((behavior: ScrollBehavior) => {
    if (scrollBoxRef.current && endNodeRef.current) {
      scrollToLatest(scrollBoxRef.current, endNodeRef.current, internalScroll(), behavior);
    }
  }, [internalScroll]);
  const jumpToLatest = useCallback(() => {
    following.current = true;
    setShowJumpToLatest(false);
    chatEndRef.current = endNodeRef.current;
    moveToEnd("smooth");
  }, [chatEndRef, moveToEnd]);
  const pauseFollowing = useCallback(() => {
    following.current = false;
    chatEndRef.current = null;
  }, [chatEndRef]);
  const setEndNode = useCallback((node: HTMLDivElement | null) => {
    endNodeRef.current = node;
    chatEndRef.current = following.current ? node : null;
  }, [chatEndRef]);

  useEffect(() => {
    following.current = true;
    setShowJumpToLatest(false);
    const frame = requestAnimationFrame(() => { if (following.current) moveToEnd("auto"); });
    return () => cancelAnimationFrame(frame);
  }, [identity, moveToEnd]);
  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      if (following.current) moveToEnd("auto");
      else if (entryCount) setShowJumpToLatest(true);
    });
    return () => cancelAnimationFrame(frame);
  }, [entryCount, moveToEnd]);
  useEffect(() => {
    // Mobile uses the page's native scroll; desktop uses the timeline's scroll.
    window.addEventListener("scroll", updateScrollIntent, { passive: true });
    window.addEventListener("resize", updateScrollIntent);
    return () => {
      window.removeEventListener("scroll", updateScrollIntent);
      window.removeEventListener("resize", updateScrollIntent);
    };
  }, [updateScrollIntent]);
  return { scrollBoxRef, setEndNode, updateScrollIntent, jumpToLatest, showJumpToLatest, pauseFollowing };
}
