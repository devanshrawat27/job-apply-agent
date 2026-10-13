import { mkdir, rm, writeFile } from "fs/promises";
import path from "path";
import { afterEach, describe, expect, it } from "vitest";
import { applicationRoot } from "@/storage/files";
import { assertFinalSubmissionAllowed, browserSubmissionPolicy } from "./approval-gates";

const id = "approval-gate-test";
const folder = path.join(applicationRoot, id);
afterEach(async () => { await rm(folder, { recursive: true, force: true }); });

describe("final submission gate", () => {
  it("rejects every status except separately approved current review", async () => {
    await mkdir(folder, { recursive: true });
    await writeFile(path.join(folder, "status.json"), JSON.stringify({ status: "resume_approved", resumeHash: "pdf-hash" }));
    await expect(assertFinalSubmissionAllowed(id, "review-hash")).rejects.toThrow("Submission is blocked");
    expect(browserSubmissionPolicy.allowsSubmitClick).toBe(false);
  });
});
