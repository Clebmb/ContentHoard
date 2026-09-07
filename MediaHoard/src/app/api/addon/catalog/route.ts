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
    const skip = searchParams.get("skip");
    const extra = searchParams.get("extra"); // Support for other search params

    // Basic validation
    new URL(manifestUrl);

    // Construct the catalog URL
    // Stremio convention: replace manifest.json with catalog/{type}/{id}.json
    // For pagination: catalog/{type}/{id}/skip={skip}.json
    let catalogPath = `catalog/${encodeURIComponent(type)}/${encodeURIComponent(id)}`;
    
    // Add extra params if any (like search=...)
    if (extra) {
      catalogPath += `/${extra}`;
    }

    if (skip && skip !== "0") {
      catalogPath += `/skip=${skip}`;
    }
    
    let catalogUrl = manifestUrl.replace("manifest.json", `${catalogPath}.json`);

    const response = await fetch(catalogUrl, {
      headers: {
        "Accept": "application/json",
      },
    });

    if (!response.ok) {
      return NextResponse.json(
        { error: `Failed to fetch catalog: ${response.statusText}` },
        { status: response.status }
      );
    }

    const data = await response.json();

    if (!data.metas || !Array.isArray(data.metas)) {
      return NextResponse.json(
        { error: "Invalid catalog format, missing 'metas' array" },
        { status: 400 }
      );
    }

    return NextResponse.json(data);
  } catch (error: any) {
    console.error("Error fetching catalog:", error);
    return NextResponse.json(
      { error: "Failed to fetch catalog", details: error.message },
      { status: 500 }
    );
  }
}
