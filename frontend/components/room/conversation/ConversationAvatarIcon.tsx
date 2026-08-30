"use client";

interface ConversationAvatarIconProps {
  seed: string;
}

function stableIndex(seed: string, size: number) {
  let hash = 2166136261;

  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return Math.abs(hash >>> 0) % size;
}

const paths = [
  <>
    <path d="M5.5 6.5h13a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2h-8l-5 3v-3a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2Z" />
    <path d="M8 10h8M8 13.5h5" />
  </>,
  <>
    <circle cx="9" cy="9" r="3" />
    <circle cx="16.5" cy="10" r="2.5" />
    <path d="M3.8 19c.7-3.1 2.6-4.7 5.2-4.7s4.5 1.6 5.2 4.7M14 15.1c.7-.8 1.6-1.2 2.7-1.2 2 0 3.4 1.2 3.9 3.6" />
  </>,
  <>
    <path d="M12 3.8 18.5 6v5c0 4-2.4 7-6.5 9-4.1-2-6.5-5-6.5-9V6L12 3.8Z" />
    <path d="m9 12 2 2 4-4" />
  </>,
  <>
    <rect x="4.5" y="6.5" width="15" height="11" rx="2" />
    <path d="M8.5 6.5V5.3A1.8 1.8 0 0 1 10.3 3.5h3.4a1.8 1.8 0 0 1 1.8 1.8v1.2M4.5 11.5h15M10 11.5v2h4v-2" />
  </>,
  <>
    <path d="M7.2 12.8 4.8 15.2a3 3 0 0 0 4.2 4.2l3.1-3.1M16.8 11.2l2.4-2.4A3 3 0 0 0 15 4.6l-3.1 3.1" />
    <path d="m9 15 6-6" />
  </>,
  <>
    <path d="M7 3.8h7l4 4V20H7Z" />
    <path d="M14 3.8V8h4M10 12h5M10 15.5h5" />
  </>,
] as const;

export function ConversationAvatarIcon({
  seed,
}: ConversationAvatarIconProps) {
  const path = paths[stableIndex(seed, paths.length)];

  return (
    <svg
      aria-hidden="true"
      className="h-[19px] w-[19px]"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.55"
    >
      {path}
    </svg>
  );
}
