"use client";

export type RoomTab =
  | "timeline"
  | "offer"
  | "escrow"
  | "loyalty";

interface RoomTabsProps {
  value: RoomTab;
  onChange: (tab: RoomTab) => void;
}

export function RoomTabs({
  value,
  onChange,
}: RoomTabsProps) {
  return (
    <nav className="mb-6 flex gap-1 border-b border-wire">
      {(
        [
          "timeline",
          "offer",
          "escrow",
          "loyalty",
        ] as RoomTab[]
      ).map((tab) => (
        <button
          key={tab}
          onClick={() => onChange(tab)}
          className={`px-4 py-2 font-display text-xs uppercase tracking-widest ${
            value === tab
              ? "border-b-2 border-signal text-signal"
              : "text-paper/40 hover:text-paper/70"
          }`}
        >
          {tab === "timeline"
            ? "Messages"
            : tab === "offer"
              ? "Deal"
              : tab === "escrow"
                ? "Escrow"
                : "Loyalty"}
        </button>
      ))}
    </nav>
  );
}
