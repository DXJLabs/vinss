# Incident Runbook

Operational response guide for VINSS backend.

## Priority order

During an incident:

```text
1. Protect user privacy
2. Prevent incorrect mainnet actions/data exposure
3. Restore service
4. Diagnose root cause
5. Document and prevent recurrence
```

## Privacy incident

Examples:

- plaintext appears in backend logs;
- room/channel key reaches the backend;
- Agent provider receives unintended private context;
- new endpoint exposes sensitive metadata.

Actions:

1. stop or roll back the affected deployment;
2. revoke/rotate affected service credentials when necessary;
3. preserve only safe diagnostic evidence;
4. identify the data path that crossed the boundary;
5. patch and add a regression test;
6. review whether external provider/log retention requires follow-up;
7. redeploy only after privacy tests pass.

## RPC outage

Symptoms:

```text
/discover returns 500
high discovery latency
event scanning timeout
```

Actions:

1. confirm backend process is healthy;
2. verify Starknet RPC status;
3. switch to an approved fallback RPC if configured;
4. avoid changing privacy boundaries as a quick workaround;
5. restore and smoke-test discovery.

## Agent provider outage

Symptoms:

```text
POST /agent returns Agent failed
configured provider unavailable
```

Actions:

1. check `GET /agent/providers`;
2. confirm server-side provider configuration;
3. use configured fallback provider if policy allows;
4. keep chat/Offer core protocol available without Agent;
5. never expose raw vendor error bodies to clients.

Agent outage should not break private messaging.

## Presence incident

Because current presence state is in-memory:

- restart clears events;
- multi-replica inconsistency is possible.

Treat presence as non-critical ephemeral UX state.

Do not attempt to restore it by logging/decrypting presence content.

## Loyalty incident

If current in-memory loyalty is enabled and the process restarts, state is lost.

Do not manually reconstruct valuable reward balances from unverified client claims.

Before loyalty carries value, use durable canonical storage and a reconciliation procedure.

## Bad deployment

1. identify last known-good commit;
2. roll back;
3. run health/API smoke checks;
4. verify privacy logs;
5. open a root-cause issue/document;
6. add regression coverage before re-release.
