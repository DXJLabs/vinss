# Backend Incident Runbook

## Priority order

```text
1. Protect user privacy
2. Prevent incorrect environment/data behavior
3. Restore service
4. Diagnose root cause
5. Add prevention/regression coverage
```

## Privacy-boundary incident

Examples:

```text
plaintext appears in logs
channel/pairwise key reaches backend
Agent provider receives unintended automatic private context
secret appears in telemetry
```

Actions:

1. stop/rollback affected release;
2. revoke/rotate affected service credentials if needed;
3. preserve only safe diagnostic evidence;
4. identify the exact data path;
5. patch the path;
6. add a regression test;
7. review external-provider/log retention impact;
8. redeploy only after privacy checks pass.

## Discovery / RPC incident

Symptoms:

```text
/discover 500
high discovery latency
event scan timeout
helper getter failure
```

Actions:

1. verify backend process liveness;
2. verify configured network/RPC;
3. check helper addresses;
4. use approved fallback RPC if available;
5. never send keys to the backend as a shortcut;
6. smoke-test discovery after recovery.

## Agent outage

Symptoms:

```text
POST /agent → Agent failed
no configured provider
provider timeout/failure
```

Actions:

1. inspect `GET /agent/providers`;
2. verify server-side provider configuration;
3. use configured fallback policy if appropriate;
4. keep core Message/Offer/discovery functionality independent;
5. do not expose raw provider error bodies.

## Presence incident

Current state is in-memory.

Restart/redeploy clearing presence is expected to lose only ephemeral state.

Do not reconstruct it by logging or decrypting presence payloads.

## Loyalty incident

Current loyalty is non-durable and unauthenticated for production value.

Do not reconstruct valuable balances from unverified client claims.

If valuable loyalty is enabled later, incident handling requires canonical durable storage and reconciliation procedures.

## Bad deployment

```text
identify last good commit
→ rollback
→ health/API smoke test
→ privacy-log review
→ root-cause analysis
→ regression coverage
→ re-release
```
