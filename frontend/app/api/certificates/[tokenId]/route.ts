import { NextRequest, NextResponse } from "next/server";
import { NETWORK } from "@/lib/starknet/constants";

interface RouteContext {
  params: Promise<{ tokenId: string }>;
}

function isTokenId(value: string): boolean {
  return /^(0x[0-9a-f]+|[0-9]+)$/i.test(value);
}

export async function GET(
  request: NextRequest,
  context: RouteContext,
) {
  const { tokenId } = await context.params;

  if (!isTokenId(tokenId)) {
    return NextResponse.json(
      { error: "Invalid certificate token ID." },
      { status: 400 },
    );
  }

  const origin = request.nextUrl.origin;

  return NextResponse.json(
    {
      name: `VINSS Settlement Certificate #${tokenId}`,
      description:
        "Optional public evidence self-claimed by one party after a VINSS Escrow Rekber release on Starknet. It is that wallet's acknowledgement of the public settlement record, not proof of hidden-note ownership by itself. Private messages, Offer terms, deal notes, secrets, asset and amount are omitted; public chain records may still be correlated.",
      image: `${origin}/api/certificates/${tokenId}/image`,
      external_url: `${origin}/certificate/${tokenId}`,
      attributes: [
        { trait_type: "Protocol", value: "VINSS" },
        { trait_type: "Evidence", value: "Rekber release" },
        { trait_type: "Network", value: NETWORK },
        { trait_type: "Privacy", value: "Private terms omitted" },
      ],
    },
    {
      headers: {
        "Cache-Control": "public, max-age=300, s-maxage=3600",
      },
    },
  );
}
