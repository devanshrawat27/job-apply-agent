import { NextResponse } from "next/server";
import { createHash } from "crypto";
import { assertResumeApproved } from "@/applications/approval-gates";
import { fillVerifiedFields } from "@/browser/safe-fill";
import { appendAuditEvent, loadApplicationReview, saveApplicationReview } from "@/storage/files";

export async function POST(request: Request) {
  try {
    const { applicationId, url } = await request.json();
    if (typeof applicationId !== "string" || typeof url !== "string") throw new Error("Application and form URL are required.");
    const review = await loadApplicationReview(applicationId);
    await assertResumeApproved(applicationId, review.resumeHash);
    const safeFields = review.fields.filter((field) => field.status === "verified_autofill" && field.risk === "low" && field.proposed_value);
    if (!safeFields.length) throw new Error("No verified low-risk fields are ready to fill.");
    const result = await fillVerifiedFields(url, safeFields);
    const verifiedLabels = new Set(result.verified.map((item) => item.label));
    const updatedFields = review.fields.map((field) => verifiedLabels.has(field.field_label) ? { ...field, status: "filled_verified" as const, reason: "Browser value matched the approved profile answer after filling." } : field);
    const updatedReview = await saveApplicationReview({ ...review, fields: updatedFields, reviewHash: createHash("sha256").update(JSON.stringify({ applicationId, resumeHash: review.resumeHash, fields: updatedFields, coverLetter: review.coverLetter })).digest("hex"), createdAt: new Date().toISOString() });
    await appendAuditEvent(applicationId, "fill_verified_fields", { url, requested: safeFields.map((field) => field.field_label), verified: result.verified, skipped: result.skipped });
    return NextResponse.json({ result, reviewHash: updatedReview.reviewHash, message: "Only verified low-risk fields were attempted. Matching values were verified after entry; no upload or submit action was performed." });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to fill verified fields." }, { status: 400 });
  }
}
