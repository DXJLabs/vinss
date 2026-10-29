import { readFileSync, mkdirSync, writeFileSync, appendFileSync } from 'node:fs';
import { Account, RpcProvider, CallData, hash } from 'starknet';

const out = 'deployment-public-sepolia';
const appPolicy = process.env.VINSS_APP_FEE_POLICY_ADDRESS;
const deploymentVersion = appPolicy ? 'v2-app-fees' : 'v1';
mkdirSync(out, { recursive: true });
const manifest = { network: 'sepolia', source: process.env.GITHUB_SHA, contracts: {}, verified: false };
const save = () => writeFileSync(`${out}/manifest.json`, JSON.stringify(manifest, null, 2));
const equal = (a, b) => BigInt(a) === BigInt(b);
function address(value, name) {
  if (!/^0x[0-9a-fA-F]{1,64}$/.test(value ?? '') || BigInt(value) <= 0n || BigInt(value) >= 2n ** 251n) {
    throw new Error(`Missing or invalid ${name}`);
  }
  return value;
}
function absent(error, code) { return error?.code === code || error?.baseError?.code === code; }
async function main() {
  for (const key of ['STARKNET_RPC_URL', 'ACCOUNT_ADDRESS', 'PRIVATE_KEY', 'VINSS_SEPOLIA_TREASURY_ADDRESS']) {
    if (!process.env[key]) throw new Error(`Required CI configuration missing: ${key}`);
  }
  const treasury = address(process.env.VINSS_SEPOLIA_TREASURY_ADDRESS, 'VINSS_SEPOLIA_TREASURY_ADDRESS');
  const signer = address(process.env.ACCOUNT_ADDRESS, 'ACCOUNT_ADDRESS');
  const provider = new RpcProvider({ nodeUrl: process.env.STARKNET_RPC_URL });
  if (!equal(await provider.getChainId(), '0x534e5f5345504f4c4941')) throw new Error('Sepolia only');
  const account = new Account({ provider, address: signer, signer: process.env.PRIVATE_KEY, cairoVersion: '1' });
  const original = '0x016a59641ec1360bfd6d8bd9ac8883877fbcfc43ec7394d20d9ee35045be832c';
  const call = (contractAddress, entrypoint, calldata = []) => provider.callContract({ contractAddress, entrypoint, calldata });
  const [oracle, policy, resolver, verifier, tokens, economics] = await Promise.all([
    call(original, 'get_pragma_oracle'), call(original, 'get_revenue_fee_policy'),
    call(original, 'get_dispute_resolver'), call(original, 'get_external_verifier'),
    call(original, 'get_supported_tokens'), call(original, 'get_fee_policy'),
  ]);
  if (!equal(policy[0], '0x1d359b83015702c9e369563bb0732da07e31c0ae478c03ddb611258c20825c8')) throw new Error('Unexpected Shield policy');
  if (!equal(tokens[0], '0x04718f5a0fc34cc1af16a1cdee98ffb20c31f5cd61d6ab07201858f4287c938d')) throw new Error('Unexpected STRK token');
  manifest.shieldRekber = original;
  manifest.treasury = treasury;
  manifest.shieldPolicy = policy[0];
  manifest.startBlock = await provider.getBlockNumber();
  save();
  async function settled(tx) {
    const receipt = await provider.waitForTransaction(tx.transaction_hash);
    if (receipt.execution_status !== 'SUCCEEDED') throw new Error(`Transaction reverted: ${tx.transaction_hash}`);
    return tx.transaction_hash;
  }
  async function deploy(name, args) {
    const stem = `../contracts/target/dev/vinss_${name}`;
    const contract = JSON.parse(readFileSync(`${stem}.contract_class.json`, 'utf8'));
    const casm = JSON.parse(readFileSync(`${stem}.compiled_contract_class.json`, 'utf8'));
    const classHash = hash.computeSierraContractClassHash(contract);
    try { await provider.getClassByHash(classHash); }
    catch (error) {
      if (!absent(error, 28)) throw error;
      console.log(`Declaring ${name}`);
      const tx = await account.declare({ contract, casm });
      await settled(tx);
    }
    const constructorCalldata = new CallData(contract.abi).compile('constructor', args);
    const payload = { classHash, constructorCalldata, salt: hash.getSelectorFromName(`vinss-public-sepolia-${deploymentVersion}-${name}`), unique: true };
    const { calls, addresses } = account.deployer.buildDeployerCall(payload, signer);
    const deployedAddress = addresses[0];
    let current;
    try { current = await provider.getClassHashAt(deployedAddress); }
    catch (error) { if (!absent(error, 20)) throw error; }
    let transactionHash;
    if (current) {
      if (!equal(current, classHash)) throw new Error(`Class mismatch: ${name}`);
      // A resumed deployment can precede this run. Never skip older events.
      manifest.startBlock = 0;
    } else {
      console.log(`Deploying ${name}`);
      transactionHash = await settled(await account.execute(calls));
    }
    if (!equal(await provider.getClassHashAt(deployedAddress), classHash)) throw new Error(`Deployment verification failed: ${name}`);
    manifest.contracts[name] = { address: deployedAddress, classHash, constructorCalldata, transactionHash };
    save();
    console.log(`${name}: ${deployedAddress}`);
    return deployedAddress;
  }
  const wrapper = appPolicy
    ? await deploy('VinssPublicAppFeePolicy', [policy[0], address(appPolicy, 'VINSS_APP_FEE_POLICY_ADDRESS')])
    : await deploy('VinssPublicFeePolicy', [policy[0]]);
  const adapter = await deploy('VinssPublicRail', [signer, treasury, tokens[0]]);
  const invite = await deploy('VinssInvite', [adapter, tokens[0], wrapper]);
  const message = await deploy('VinssMessageHelper', [adapter, tokens[0], wrapper]);
  const offer = await deploy('VinssOfferHelper', [adapter, tokens[0], wrapper]);
  const escrow = await deploy('VinssPrivateEscrowHelper', [adapter]);
  // Pair IDs come from the successful Shield Sepolia deployment workflow.
  const rekber = await deploy('VinssEscrowRekber', [adapter, oracle[0], policy[0], resolver[0], verifier[0], ...tokens, '6004514686061859652', '6148332971638477636', ...economics]);
  const certificate = await deploy('VinssSettlementCertificate', [rekber, 'https://vinss-nu.vercel.app/api/public-certificates/']);
  const expected = [treasury, tokens[0], invite, message, offer, escrow, rekber, wrapper];
  let configuration = await call(adapter, 'get_configuration');
  if (equal(configuration[3], 0)) {
    manifest.initializeTransaction = await settled(await account.execute({ contractAddress: adapter, entrypoint: 'initialize', calldata: [invite, message, offer, escrow, rekber, wrapper] }));
    configuration = await call(adapter, 'get_configuration');
  }
  if (configuration.length !== 9 || !equal(configuration[0], 8) || expected.some((v, i) => !equal(v, configuration[i + 1]))) throw new Error('Adapter configuration mismatch');
  for (const helper of [invite, message, offer, escrow, rekber]) {
    if (!equal((await call(helper, 'get_privacy_pool'))[0], adapter)) throw new Error('Helper pool mismatch');
  }
  for (const helper of [invite, message, offer]) {
    if (!equal((await call(helper, 'get_fee_policy'))[0], wrapper)) throw new Error('Helper policy mismatch');
  }
  if (!equal((await call(rekber, 'get_revenue_fee_policy'))[0], policy[0])) throw new Error('Rekber revenue policy mismatch');
  if (!(await call(rekber, 'get_fee_policy')).every((v, i) => equal(v, economics[i]))) throw new Error('Rekber economics mismatch');
  for (let action = 1; action <= 4; action++) {
    const base = BigInt((await call(appPolicy && action !== 4 ? appPolicy : policy[0], 'quote_fee_usd_micros', [action]))[0]);
    const publicFee = BigInt((await call(wrapper, 'quote_fee_usd_micros', [action]))[0]);
    if (publicFee !== (action === 4 ? base : (base + 1n) / 2n)) throw new Error('Public fee mismatch');
  }
  manifest.verified = true;
  save();
  const env = { ADAPTER: adapter, FEE_POLICY: wrapper, INVITE: invite, MESSAGE_HELPER: message, OFFER_HELPER: offer, ESCROW_HELPER: escrow, REKBER: rekber, CERTIFICATE: certificate };
  writeFileSync(`${out}/frontend.env`, Object.entries(env).map(([k, v]) => `NEXT_PUBLIC_UNSHIELD_${k}_ADDRESS=${v}`).join('\n') + '\n');
  writeFileSync(`${out}/backend.env`, `PUBLIC_RAIL_ADAPTER_ADDRESS=${adapter}\nINVITE_ADDRESS=${invite}\nMESSAGE_HELPER_ADDRESS=${message}\nOFFER_HELPER_ADDRESS=${offer}\nPRIVATE_ESCROW_HELPER_ADDRESS=${escrow}\nESCROW_REKBER_ADDRESS=${rekber}\nSETTLEMENT_CERTIFICATE_ADDRESS=${certificate}\n`);
  if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, `## Verified Unshield Sepolia deployment\n\n${Object.entries(env).map(([k, v]) => `- ${k}: \`${v}\``).join('\n')}\n\nFrontend and separate backend configuration are supplied as artifacts; application rollout remains separate.\n`);
}
main().catch(error => {
  // Do not serialize provider errors: request metadata can contain the secret RPC URL.
  const safe = error?.message?.match(/^(Required CI configuration missing: [A-Z_]+|Missing or invalid [A-Z_]+|Sepolia only|Unexpected Shield policy|Unexpected STRK token|.* mismatch|Transaction reverted: 0x[0-9a-f]+)$/)?.[0];
  manifest.error = safe ?? 'Deployment failed; inspect the last completed contract in manifest.json. Provider details withheld.';
  save();
  console.error(manifest.error);
  process.exitCode = 1;
});
