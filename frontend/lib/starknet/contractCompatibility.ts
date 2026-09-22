import { sameFelt } from "./network";

interface AbiItem { type?: string; name?: string; items?: AbiItem[] }

export function abiFunctions(abi: unknown): Set<string> {
  const parsed = typeof abi === "string" ? JSON.parse(abi) : abi;
  if (!Array.isArray(parsed)) throw new Error("Contract ABI is unavailable.");
  const functions = new Set<string>();
  for (const item of parsed as AbiItem[]) {
    for (const entry of [item, ...(item.items ?? [])]) {
      if (entry.type === "function" && entry.name) functions.add(entry.name);
    }
  }
  return functions;
}

export function assertHelperCompatibility(
  abi: unknown,
  required: readonly string[],
  label: string,
): void {
  const functions = abiFunctions(abi);
  const missing = required.filter((name) => !functions.has(name));
  if (missing.length) {
    throw new Error(`${label} deployment is incompatible with this VINSS version (missing ${missing.join(", ")}). No transaction was submitted.`);
  }
}

export function assertHelperPool(actual: string, expected: string): void {
  if (!sameFelt(actual, expected)) {
    throw new Error("VINSS helper is bound to a different privacy pool. No transaction was submitted.");
  }
}
