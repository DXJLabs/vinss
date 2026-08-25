"use client";

import {
  useStarkIdentity,
} from "@/hooks/useStarkIdentity";

export function StarkIdentity({
  address,
  className,
}: {
  address?: string | null;
  className?: string;
}) {
  const { label } =
    useStarkIdentity(address);

  return (
    <span
      className={className}
      title={
        address || undefined
      }
    >
      {label}
    </span>
  );
}
