/** Reject the known pool from the other network before building a private send. */
export function assertShieldPoolNetwork(network: string, pool: string): void {
  const otherPool = network === 'sepolia'
    ? '0x40337b1af3c663e86e333bab5a4b28da8d4652a15a69beee2b677776ffe812a'
    : '0x254a6b2997ef52e9f830ce1f543f6b29768295e8d17e2267d672c552cfe0d91';
  if (pool && BigInt(pool) === BigInt(otherPool)) {
    throw new Error(network === 'sepolia'
      ? 'Shield is configured with a Mainnet pool on Sepolia. Redeploy with the verified Sepolia profile.'
      : 'Shield is configured with a Sepolia pool on Mainnet. Restore the Mainnet deployment configuration.');
  }
}
