import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const addonUrl = searchParams.get("url");

  if (!addonUrl) {
    return NextResponse.json({ error: "Missing addon URL" }, { status: 400 });
  }

  try {
    // Basic validation to ensure it's a valid URL
    new URL(addonUrl);

    // Fetch the manifest
    const response = await fetch(addonUrl, {
      headers: {
        "Accept": "application/json",
      },
      // Stremio addons might be slow, add a reasonable timeout if possible 
      // (Next.js fetch doesn't natively support timeout in the same way, but standard abort controller can be used if needed)
    });

    if (!response.ok) {
      return NextResponse.json(
        { error: `Failed to fetch manifest: ${response.statusText}` },
        { status: response.status }
      );
    }

    const manifest = await response.json();

    // Nuvio uses Stremio-compatible addon manifests, so validate the shared shape.
    if (!manifest.id || !manifest.name || !manifest.version) {
      return NextResponse.json(
        { error: "Invalid Stremio/Nuvio-compatible manifest format" },
        { status: 400 }
      );
    }

    return NextResponse.json(manifest);
  } catch (error: unknown) {
    console.error("Error fetching addon manifest:", error);
    return NextResponse.json(
      {
        error: "Failed to parse or fetch addon manifest",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
