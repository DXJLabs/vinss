import { NextRequest } from "next/server";
import { GET as certificateMetadata } from "@/app/api/certificates/[tokenId]/route";
/** Public certificate contracts use this base URI so NFT links preserve their rail. */
export async function GET(request: NextRequest, context: { params: Promise<{ tokenId: string }> }) {
  const url = request.nextUrl.clone();
  url.searchParams.set("rail", "unshield");
  return certificateMetadata(new NextRequest(url, request), context);
}
