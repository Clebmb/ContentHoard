import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
    const scope = request.nextUrl.searchParams.get("scope") || "debug";
    const message = request.nextUrl.searchParams.get("message") || "";
    const data = request.nextUrl.searchParams.get("data") || "";

    console.info(`[${scope}] ${message}${data ? ` ${data}` : ""}`);

    return NextResponse.json({ ok: true });
}
