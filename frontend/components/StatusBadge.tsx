export function StatusBadge({
  tone,
  children,
}: {
  tone: "signal" | "amber" | "danger" | "wire";
  children: React.ReactNode;
}) {
  const toneClass = {
    signal: "border-signal/40 text-signal",
    amber: "border-amber/40 text-amber",
    danger: "border-danger/40 text-danger",
    wire: "border-wire text-paper/60",
  }[tone];

  return (
    <span
      className={`inline-flex items-center gap-1.5 border px-2 py-0.5 font-display text-[10px] uppercase tracking-widest ${toneClass}`}
    >
      {children}
    </span>
  );
}

/** The recurring "hidden vs visible" split — the product's own honesty rule,
 * rendered as a UI motif rather than just prose. */
export function VisibilitySplit({
  hidden,
  visible,
}: {
  hidden: string;
  visible: string;
}) {
  return (
    <div className="flex divide-x divide-wire border border-wire text-[10px] font-display uppercase tracking-widest">
      <div className="flex-1 px-2 py-1 text-paper/40">
        <span className="text-signal/70">Hidden </span>
        {hidden}
      </div>
      <div className="flex-1 px-2 py-1 text-paper/40">
        <span className="text-amber/70">Visible </span>
        {visible}
      </div>
    </div>
  );
}
