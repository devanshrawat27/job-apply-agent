import { NextResponse } from "next/server";
import { assertResumeApproved } from "@/applications/approval-gates";
import { fillVerifiedFields } from "@/browser/safe-fill";
import { appendAuditEvent, loadApplicationReview } from "@/storage/files";

export async function POST(request: Request) {
  try {
    const { applicationId, url } = await request.json();
    if (typeof applicationId !== "string" || typeof url !== "string") throw new Error("Application and form URL are required.");
    const review = await loadApplicationReview(applicationId);
    await assertResumeApproved(applicationId, review.resumeHash);
    const safeFields = review.fields.filter((field) => field.status === "verified_autofill" && field.risk === "low" && field.proposed_value);
    if (!safeFields.length) throw new Error("No verified low-risk fields are ready to fill.");
    const result = await fillVerifiedFields(url, safeFields);
    await appendAuditEvent(applicationId, "fill_verified_fields", { url, requested: safeFields.map((field) => field.field_label), filled: result.filled, skipped: result.skipped });
    return NextResponse.json({ result, message: "Only verified low-risk fields were attempted. No upload or submit action was performed." });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to fill verified fields." }, { status: 400 });
  }
}
