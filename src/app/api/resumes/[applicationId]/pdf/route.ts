import { readFile } from "fs/promises";
import { NextResponse } from "next/server";
import { loadResumeRecord } from "@/storage/files";

export async function GET(_: Request, context: { params: Promise<{ applicationId: string }> }) {
  try {
    const { applicationId } = await context.params;
    const record = await loadResumeRecord(applicationId);
    const pdf = await readFile(record.pdfPath);
    return new NextResponse(pdf, { headers: { "Content-Type": "application/pdf", "Content-Disposition": `inline; filename="${record.fileName}"`, "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "Resume preview not found." }, { status: 404 });
  }
}
