import fs from "node:fs";

const invitePage = fs.readFileSync(
  "frontend/app/invite/[token]/page.tsx",
  "utf8",
);

const invitationLib = fs.readFileSync(
  "frontend/lib/deal-room/invitation.ts",
  "utf8",
);

const participantKeys = fs.readFileSync(
  "frontend/lib/privacy/participantKeys.ts",
  "utf8",
);

function expectSource(source, value, message) {
  if (!source.includes(value)) {
    throw new Error(message);
  }
}

expectSource(
  invitePage,
  "sameStarknetAddress(",
  "Invite recovery is not bound with canonical wallet comparison",
);

expectSource(
  invitePage,
  "saved.walletAddress",
  "Saved recovery wallet is not validated",
);

expectSource(
  invitePage,
  "account.address",
  "Active wallet is not used during recovery validation",
);

expectSource(
  invitePage,
  "window.localStorage.removeItem(",
  "Invalid recovery state is not cleared",
);

expectSource(
  participantKeys,
  "export function sameStarknetAddress",
  "Shared Starknet address helper is missing",
);

expectSource(
  invitationLib,
  'export type InviteScope = "direct" | "group"',
  "Direct/group invite scopes are missing",
);

console.log("invite recovery boundary checks: PASS");
