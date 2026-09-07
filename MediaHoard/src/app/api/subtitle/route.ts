const srtTimestampPattern = /(\d{2}:\d{2}:\d{2}),(\d{3})/g;

const looksLikeSrt = (contentType: string | null, url: string, body: string) => {
    const lowerUrl = url.toLowerCase();
    return (
        lowerUrl.endsWith(".srt") ||
        contentType?.includes("subrip") ||
        contentType?.includes("srt") ||
        /^\d+\s*\r?\n\d{2}:\d{2}:\d{2},\d{3}\s+-->/.test(body)
    );
};

const convertSrtToVtt = (body: string) => {
    const normalized = body.replace(/^\uFEFF/, "");
    return `WEBVTT\n\n${normalized.replace(srtTimestampPattern, "$1.$2")}`;
};

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const targetUrl = searchParams.get("url");

    if (!targetUrl) {
        return new Response("Missing subtitle url", { status: 400 });
    }

    let upstream: Response;

    try {
        upstream = await fetch(targetUrl, {
            headers: {
                "user-agent": "MediaHoard Subtitle Proxy",
            },
            cache: "no-store",
        });
    } catch {
        return new Response("Failed to fetch subtitle", { status: 502 });
    }

    if (!upstream.ok) {
        return new Response("Subtitle source unavailable", { status: upstream.status });
    }

    const body = await upstream.text();
    const contentType = upstream.headers.get("content-type");
    const payload = looksLikeSrt(contentType, targetUrl, body) ? convertSrtToVtt(body) : body;

    return new Response(payload, {
        status: 200,
        headers: {
            "content-type": "text/vtt; charset=utf-8",
            "cache-control": "no-store",
        },
    });
}
