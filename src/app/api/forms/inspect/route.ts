import { NextResponse } from "next/server";
import { inspectApplicationForm } from "@/browser/form-inspector";

export async function POST(request: Request) {
  try {
    const { url } = await request.json();
    const parsed = new URL(url);
    if (!/^https?:$/.test(parsed.protocol)) throw new Error("Provide an http(s) application URL.");
    const fields = await inspectApplicationForm(parsed.toString());
    return NextResponse.json({ fields, notice: "Inspection only: no values, files, uploads, or submit actions were performed." });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to inspect the form." }, { status: 400 });
  }
}
