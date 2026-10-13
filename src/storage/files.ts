import { createHash, randomUUID } from "crypto";
import { mkdir, readFile, writeFile, copyFile, access } from "fs/promises";
import path from "path";
import { MasterProfileSchema, ResumeRecordSchema, type JobAnalysis, type MasterProfile } from "@/validation/schemas";

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
