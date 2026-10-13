import { createHash } from "crypto";
import { writeFile, readFile } from "fs/promises";
import path from "path";
import { chromium } from "playwright";
import { draftRoot, ensureDataDirectories, hash, saveResumeRecord } from "@/storage/files";
import type { JobAnalysis, MasterProfile } from "@/validation/schemas";

const escapeHtml = (value: string) => value.replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" })[character] ?? character);
const known = (value: string | undefined) => value && value !== "UNKNOWN" ? value : "";

function itemHtml(item: { title: string; organization?: string; date_range?: string; description?: string; highlights: string[] }) {
  const heading = [item.title, known(item.organization), known(item.date_range)].filter(Boolean).join(" | ");
  const bullets = [known(item.description), ...item.highlights.filter((bullet) => bullet !== "UNKNOWN")].filter(Boolean);
  return `<article><strong>${escapeHtml(heading)}</strong>${bullets.length ? `<ul>${bullets.map((bullet) => `<li>${escapeHtml(bullet)}</li>`).join("")}</ul>` : ""}</article>`;
}

function resumeHtml(profile: MasterProfile, job: JobAnalysis) {
  const roleLabel = [job.role, job.company].filter(Boolean).join(" - ");
  return `<!doctype html><html><head><meta charset="utf-8"><style>
    @page { size: A4; margin: 14mm 16mm; }
    * { box-sizing: border-box; } body { font-family: Arial, Helvetica, sans-serif; color: #172033; font-size: 10.2pt; line-height: 1.36; }
    h1 { font-size: 22pt; letter-spacing: -.35px; margin: 0 0 2px; } .contact { color: #435065; margin-bottom: 11px; } h2 { color: #155e75; text-transform: uppercase; letter-spacing: 1.1px; font-size: 10pt; border-bottom: 1px solid #cbd5e1; padding-bottom: 3px; margin: 12px 0 6px; } p { margin: 0; } article { margin: 0 0 7px; } ul { margin: 3px 0 0 16px; padding: 0; } li { margin-bottom: 2px; } .skills { display: flex; flex-wrap: wrap; gap: 4px 8px; } .skills span { background: #e8f4f8; border-radius: 3px; padding: 2px 5px; } .tailored { font-size: 8.5pt; color: #64748b; margin-top: 8px; }
  </style></head><body>
  <h1>${escapeHtml(profile.identity.full_name)}</h1>
  <p class="contact">${escapeHtml([known(profile.identity.location), known(profile.identity.email), known(profile.identity.phone), ...profile.identity.links].filter(Boolean).join(" | "))}</p>
  ${known(profile.summary) ? `<h2>Professional Summary</h2><p>${escapeHtml(profile.summary)}</p>` : ""}
  ${profile.experience.length ? `<h2>Experience</h2>${profile.experience.map(itemHtml).join("")}` : ""}
  ${profile.projects.length ? `<h2>Projects</h2>${profile.projects.map(itemHtml).join("")}` : ""}
  ${profile.education.length ? `<h2>Education</h2>${profile.education.map(itemHtml).join("")}` : ""}
  ${profile.skills.length ? `<h2>Skills</h2><div class="skills">${profile.skills.filter((skill) => skill !== "UNKNOWN").map((skill) => `<span>${escapeHtml(skill)}</span>`).join("")}</div>` : ""}
  <p class="tailored">Draft generated for ${escapeHtml(roleLabel || "this role")}. Only verified profile content is included.</p>
  </body></html>`;
}

export async function generateResume(profile: MasterProfile, job: JobAnalysis) {
  await ensureDataDirectories();
  const company = (job.company ?? "Company").replace(/[^a-z0-9]+/gi, "_");
  const role = (job.role ?? "Role").replace(/[^a-z0-9]+/gi, "_");
  const candidate = profile.identity.full_name.replace(/[^a-z0-9]+/gi, "_");
  const versionSeed = createHash("sha256").update(`${job.id}:${job.description}:${JSON.stringify(profile)}`).digest("hex").slice(0, 10);
  const fileName = `${candidate}_${company}_${role}_Resume_DRAFT_${versionSeed}.pdf`;
  const htmlPath = path.join(draftRoot, fileName.replace(/\.pdf$/, ".html"));
  const pdfPath = path.join(draftRoot, fileName);
  const html = resumeHtml(profile, job);
  await writeFile(htmlPath, html, "utf8");
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "load" });
    await page.pdf({ path: pdfPath, format: "A4", printBackground: true, margin: { top: "0mm", bottom: "0mm", left: "0mm", right: "0mm" } });
  } finally {
    await browser.close();
  }
  const contentHash = hash(await readFile(pdfPath));
  const record = { applicationId: job.id, fileName, htmlPath, pdfPath, contentHash, version: versionSeed, generatedAt: new Date().toISOString(), changeSummary: ["Generated from the verified local profile pack.", `Target role: ${job.role ?? "not identified"}.`, "No unsupported skills, dates, metrics, or claims were added."] };
  await saveResumeRecord(record);
  return record;
}
