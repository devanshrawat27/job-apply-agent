import { readFile } from "fs/promises";
import path from "path";
import { applicationRoot } from "@/storage/files";

export async function assertResumeApproved(applicationId: string, resumeHash: string) {
  const status = JSON.parse(await readFile(path.join(applicationRoot, applicationId, "status.json"), "utf8"));
  if (status.status !== "resume_approved" || status.resumeHash !== resumeHash) {
    throw new Error("Resume upload is blocked until this exact PDF version is explicitly approved.");
  }
  return status;
}

export async function assertFinalSubmissionAllowed(applicationId: string, reviewHash: string) {
  const status = JSON.parse(await readFile(path.join(applicationRoot, applicationId, "status.json"), "utf8"));
  if (status.status !== "ready_for_submission" || status.reviewHash !== reviewHash || !status.finalApprovalAt) {
    throw new Error("Submission is blocked until the current application review receives separate explicit approval.");
  }
  return status;
}

/** Deliberately does not click Submit. Browser submission is enabled only after the gate above passes. */
export const browserSubmissionPolicy = { allowsSubmitClick: false } as const;
