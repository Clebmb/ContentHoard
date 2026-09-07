import { NextResponse } from "next/server";

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

    const extra = new URLSearchParams();
    const videoId = searchParams.get("videoID");
    const videoSize = searchParams.get("videoSize");

    if (videoId) {
      extra.set("videoID", videoId);
    }

    if (videoSize) {
      extra.set("videoSize", videoSize);
    }

    let subtitlesPath = `subtitles/${encodeURIComponent(type)}/${encodeURIComponent(id)}`;
    if (extra.size > 0) {
      subtitlesPath += `/${extra.toString()}`;
    }

    const subtitlesUrl = manifestUrl.replace("manifest.json", `${subtitlesPath}.json`);
    const response = await fetch(subtitlesUrl, {
      headers: {
        Accept: "application/json",
      },
      cache: "no-store",
    });

    if (!response.ok) {
      return NextResponse.json(
        { error: `Failed to fetch subtitles: ${response.statusText}` },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json({
      subtitles: Array.isArray(data.subtitles) ? data.subtitles : [],
    });
  } catch (error: unknown) {
    return NextResponse.json(
      {
        error: "Failed to fetch subtitles",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
