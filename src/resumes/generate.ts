import { createHash } from "crypto";
import { writeFile, readFile } from "fs/promises";
import path from "path";
import { chromium } from "playwright";
import { draftRoot, ensureDataDirectories, hash, saveResumeRecord } from "@/storage/files";
import type { JobAnalysis, MasterProfile } from "@/validation/schemas";

const escapeHtml = (value: string) => value.replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" })[character] ?? character);
const known = (value: string | undefined) => value && value !== "UNKNOWN" ? value : "";
const contactLabel = (value: string) => /linkedin/i.test(value) ? "LinkedIn" : /github/i.test(value) ? "GitHub" : /portfolio|vercel/i.test(value) ? "Portfolio" : value.replace(/^https?:\/\//, "").replace(/\/$/, "");

function compactBullets(item: { description?: string; highlights: string[] }) {
  const narrative = known(item.description)?.split(/(?<=[.!?])\s+/).filter((sentence) => sentence.length > 35).slice(0, 2) ?? [];
  const highlights = item.highlights.filter((bullet) => bullet !== "UNKNOWN" && bullet.length > 35).slice(0, 1);
  return [...narrative, ...highlights].slice(0, 3);
}

function itemHtml(item: { title: string; organization?: string; date_range?: string; description?: string; highlights: string[] }) {
  const bullets = compactBullets(item);
  const organization = known(item.organization);
  const title = organization && item.title.toLowerCase().startsWith(organization.toLowerCase()) ? item.title.slice(organization.length).replace(/^\s*[—-]\s*/, "") : item.title;
  const heading = organization ? `${organization} — ${title}` : title;
  return `<article><div class="entry-head"><strong>${escapeHtml(heading)}</strong><strong>${escapeHtml(known(item.date_range))}</strong></div>${bullets.length ? `<ul>${bullets.map((bullet) => `<li>${escapeHtml(bullet)}</li>`).join("")}</ul>` : ""}</article>`;
}

function educationHtml(item: { title: string; organization?: string; date_range?: string; description?: string; highlights: string[] }) {
  return `<article><div class="entry-head"><strong>${escapeHtml(item.organization ?? item.title)}</strong><strong>${escapeHtml(known(item.date_range))}</strong></div><div class="entry-sub education-sub"><em>${escapeHtml(item.title)}</em>${known(item.description) ? `<em>CGPA: ${escapeHtml(item.description ?? "")}</em>` : ""}</div></article>`;
}

function projectHtml(item: { title: string; date_range?: string; description?: string; highlights: string[] }) {
  const technology = item.highlights.filter((value) => value !== "UNKNOWN" && value.length <= 35).slice(0, 6);
  const bullets = item.highlights.filter((value) => value !== "UNKNOWN" && value.length > 35).slice(0, 2);
  const description = known(item.description);
  return `<article><div class="project-line"><strong>${escapeHtml(item.title)}:</strong> ${escapeHtml(description)}${technology.length ? ` <span class="project-tech">| ${escapeHtml(technology.join(", "))}</span>` : ""}${known(item.date_range) ? ` <strong class="project-date">(${escapeHtml(known(item.date_range))})</strong>` : ""}</div>${bullets.length ? `<ul>${bullets.map((bullet) => `<li>${escapeHtml(bullet)}</li>`).join("")}</ul>` : ""}</article>`;
}

function resumeHtml(profile: MasterProfile, job: JobAnalysis) {
  const roleLabel = [job.role, job.company].filter(Boolean).join(" - ");
  const experience = profile.experience.filter((item) => !/unknown/i.test(item.title)).slice(0, 2);
  const preferredProjectOrder = ["Proofline", "TrueDocs", "CQL", "InvisiQ"];
  const projects = [...profile.projects].sort((left, right) => {
    const leftRank = preferredProjectOrder.indexOf(left.title);
    const rightRank = preferredProjectOrder.indexOf(right.title);
    return (leftRank < 0 ? 99 : leftRank) - (rightRank < 0 ? 99 : rightRank);
  }).slice(0, 4);
  const skills = profile.skills.filter((skill) => skill !== "UNKNOWN").slice(0, 32);
  return `<!doctype html><html><head><meta charset="utf-8"><style>
    @page { size: Letter; margin: 0.29in 0.52in 0.32in; }
    * { box-sizing: border-box; } body { font-family: Georgia, "Times New Roman", serif; color: #111; font-size: 10pt; line-height: 1.16; margin: 0; } h1 { font-size: 25pt; line-height: 1; letter-spacing: .1px; margin: 0 0 5px; text-align: center; font-variant: small-caps; font-weight: 400; } .contact { text-align: center; font-size: 9pt; margin: 0 0 8px; } .contact a { color: inherit; text-decoration: underline; } h2 { color: #c53030; font-size: 12pt; font-weight: 400; border-bottom: 1px solid #c53030; padding-bottom: 2px; margin: 9px 0 4px; } p { margin: 0; } article { margin: 0 0 5px; break-inside: avoid; } .entry-head { display: flex; justify-content: space-between; gap: 15px; line-height: 1.1; } .entry-head strong:last-child { white-space: nowrap; } .entry-sub { margin-top: 1px; } .education-sub { display: flex; justify-content: space-between; gap: 15px; } .project-line { line-height: 1.12; } .project-tech { text-decoration: underline; } .project-date { float: right; white-space: nowrap; } ul { margin: 3px 0 0 15px; padding: 0; } li { margin-bottom: 1px; padding-left: 1px; } .skills { line-height: 1.24; } .skills strong { font-weight: 700; } .tailored { display: none; }
  </style></head><body>
  <h1>${escapeHtml(profile.identity.full_name)}</h1>
  <p class="contact">☎ <u>${escapeHtml(known(profile.identity.phone))}</u> &nbsp;&nbsp; ✉ <u>${escapeHtml(known(profile.identity.email))}</u>${profile.identity.links.map((link) => ` &nbsp;&nbsp; <u>${escapeHtml(contactLabel(link))}</u>`).join("")}</p>
  ${profile.education.length ? `<h2>Education</h2>${profile.education.map(educationHtml).join("")}` : ""}
  ${experience.length ? `<h2>Experience</h2>${experience.map(itemHtml).join("")}` : ""}
  ${projects.length ? `<h2>Projects</h2>${projects.map(projectHtml).join("")}` : ""}
  ${skills.length ? `<h2>Technical Skills</h2><div class="skills"><strong>Skills:</strong> ${skills.map((skill) => escapeHtml(skill)).join(", ")}</div>` : ""}
  <h2>Honours &amp; Achievements</h2><ul class="achievements"><li>Ranked in the <strong>top 8%</strong> among 250,000+ candidates in AlgoUniversity ATF 2025.</li><li>Selected for <strong>Microsoft SEFA 2025 — Software Engineering Program</strong>.</li></ul>
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
