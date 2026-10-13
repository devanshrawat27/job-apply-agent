import { NextResponse } from "next/server";
import { assertResumeApproved } from "@/applications/approval-gates";
import { uploadResumeFile } from "@/browser/session";
import { appendAuditEvent, loadResumeRecord } from "@/storage/files";
import { ResumeUploadRequestSchema } from "@/validation/schemas";

export async function POST(request: Request) {
  try {
    const input = ResumeUploadRequestSchema.parse(await request.json());
    const record = await loadResumeRecord(input.applicationId);
    await assertResumeApproved(input.applicationId, input.resumeHash);
    if (record.contentHash !== input.resumeHash) throw new Error("The requested upload hash does not match the stored resume.");
    const result = await uploadResumeFile(record.pdfPath);
    await appendAuditEvent(input.applicationId, "upload_approved_resume", { url: result.url, fileName: result.fileName, resumeHash: input.resumeHash });
    return NextResponse.json({ uploaded: true, result, message: "Approved resume selected in the browser. Review the page before any further action." });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to upload the approved resume." }, { status: 400 });
  }
}
