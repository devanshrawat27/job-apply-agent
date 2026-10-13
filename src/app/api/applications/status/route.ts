import { readFile } from "fs/promises";
import { NextResponse } from "next/server";
import path from "path";
import { applicationRoot, updateApplicationStatus } from "@/storage/files";
import { StatusUpdateSchema } from "@/validation/schemas";

export async function GET(request: Request) {
  const applicationId = new URL(request.url).searchParams.get("applicationId");
  if (!applicationId) return NextResponse.json({ error: "applicationId is required." }, { status: 400 });
  try { return NextResponse.json(JSON.parse(await readFile(path.join(applicationRoot, applicationId, "status.json"), "utf8"))); }
  catch { return NextResponse.json({ error: "Application status not found." }, { status: 404 }); }
}

export async function POST(request: Request) {
  try { const input = StatusUpdateSchema.parse(await request.json()); return NextResponse.json(await updateApplicationStatus(input.applicationId, input.status, input.nextAction)); }
  catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to update application status." }, { status: 400 }); }
}
