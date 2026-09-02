import fs from "node:fs";

const invitePage = fs.readFileSync(
  "frontend/app/invite/[token]/page.tsx",
  "utf8",
);

const invitationPanel = fs.readFileSync(
  "frontend/components/room/invitation/InvitationPanel.tsx",
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

expectSource(
  invitationLib,
  "export const DIRECT_INVITE_TTL_MS = 60 * 60 * 1000",
  "Direct invite TTL must remain one hour",
);

expectSource(
  invitationLib,
  'input.scope === "direct"',
  "Direct invite creation path is missing",
);

expectSource(
  invitationLib,
  '? input.roomSecret',
  "Direct invite must carry the encrypted room secret",
);

expectSource(
  invitationLib,
  'payload.scope === "direct"',
  "Direct invite decode validation is missing",
);

expectSource(
  invitationLib,
  'typeof payload.roomSecret !== "string"',
  "Direct invite must reject a missing room secret",
);

expectSource(
  invitationLib,
  'export type GroupInviteDuration = "24h" | "7d"',
  "Group invite durations are missing",
);

expectSource(
  invitationLib,
  '"24h": 24 * 60 * 60 * 1000',
  "Group 24-hour TTL is missing",
);

expectSource(
  invitationLib,
  '"7d": 7 * 24 * 60 * 60 * 1000',
  "Group 7-day TTL is missing",
);

expectSource(
  invitationLib,
  'input.scope === "group"',
  "Group invite creation path is missing",
);

expectSource(
  invitationLib,
  '"A Group invite must be bound to an admin-created Group."',
  "Group invite metadata validation is missing",
);

expectSource(
  invitationLib,
  '? input.groupSecret',
  "Group invite must carry its encrypted group secret",
);

expectSource(
  invitePage,
  'invite.scope ===\n          "group"',
  "Group invite join path is missing",
);

expectSource(
  invitePage,
  "!room.roomSecret &&",
  "Group invite must preserve existing direct room access",
);

expectSource(
  invitePage,
  "existingRoom?.roomSecret",
  "Existing direct room secret preservation is missing",
);

expectSource(
  invitationPanel,
  'import { QRCodeCanvas } from "qrcode.react"',
  "Invite QR renderer is missing",
);

expectSource(
  invitationPanel,
  'value={state.link}',
  "Invite QR must encode the complete client-side invite link",
);

expectSource(
  invitationPanel,
  "Show QR",
  "Invite QR toggle is missing",
);

expectSource(
  invitationPanel,
  "Share QR",
  "Invite QR sharing action is missing",
);

expectSource(
  invitationPanel,
  "navigator.share",
  "Invite QR native sharing path is missing",
);

expectSource(
  invitationPanel,
  '!state.expired',
  "Expired invites must not render an active QR code",
);

console.log("invite recovery boundary checks: PASS");
