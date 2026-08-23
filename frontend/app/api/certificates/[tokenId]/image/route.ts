interface RouteContext {
  params: Promise<{ tokenId: string }>;
}

function escapeXml(value: string): string {
  return value.replace(
    /[<>&'\"]/g,
    (character) =>
      ({
        "<": "&lt;",
        ">": "&gt;",
        "&": "&amp;",
        "'": "&apos;",
        '"': "&quot;",
      })[character] ?? character,
  );
}

export async function GET(
  _request: Request,
  context: RouteContext,
) {
  const { tokenId } = await context.params;
  const shortId = escapeXml(
    tokenId.length > 18
      ? `${tokenId.slice(0, 9)}…${tokenId.slice(-7)}`
      : tokenId,
  );
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="1200" height="1200" viewBox="0 0 1200 1200" style="color-scheme:dark">
      <style>
        :root {
          color-scheme: dark;
        }
      </style>
      <defs>
        <radialGradient id="glow" cx="50%" cy="44%" r="60%">
          <stop offset="0" stop-color="#5ee7d4" stop-opacity=".18"/>
          <stop offset="1" stop-color="#06090b" stop-opacity="0"/>
        </radialGradient>
        <pattern id="grid" width="48" height="48" patternUnits="userSpaceOnUse">
          <path d="M 48 0 L 0 0 0 48" fill="none" stroke="#5ee7d4" stroke-opacity=".055" stroke-width="1"/>
        </pattern>
      </defs>
      <rect width="1200" height="1200" fill="#06090b"/>
      <rect width="1200" height="1200" fill="url(#grid)"/>
      <rect width="1200" height="1200" fill="url(#glow)"/>
      <rect x="72" y="72" width="1056" height="1056" fill="none" stroke="#233137" stroke-width="2"/>
      <path d="M72 76h260M868 76h260M72 1124h260M868 1124h260" stroke="#5ee7d4" stroke-width="5" opacity=".75"/>
      <circle cx="600" cy="520" r="188" fill="none" stroke="#5ee7d4" stroke-opacity=".22" stroke-width="2"/>
      <circle cx="600" cy="520" r="144" fill="#081013" stroke="#5ee7d4" stroke-opacity=".75" stroke-width="3"/>
      <path d="M533 520l43 43 94-105" fill="none" stroke="#5ee7d4" stroke-width="16" stroke-linecap="square"/>
      <text x="112" y="152" fill="#f3f3ef" font-size="45" font-family="monospace" letter-spacing="18">VINSS</text>
      <text x="1088" y="152" fill="#5ee7d4" font-size="22" font-family="monospace" text-anchor="end" letter-spacing="7">SETTLED</text>
      <text x="600" y="790" fill="#f3f3ef" font-size="46" font-family="monospace" text-anchor="middle" letter-spacing="9">SETTLEMENT CERTIFICATE</text>
      <text x="600" y="846" fill="#7e8a8e" font-size="24" font-family="monospace" text-anchor="middle" letter-spacing="6">ESCROW REKBER · STARKNET</text>
      <line x1="270" y1="900" x2="930" y2="900" stroke="#233137" stroke-width="2"/>
      <text x="600" y="958" fill="#5ee7d4" font-size="26" font-family="monospace" text-anchor="middle">#${shortId}</text>
      <text x="600" y="1050" fill="#4f5b60" font-size="18" font-family="monospace" text-anchor="middle" letter-spacing="4">PRIVATE TERMS OMITTED · PUBLIC OWNERSHIP</text>
    </svg>`;

  return new Response(svg, {
    headers: {
      "Content-Type": "image/svg+xml; charset=utf-8",
      "Cache-Control": "public, max-age=300, s-maxage=3600",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
