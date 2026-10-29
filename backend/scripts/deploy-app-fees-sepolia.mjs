/** Deploy flat app-fee policies and Shield helpers. Existing Rekber is untouched. */
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { Account, RpcProvider, CallData, hash } from 'starknet';
const output = 'deployment-app-fees-sepolia';
mkdirSync(output, { recursive: true });
const manifest = { network: 'sepolia', verified: false, contracts: {} };
const save = () => writeFileSync(`${output}/manifest.json`, JSON.stringify(manifest, null, 2));
const provider = new RpcProvider({ nodeUrl: process.env.STARKNET_RPC_URL });
const originalPolicy = '0x1d359b83015702c9e369563bb0732da07e31c0ae478c03ddb611258c20825c8';
const originalRekber = '0x16a59641ec1360bfd6d8bd9ac8883877fbcfc43ec7394d20d9ee35045be832c';
const pool = '0x254a6b2997ef52e9f830ce1f543f6b29768295e8d17e2267d672c552cfe0d91';
const call = (contractAddress, entrypoint, calldata = []) => provider.callContract({ contractAddress, entrypoint, calldata });
const eq = (a,b) => BigInt(a) === BigInt(b);
async function main() {
  for (const name of ['STARKNET_RPC_URL','ACCOUNT_ADDRESS','PRIVATE_KEY']) {
    if (!process.env[name]) throw new Error(`Missing ${name}`);
  }
  if (!eq(await provider.getChainId(), '0x534e5f5345504f4c4941')) throw new Error('Sepolia only');
  const before = await call(originalRekber, 'get_revenue_fee_policy');
  if (!eq(before[0], originalPolicy)) throw new Error('Unexpected Rekber policy');
  const account = new Account({ provider, address: process.env.ACCOUNT_ADDRESS, signer: process.env.PRIVATE_KEY, cairoVersion: '1' });
  async function settled(tx) {
    const receipt = await provider.waitForTransaction(tx.transaction_hash);
    if (receipt.execution_status !== 'SUCCEEDED') throw new Error('Deployment reverted');
    return receipt;
  }
  async function deploy(name, args) {
    const stem = `../contracts/target/dev/vinss_${name}`;
    const contract = JSON.parse(readFileSync(`${stem}.contract_class.json`, 'utf8'));
    const casm = JSON.parse(readFileSync(`${stem}.compiled_contract_class.json`, 'utf8'));
    const classHash = hash.computeSierraContractClassHash(contract);
    try { await provider.getClassByHash(classHash); }
    catch (error) {
      if ((error.code ?? error.baseError?.code) !== 28) throw error;
      await settled(await account.declare({ contract, casm }));
    }
    const constructorCalldata = new CallData(contract.abi).compile('constructor', args);
    const { calls, addresses } = account.deployer.buildDeployerCall({ classHash, constructorCalldata,
      salt: hash.getSelectorFromName(`vinss-flat-app-sepolia-v2-${name}`), unique: true }, account.address);
    const address = addresses[0];
    let existing;
    try { existing = await provider.getClassHashAt(address); }
    catch (error) { if ((error.code ?? error.baseError?.code) !== 20) throw error; }
    let receipt;
    if (!existing) receipt = await settled(await account.execute(calls));
    if (!eq(await provider.getClassHashAt(address), classHash)) throw new Error('Class hash mismatch');
    manifest.contracts[name] = { address, classHash, constructorCalldata, startBlock: receipt?.block_number ?? 0 };
    save();
    return address;
  }
  // Match the existing Sepolia oracle tolerance; it does not alter the old policy.
  const policy = await deploy('VinssAppFeePolicy', [originalPolicy, '31536000', '1']);
  const publicPolicy = await deploy('VinssPublicAppFeePolicy', [originalPolicy, policy]);
  const strk = '0x4718f5a0fc34cc1af16a1cdee98ffb20c31f5cd61d6ab07201858f4287c938d';
  const helpers = {};
  for (const name of ['VinssInvite','VinssMessageHelper','VinssOfferHelper']) {
    helpers[name] = await deploy(name, [pool, strk, policy]);
    if (!eq((await call(helpers[name], 'get_privacy_pool'))[0], pool) ||
        !eq((await call(helpers[name], 'get_fee_policy'))[0], policy)) throw new Error('Helper configuration mismatch');
  }
  for (const [action, usd] of [[1,50000n],[2,10000n],[3,50000n]]) {
    if (!eq((await call(publicPolicy, 'quote_fee_usd_micros', [action]))[0], usd)) throw new Error('Public USD quote mismatch');
    if (!eq((await call(policy, 'quote_fee_usd_micros', [action]))[0], usd * 2n)) throw new Error('Shield USD quote mismatch');
    const shield = BigInt((await call(policy, 'quote_fee', [action]))[0]);
    if (!eq((await call(publicPolicy, 'quote_fee', [action]))[0], (shield + 1n) / 2n)) throw new Error('Public STRK quote mismatch');
  }
  if (!eq((await call(originalRekber, 'get_revenue_fee_policy'))[0], before[0]) ||
      !eq((await call(publicPolicy, 'quote_fee', [4]))[0], (await call(originalPolicy, 'quote_fee', [4]))[0])) throw new Error('Rekber changed');
  manifest.verified = true;
  manifest.publicPolicy = publicPolicy;
  manifest.shieldPolicy = policy;
  manifest.shieldHelpers = helpers;
  manifest.activation = 'Staged: public adapter/helper deployment and backend rollout must be verified before frontend promotion.';
  save();
  console.log('Verified flat-fee policy deployment saved. No active frontend/backend pointers changed.');
}
main().catch(() => { save(); console.error('Fee deployment failed. Provider details withheld.'); process.exitCode = 1; });
