---
name: vinss-agentic-deal-room
description: Build and verify VINSS's invisible agentic Deal Room UX. Use Groq only on the server, require explicit user consent before sharing decrypted deal context, keep private messaging first-class, and never expose transaction-signing tools to the agent.
---

# VINSS Agentic Deal Room Skill

## Product rule
VINSS is a private Deal Room, not an AI chatbot. Conversation remains the primary surface; agent intelligence is contextual and appears only when useful.

## Privacy rule
The browser owns decrypted Deal Room content. The agent receives plaintext only after an explicit user action that opts the selected context into the request. Never send room secrets, channel keys, viewing keys, private keys, note IDs, proofs, or undeclared timeline content to Groq.

## Agent rule
Groq runs server-side. Use local tool calling for deterministic VINSS business logic. Allowed tools are analysis, fee calculation, and draft generation. No tool may sign, send, fund, release, refund, cancel, or otherwise execute a blockchain transaction.

## UX rule
Use progressive disclosure: private conversation first, deal status second, agent suggestions third. Fees are transparent at economic action confirmation but should not dominate navigation or messaging.

## Verification
- `backend/tests/agent-tools.test.ts` verifies fee math, offer analysis, counter-offer drafting, and tool allowlisting.
- `e2e/vinss.spec.ts` verifies room-secret hiding, explicit access details, fee visibility, and agent consent UI.
- Use Playwright video recording for the demo; videos are artifacts, not proof that Starknet/Ready transactions succeeded.

## STRK20 boundary
Follow `.agents/skills/strk20-privacy-integration/SKILL.md` for wallet/privacy integration. This skill does not change Cairo contracts and does not handle viewing keys.
