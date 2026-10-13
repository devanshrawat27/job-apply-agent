import { createHash, randomUUID } from "crypto";
import { mkdir, readFile, writeFile, copyFile, access } from "fs/promises";
import path from "path";
import { ApplicationReviewSchema, MasterProfileSchema, ResumeRecordSchema, type ApplicationReview, type JobAnalysis, type MasterProfile } from "@/validation/schemas";

export const projectRoot = process.cwd();
export const dataRoot = path.join(projectRoot, "data");
export const profileRoot = path.join(dataRoot, "profile");
export const applicationRoot = path.join(dataRoot, "applications");
export const draftRoot = path.join(dataRoot, "resumes", "drafts");
export const approvedRoot = path.join(dataRoot, "resumes", "approved");

export const paths = {
  masterProfile: path.join(profileRoot, "master-profile.json"),
  masterProfileMarkdown: path.join(profileRoot, "MASTER_PROFILE.md"),
};

export function hash(value: string | Buffer) {
  return createHash("sha256").update(value).digest("hex");
}

export function applicationId(company: string | null, role: string | null) {
  const base = `${company ?? "unknown"}-${role ?? "role"}`
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 60) || "application";
  return `${new Date().toISOString().slice(0, 10)}-${base}-${randomUUID().slice(0, 8)}`;
}

export async function ensureDataDirectories() {
  await Promise.all([profileRoot, applicationRoot, draftRoot, approvedRoot].map((directory) => mkdir(directory, { recursive: true })));
}

export async function fileExists(filePath: string) {
  try { await access(filePath); return true; } catch { return false; }
}

export async function loadProfile(): Promise<{ profile: MasterProfile | null; errors: string[] }> {
  if (!(await fileExists(paths.masterProfile))) return { profile: null, errors: ["master-profile.json is not installed yet."] };
  try {
    const raw = JSON.parse(await readFile(paths.masterProfile, "utf8"));
    const parsed = MasterProfileSchema.safeParse(raw);
    if (!parsed.success) return { profile: null, errors: parsed.error.issues.map((issue) => `${issue.path.join(".") || "profile"}: ${issue.message}`) };
    return { profile: parsed.data, errors: [] };
  } catch (error) {
    return { profile: null, errors: [error instanceof Error ? error.message : "Unable to read profile JSON."] };
  }
}

export async function saveJobAnalysis(job: JobAnalysis) {
  const directory = path.join(applicationRoot, job.id);
  await mkdir(directory, { recursive: true });
  await writeFile(path.join(directory, "job-description.md"), job.description, "utf8");
  await writeFile(path.join(directory, "job-analysis.json"), JSON.stringify(job, null, 2), "utf8");
  await writeFile(path.join(directory, "status.json"), JSON.stringify({ status: "analyzed", updatedAt: new Date().toISOString() }, null, 2), "utf8");
}

export async function saveResumeRecord(record: ReturnType<typeof ResumeRecordSchema.parse>) {
  const directory = path.join(applicationRoot, record.applicationId);
  await mkdir(directory, { recursive: true });
  await writeFile(path.join(directory, "resume-record.json"), JSON.stringify(record, null, 2), "utf8");
}

export async function loadResumeRecord(applicationId: string) {
  const raw = await readFile(path.join(applicationRoot, applicationId, "resume-record.json"), "utf8");
  return ResumeRecordSchema.parse(JSON.parse(raw));
}

export async function saveApplicationReview(review: ApplicationReview) {
  const directory = path.join(applicationRoot, review.applicationId);
  await mkdir(directory, { recursive: true });
  await writeFile(path.join(directory, "application-review.json"), JSON.stringify(review, null, 2), "utf8");
  await writeFile(path.join(directory, "fields-detected.json"), JSON.stringify(review.fields, null, 2), "utf8");
  await writeFile(path.join(directory, "status.json"), JSON.stringify({ status: "ready_for_review", reviewHash: review.reviewHash, resumeHash: review.resumeHash, updatedAt: new Date().toISOString() }, null, 2), "utf8");
  return review;
}

export async function loadApplicationReview(applicationId: string) {
  const raw = await readFile(path.join(applicationRoot, applicationId, "application-review.json"), "utf8");
  return ApplicationReviewSchema.parse(JSON.parse(raw));
}

export async function updateApplicationReview(applicationId: string, fields: ApplicationReview["fields"], coverLetter = "") {
  const current = await loadApplicationReview(applicationId);
  const nextHash = hash(JSON.stringify({ applicationId, resumeHash: current.resumeHash, fields, coverLetter }));
  return saveApplicationReview({ ...current, fields, coverLetter, reviewHash: nextHash, createdAt: new Date().toISOString() });
}

export async function appendAuditEvent(applicationId: string, action: string, details: Record<string, unknown>) {
  const directory = path.join(applicationRoot, applicationId);
  await mkdir(directory, { recursive: true });
  const auditPath = path.join(directory, "audit.jsonl");
  const line = JSON.stringify({ action, details, createdAt: new Date().toISOString() }) + "\n";
  await writeFile(auditPath, line, { encoding: "utf8", flag: "a" });
}

export async function approveFinalApplication(applicationId: string, reviewHash: string) {
  const review = await loadApplicationReview(applicationId);
  if (review.reviewHash !== reviewHash) throw new Error("The application review changed. Review the current version again.");
  const unresolved = review.fields.filter((field) => ["needs_user_input", "proposed_for_review", "blocked"].includes(field.status));
  if (unresolved.length) throw new Error(`Final approval is blocked: ${unresolved.length} field(s) still need review or user input.`);
  const directory = path.join(applicationRoot, applicationId);
  const status = { status: "ready_for_submission", reviewHash, resumeHash: review.resumeHash, finalApprovalAt: new Date().toISOString(), submitClickEnabled: false };
  await writeFile(path.join(directory, "status.json"), JSON.stringify(status, null, 2), "utf8");
  return status;
}

export async function approveResume(applicationId: string, contentHash: string) {
  const record = await loadResumeRecord(applicationId);
  if (record.contentHash !== contentHash) throw new Error("The resume has changed. Review and approve the current version instead.");
  const bytes = await readFile(record.pdfPath);
  if (hash(bytes) !== contentHash) throw new Error("The draft PDF no longer matches its reviewed version.");
  await mkdir(approvedRoot, { recursive: true });
  const approvedPath = path.join(approvedRoot, record.fileName.replace("_DRAFT", "_APPROVED"));
  await copyFile(record.pdfPath, approvedPath);
  const directory = path.join(applicationRoot, applicationId);
  await writeFile(path.join(directory, "status.json"), JSON.stringify({ status: "resume_approved", resumeHash: contentHash, approvedPath, approvedAt: new Date().toISOString() }, null, 2), "utf8");
  return { ...record, approvedPath };
}
