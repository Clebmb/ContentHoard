import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const manifestUrl = searchParams.get("manifestUrl");
  const type = searchParams.get("type");
  const id = searchParams.get("id");

  if (!manifestUrl || !type || !id) {
    return NextResponse.json({ error: "Missing required parameters" }, { status: 400 });
  }

  try {
    new URL(manifestUrl);

    const streamPath = `stream/${encodeURIComponent(type)}/${encodeURIComponent(id)}.json`;
    const streamUrl = manifestUrl.replace("manifest.json", streamPath);
    const response = await fetch(streamUrl, {
      headers: {
        Accept: "application/json",
      },
      cache: "no-store",
    });

    if (!response.ok) {
      return NextResponse.json(
        { error: `Failed to fetch stream: ${response.statusText}` },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json({
      streams: Array.isArray(data?.streams) ? data.streams : [],
    });
  } catch (error: unknown) {
    return NextResponse.json(
      {
        error: "Failed to fetch stream",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
