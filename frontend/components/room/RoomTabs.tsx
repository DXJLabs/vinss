"use client";

export type RoomTab =
  | "timeline"
  | "offer"
  | "escrow"
  | "loyalty";

type MessageMode = "chat" | "group";

interface RoomTabsProps {
  value: RoomTab;
  onChange: (tab: RoomTab) => void;
  messageMode: MessageMode;
  onMessageModeChange: (mode: MessageMode) => void;
}

export function RoomTabs({
  value,
  onChange,
  messageMode,
  onMessageModeChange,
}: RoomTabsProps) {
  const messageSurface =
    value !== "loyalty";

  const items = [
    {
      key: "message",
      label: "Message",
      active:
        messageSurface &&
        messageMode === "chat",
      onClick: () => {
        onMessageModeChange("chat");
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
        onMessageModeChange("group");
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
  ] as const;

  return (
    <nav
      aria-label="Deal room navigation"
      className="mb-3 rounded-2xl bg-vault/35 p-1 ring-1 ring-wire/65"
    >
      <div className="grid grid-cols-3 gap-1">
        {items.map((item) => (
          <button
            key={item.key}
            type="button"
            onClick={item.onClick}
            aria-current={
              item.active
                ? "page"
                : undefined
            }
            className={
              item.active
                ? "rounded-xl bg-signal/[0.09] px-2 py-2.5 text-[11px] font-medium text-signal ring-1 ring-signal/15"
                : "rounded-xl px-2 py-2.5 text-[11px] font-medium text-paper/38 transition hover:bg-white/[0.02] hover:text-paper/70"
            }
          >
            {item.label}
          </button>
        ))}
      </div>
    </nav>
  );
}
