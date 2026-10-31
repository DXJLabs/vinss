interface ScrollMetrics {
  internal: boolean;
  scrollHeight: number;
  scrollTop: number;
  clientHeight: number;
  endBottom: number;
  viewportHeight: number;
}

export function distanceToLatest(metrics: ScrollMetrics): number {
  return Math.max(0, metrics.internal
    ? metrics.scrollHeight - metrics.scrollTop - metrics.clientHeight
    : metrics.endBottom - metrics.viewportHeight);
}

export function scrollToLatest(
  container: Pick<HTMLElement, "scrollHeight" | "scrollTo">,
  end: Pick<HTMLElement, "scrollIntoView">,
  internal: boolean,
  behavior: ScrollBehavior,
): void {
  if (internal) container.scrollTo({ top: container.scrollHeight, behavior });
  else end.scrollIntoView({ block: "end", behavior });
}
