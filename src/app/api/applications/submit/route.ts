import { NextResponse } from "next/server";
import { assertFinalSubmissionAllowed, browserSubmissionPolicy } from "@/applications/approval-gates";
import { clickSubmitAfterReview } from "@/browser/session";
import { appendAuditEvent, updateApplicationStatus } from "@/storage/files";
import { SubmitApplicationRequestSchema } from "@/validation/schemas";

export async function POST(request: Request) {
  try {
    const input = SubmitApplicationRequestSchema.parse(await request.json());
    await assertFinalSubmissionAllowed(input.applicationId, input.reviewHash);
    if (!browserSubmissionPolicy.allowsSubmitClick) throw new Error("Submit click is disabled. Set ALLOW_BROWSER_SUBMIT=true only after reviewing the live form and confirming you want this behavior.");
    const result = await clickSubmitAfterReview();
    await updateApplicationStatus(input.applicationId, "submitted", "Verify the confirmation page and record evidence.");
    await appendAuditEvent(input.applicationId, "submit_clicked_after_final_approval", { url: result.url, title: result.title, reviewHash: input.reviewHash });
    return NextResponse.json({ submitted: true, result, message: "Submit button clicked after final approval. Verify the confirmation page manually." });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to submit the application." }, { status: 400 });
  }
}
