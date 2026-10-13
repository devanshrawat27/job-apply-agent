import { NextResponse } from "next/server";
import { openManualSession } from "@/browser/session";

export async function POST(request: Request) {
  try {
    const { url } = await request.json();
    const parsed = new URL(url);
    if (!/^https?:$/.test(parsed.protocol)) throw new Error("Provide an http(s) URL.");
    const session = await openManualSession(parsed.toString());
    return NextResponse.json({ session, message: "A dedicated Playwright browser opened. Complete login/MFA/CAPTCHA manually, then return here for inspection." });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to open browser session." }, { status: 400 });
  }
}
