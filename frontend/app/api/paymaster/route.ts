const PAYMASTER = "https://sepolia.paymaster.avnu.fi";

export async function POST(req: Request) {
  const key = process.env.AVNU_PAYMASTER_API_KEY;

  if (!key) {
    return Response.json(
      { error: "AVNU_PAYMASTER_API_KEY is not configured" },
      { status: 503 },
    );
  }

  const upstream = await fetch(PAYMASTER, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      "x-paymaster-api-key": key,
    },
    body: await req.text(),
  });

  return new Response(upstream.body, {
    status: upstream.status,
    headers: {
      "Content-Type":
        upstream.headers.get("content-type") ?? "application/json",
      "Cache-Control": "no-store",
    },
  });
}
