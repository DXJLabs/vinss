"use client";

export type RoomTab =
  | "timeline"
  | "offer"
  | "escrow"
  | "loyalty"
  | "royalty";

type MessageMode =
  | "chat"
  | "group";

interface RoomTabsProps {
  value: RoomTab;
  onChange: (
    tab: RoomTab,
  ) => void;
  messageMode: MessageMode;
  onMessageModeChange: (
    mode: MessageMode,
  ) => void;
}

export function RoomTabs({
  value,
  onChange,
  messageMode,
  onMessageModeChange,
}: RoomTabsProps) {
  const messageSurface =
    value !== "loyalty" &&
    value !== "royalty";

  const items = [
    {
      key: "message",
      label: "Message",
      active:
        messageSurface &&
        messageMode === "chat",
      onClick: () => {
        onMessageModeChange(
          "chat",
        );
        onChange("timeline");
      },
    },
    {
      key: "group",
      label: "Group",
      active:
        messageSurface &&
        messageMode === "group",
      onClick: () => {
        onMessageModeChange(
          "group",
        );
        onChange("timeline");
      },
    },
    {
      key: "activity",
      label: "Activity",
      active:
        value === "loyalty",
      onClick: () =>
        onChange("loyalty"),
    },
    {
      key: "royalty",
      label: "Royalty",
      active:
        value === "royalty",
      onClick: () =>
        onChange("royalty"),
    },
  ] as const;

  return (
    <nav
      aria-label="Deal room navigation"
      className="mb-3 rounded-2xl bg-vault/35 p-1 ring-1 ring-wire/65"
    >
      <div
        className="
          flex snap-x snap-mandatory
          gap-1 overflow-x-auto
          overscroll-x-contain
          [scrollbar-width:none]
          [&::-webkit-scrollbar]:hidden
          sm:grid sm:grid-cols-4
          sm:overflow-visible
        "
      >
        {items.map((item) => (
          <button
            key={item.key}
            type="button"
            onClick={
              item.onClick
            }
            aria-current={
              item.active
                ? "page"
                : undefined
            }
            className={
              item.active
                ? "min-w-[108px] flex-1 snap-start rounded-xl bg-signal/[0.09] px-3 py-2.5 text-[11px] font-medium text-signal ring-1 ring-signal/15 sm:min-w-0"
                : "min-w-[108px] flex-1 snap-start rounded-xl px-3 py-2.5 text-[11px] font-medium text-paper/38 transition hover:bg-white/[0.02] hover:text-paper/70 sm:min-w-0"
            }
          >
            {item.label}
          </button>
        ))}
      </div>
    </nav>
  );
}
