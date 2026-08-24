import {
  getSettlementCertificate,
} from "@/lib/deal-room/settlementV2";
import {
  NETWORK,
} from "@/lib/starknet/constants";

interface RouteContext {
  params: Promise<{ tokenId: string }>;
}

function escapeXml(value: string): string {
  return value.replace(
    /[<>&'"]/g,
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

function isTokenId(value: string): boolean {
  return /^(0x[0-9a-f]+|[0-9]+)$/i.test(value);
}

function shortValue(
  value: string,
  start = 12,
  end = 10,
): string {
  return value.length > start + end + 1
    ? `${value.slice(0, start)}…${value.slice(-end)}`
    : value;
}

function formatDate(timestamp: number): string {
  if (!timestamp) return "—";

  const date = new Date(timestamp * 1000);

  const months = [
    "JAN",
    "FEB",
    "MAR",
    "APR",
    "MAY",
    "JUN",
    "JUL",
    "AUG",
    "SEP",
    "OCT",
    "NOV",
    "DEC",
  ];

  return `${String(date.getUTCDate()).padStart(2, "0")} ${
    months[date.getUTCMonth()]
  } ${date.getUTCFullYear()}`;
}

function networkLabel(): string {
  const value = String(NETWORK).toLowerCase();

  if (value.includes("mainnet")) return "MAINNET";
  if (value.includes("sepolia")) return "SEPOLIA";

  return value.toUpperCase();
}

export async function GET(
  _request: Request,
  context: RouteContext,
) {
  const { tokenId } = await context.params;

  if (!isTokenId(tokenId)) {
    return new Response(
      "Invalid certificate token ID.",
      {
        status: 400,
        headers: {
          "Content-Type": "text/plain; charset=utf-8",
        },
      },
    );
  }

  const record =
    await getSettlementCertificate(
      BigInt(tokenId),
    );

  if (!record) {
    return new Response(
      "Certificate not found.",
      {
        status: 404,
        headers: {
          "Content-Type": "text/plain; charset=utf-8",
        },
      },
    );
  }

  const certificateId = escapeXml(
    shortValue(record.tokenId.toString(), 12, 10),
  );

  const settlementReference = escapeXml(
    shortValue(
      `0x${record.custodyCommitment.toString(16)}`,
      12,
      10,
    ),
  );

  const role = escapeXml(
    record.role === "payer"
      ? "PAYER"
      : "PAYEE",
  );

  const settledAt = escapeXml(
    formatDate(record.settledAt),
  );

  const network = escapeXml(
    networkLabel(),
  );

  const svg = `
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="1200"
      height="1200"
      viewBox="0 0 1200 1200"
      style="color-scheme:dark;forced-color-adjust:none;background:#050809"
    >
      <style>
        :root,
        svg {
          color-scheme: dark;
          forced-color-adjust: none;
        }

        .sans {
          font-family:
            Inter,
            Arial,
            Helvetica,
            sans-serif;
        }

        .mono {
          font-family:
            ui-monospace,
            SFMono-Regular,
            Menlo,
            Monaco,
            Consolas,
            monospace;
        }
      </style>

      <defs>
        <radialGradient
          id="bgGlow"
          cx="50%"
          cy="36%"
          r="68%"
        >
          <stop
            offset="0"
            stop-color="#5ee7d4"
            stop-opacity=".14"
          />
          <stop
            offset=".45"
            stop-color="#5ee7d4"
            stop-opacity=".03"
          />
          <stop
            offset="1"
            stop-color="#050809"
            stop-opacity="0"
          />
        </radialGradient>

        <radialGradient
          id="sealGlow"
          cx="50%"
          cy="50%"
          r="50%"
        >
          <stop
            offset="0"
            stop-color="#5ee7d4"
            stop-opacity=".22"
          />
          <stop
            offset="1"
            stop-color="#5ee7d4"
            stop-opacity="0"
          />
        </radialGradient>

        <linearGradient
          id="frameEdge"
          x1="0"
          y1="0"
          x2="1"
          y2="1"
        >
          <stop
            offset="0"
            stop-color="#5ee7d4"
            stop-opacity=".5"
          />
          <stop
            offset=".33"
            stop-color="#2a3e42"
            stop-opacity=".82"
          />
          <stop
            offset="1"
            stop-color="#162326"
            stop-opacity=".58"
          />
        </linearGradient>

        <linearGradient
          id="statusFill"
          x1="0"
          y1="0"
          x2="1"
          y2="0"
        >
          <stop
            offset="0"
            stop-color="#5ee7d4"
            stop-opacity=".14"
          />
          <stop
            offset=".5"
            stop-color="#5ee7d4"
            stop-opacity=".06"
          />
          <stop
            offset="1"
            stop-color="#5ee7d4"
            stop-opacity=".14"
          />
        </linearGradient>

        <pattern
          id="microgrid"
          width="48"
          height="48"
          patternUnits="userSpaceOnUse"
        >
          <path
            d="M48 0H0V48"
            fill="none"
            stroke="#5ee7d4"
            stroke-opacity=".018"
            stroke-width="1"
          />
        </pattern>
      </defs>

      <!-- background -->
      <rect
        width="1200"
        height="1200"
        fill="#050809"
      />
      <rect
        width="1200"
        height="1200"
        fill="url(#microgrid)"
      />
      <rect
        width="1200"
        height="1200"
        fill="url(#bgGlow)"
      >
        <animate
          attributeName="opacity"
          values="0.85;1;0.85"
          dur="8s"
          repeatCount="indefinite"
        />
      </rect>

      <!-- outer certificate frame -->
      <rect
        x="68"
        y="68"
        width="1064"
        height="1064"
        rx="30"
        fill="none"
        stroke="url(#frameEdge)"
        stroke-width="2"
      />

      <line
        x1="104"
        y1="176"
        x2="1096"
        y2="176"
        stroke="#203034"
        stroke-width="2"
      />

      <!-- top identity -->
      <text
        x="104"
        y="136"
        fill="#f4f5ef"
        class="mono"
        font-size="38"
        font-weight="700"
        letter-spacing="14"
      >VINSS</text>

      <text
        x="1096"
        y="136"
        fill="#7e8c90"
        class="mono"
        font-size="14"
        text-anchor="end"
        letter-spacing="4"
      >STARKNET ${network}</text>

      <!-- status badge -->
      <g transform="translate(600 246)">
        <rect
          x="-172"
          y="-28"
          width="344"
          height="56"
          rx="28"
          fill="url(#statusFill)"
          stroke="#5ee7d4"
          stroke-opacity=".32"
        >
          <animate
            attributeName="opacity"
            values="0.88;1;0.88"
            dur="3.8s"
            repeatCount="indefinite"
          />
        </rect>

        <circle
          cx="-136"
          cy="0"
          r="6"
          fill="#5ee7d4"
        >
          <animate
            attributeName="r"
            values="6;7.5;6"
            dur="2.2s"
            repeatCount="indefinite"
          />
          <animate
            attributeName="opacity"
            values="1;.72;1"
            dur="2.2s"
            repeatCount="indefinite"
          />
        </circle>

        <text
          x="0"
          y="7"
          fill="#71ead9"
          class="mono"
          font-size="16"
          font-weight="700"
          text-anchor="middle"
          letter-spacing="4"
        >SETTLED ONCHAIN</text>
      </g>

      <!-- title -->
      <text
        x="600"
        y="360"
        fill="#f4f5ef"
        class="sans"
        font-size="72"
        font-weight="700"
        text-anchor="middle"
        letter-spacing="-1"
      >SETTLEMENT</text>

      <text
        x="600"
        y="434"
        fill="#f4f5ef"
        class="sans"
        font-size="72"
        font-weight="700"
        text-anchor="middle"
        letter-spacing="-1"
      >CERTIFICATE</text>

      <text
        x="600"
        y="492"
        fill="#7d898e"
        class="sans"
        font-size="22"
        text-anchor="middle"
      >This certifies the completion of a private</text>

      <text
        x="600"
        y="526"
        fill="#7d898e"
        class="sans"
        font-size="22"
        text-anchor="middle"
      >VINSS Rekber settlement on Starknet.</text>

      <!-- animated seal -->
      <g transform="translate(600 650)">
        <circle
          cx="0"
          cy="0"
          r="124"
          fill="url(#sealGlow)"
          opacity=".7"
        >
          <animate
            attributeName="r"
            values="118;132;118"
            dur="5.5s"
            repeatCount="indefinite"
          />
          <animate
            attributeName="opacity"
            values=".45;.82;.45"
            dur="5.5s"
            repeatCount="indefinite"
          />
        </circle>

        <g opacity=".28">
          <path
            d="M0 -118L118 0L0 118L-118 0Z"
            fill="none"
            stroke="#5ee7d4"
            stroke-width="2"
          >
            <animateTransform
              attributeName="transform"
              attributeType="XML"
              type="rotate"
              from="0 0 0"
              to="360 0 0"
              dur="28s"
              repeatCount="indefinite"
            />
          </path>
        </g>

        <g opacity=".42">
          <path
            d="M0 -82L82 0L0 82L-82 0Z"
            fill="none"
            stroke="#5ee7d4"
            stroke-width="2"
          >
            <animateTransform
              attributeName="transform"
              attributeType="XML"
              type="rotate"
              from="360 0 0"
              to="0 0 0"
              dur="20s"
              repeatCount="indefinite"
            />
          </path>
        </g>

        <circle
          cx="0"
          cy="0"
          r="38"
          fill="#0a1719"
          stroke="#5ee7d4"
          stroke-opacity=".48"
          stroke-width="2"
        >
          <animate
            attributeName="stroke-opacity"
            values=".38;.75;.38"
            dur="3.4s"
            repeatCount="indefinite"
          />
        </circle>

        <path
          d="M-22 0H22M0 -22V22"
          stroke="#5ee7d4"
          stroke-opacity=".55"
          stroke-width="2"
        />

        <circle
          cx="0"
          cy="0"
          r="7"
          fill="#5ee7d4"
        >
          <animate
            attributeName="r"
            values="6;8;6"
            dur="2.6s"
            repeatCount="indefinite"
          />
        </circle>
      </g>

      <!-- info blocks -->
      <line
        x1="160"
        y1="820"
        x2="1040"
        y2="820"
        stroke="#203034"
        stroke-width="2"
      />

      <!-- left column -->
      <text
        x="188"
        y="878"
        fill="#607075"
        class="mono"
        font-size="13"
        letter-spacing="4"
      >ROLE</text>

      <text
        x="188"
        y="922"
        fill="#f4f5ef"
        class="mono"
        font-size="28"
        font-weight="700"
        letter-spacing="3"
      >${role}</text>

      <text
        x="188"
        y="990"
        fill="#607075"
        class="mono"
        font-size="13"
        letter-spacing="4"
      >SETTLED</text>

      <text
        x="188"
        y="1034"
        fill="#f4f5ef"
        class="mono"
        font-size="24"
        font-weight="700"
        letter-spacing="2"
      >${settledAt}</text>

      <!-- right column -->
      <text
        x="712"
        y="878"
        fill="#607075"
        class="mono"
        font-size="13"
        letter-spacing="4"
      >PRIVACY LAYER</text>

      <text
        x="712"
        y="922"
        fill="#5ee7d4"
        class="mono"
        font-size="28"
        font-weight="700"
        letter-spacing="3"
      >STRK20</text>

      <text
        x="712"
        y="990"
        fill="#607075"
        class="mono"
        font-size="13"
        letter-spacing="4"
      >CERTIFICATE ID</text>

      <text
        x="712"
        y="1034"
        fill="#f4f5ef"
        class="mono"
        font-size="18"
      >#${certificateId}</text>

      <!-- bottom refs -->
      <line
        x1="104"
        y1="1072"
        x2="1096"
        y2="1072"
        stroke="#1a272a"
        stroke-width="1"
      />

      <text
        x="104"
        y="1106"
        fill="#4b5a5f"
        class="mono"
        font-size="11"
        letter-spacing="3"
      >SETTLEMENT REF</text>

      <text
        x="274"
        y="1106"
        fill="#98a3a0"
        class="mono"
        font-size="12"
      >${settlementReference}</text>

      <text
        x="1096"
        y="1106"
        fill="#6c7a7f"
        class="mono"
        font-size="11"
        text-anchor="end"
        letter-spacing="3"
      >PRIVATE TERMS OMITTED</text>
    </svg>
  `;

  return new Response(svg, {
    headers: {
      "Content-Type":
        "image/svg+xml; charset=utf-8",
      "Cache-Control":
        "public, max-age=300, s-maxage=3600",
      "X-Content-Type-Options":
        "nosniff",
    },
  });
}
