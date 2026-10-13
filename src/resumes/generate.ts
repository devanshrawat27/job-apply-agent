import { createHash } from "crypto";
import { writeFile, readFile } from "fs/promises";
import path from "path";
import { chromium } from "playwright";
import { draftRoot, ensureDataDirectories, hash, saveResumeRecord } from "@/storage/files";
import type { JobAnalysis, MasterProfile } from "@/validation/schemas";

const escapeHtml = (value: string) => value.replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" })[character] ?? character);
const known = (value: string | undefined) => value && value !== "UNKNOWN" ? value : "";

function itemHtml(item: { title: string; organization?: string; date_range?: string; description?: string; highlights: string[] }) {
  const bullets = [known(item.description), ...item.highlights.filter((bullet) => bullet !== "UNKNOWN")].filter(Boolean);
  return `<article><div class="entry-head"><strong>${escapeHtml(item.title)}</strong><strong>${escapeHtml(known(item.date_range))}</strong></div>${known(item.organization) ? `<div class="entry-sub"><em>${escapeHtml(item.organization ?? "")}</em></div>` : ""}${bullets.length ? `<ul>${bullets.map((bullet) => `<li>${escapeHtml(bullet)}</li>`).join("")}</ul>` : ""}</article>`;
}

function resumeHtml(profile: MasterProfile, job: JobAnalysis) {
  const roleLabel = [job.role, job.company].filter(Boolean).join(" - ");
  return `<!doctype html><html><head><meta charset="utf-8"><style>
    @page { size: Letter; margin: 0.35in 0.55in 0.42in; }
    * { box-sizing: border-box; } body { font-family: Arial, Helvetica, sans-serif; color: #111827; font-size: 9.35pt; line-height: 1.18; margin: 0; } h1 { font-size: 25pt; line-height: 1; letter-spacing: .1px; margin: 0 0 5px; text-align: center; font-variant: small-caps; } .contact { text-align: center; font-size: 8.7pt; margin: 0 0 7px; } .contact a { color: inherit; text-decoration: underline; } h2 { color: #b42318; font-size: 12pt; font-weight: 400; border-bottom: 1px solid #b42318; padding-bottom: 2px; margin: 9px 0 4px; } p { margin: 0; } article { margin: 0 0 5px; break-inside: avoid; } .entry-head { display: flex; justify-content: space-between; gap: 18px; line-height: 1.12; } .entry-head strong:last-child { white-space: nowrap; } .entry-sub { margin-top: 1px; } ul { margin: 2px 0 0 15px; padding: 0; } li { margin-bottom: 1px; padding-left: 1px; } .skills { line-height: 1.28; } .skills strong { font-weight: 700; } .tailored { display: none; }
  </style></head><body>
  <h1>${escapeHtml(profile.identity.full_name)}</h1>
  <p class="contact">${escapeHtml([known(profile.identity.phone), known(profile.identity.email), ...profile.identity.links].filter(Boolean).join("   |   "))}</p>
  ${profile.education.length ? `<h2>Education</h2>${profile.education.map(itemHtml).join("")}` : ""}
  ${profile.experience.length ? `<h2>Experience</h2>${profile.experience.map(itemHtml).join("")}` : ""}
  ${profile.projects.length ? `<h2>Projects</h2>${profile.projects.map(itemHtml).join("")}` : ""}
  ${profile.skills.length ? `<h2>Technical Skills</h2><div class="skills"><strong>Skills:</strong> ${profile.skills.filter((skill) => skill !== "UNKNOWN").map((skill) => escapeHtml(skill)).join(", ")}</div>` : ""}
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
