/** Deploy the frontend with both verified Sepolia rails, overriding stale hosting env. */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
const frontend = fileURLToPath(new URL('../frontend/', import.meta.url));
const values = new Map();
for (const rail of ['public-v1', 'shield-v1']) {
  const env = readFileSync(new URL(`../deployments/sepolia/${rail}/frontend.env`, import.meta.url), 'utf8');
  for (const line of env.split(/\r?\n/)) {
    if (!line.trim() || line.startsWith('#')) continue;
    const index = line.indexOf('=');
    if (index < 0 || !line.startsWith('NEXT_PUBLIC_')) throw new Error('Invalid public deployment profile.');
    values.set(line.slice(0, index), line.slice(index + 1));
  }
}
if (values.get('NEXT_PUBLIC_STARKNET_NETWORK') !== 'sepolia') throw new Error('Sepolia deployment only.');
const args = ['vercel', '--prod'];
for (const [key, value] of values) args.push('--build-env', `${key}=${value}`, '--env', `${key}=${value}`);
const result = spawnSync(process.platform === 'win32' ? 'npx.cmd' : 'npx', args, { cwd: frontend, stdio: 'inherit' });
if (result.error) throw result.error;
process.exitCode = result.status ?? 1;
