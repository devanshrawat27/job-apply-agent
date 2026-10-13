import { createHash } from "crypto";
import { writeFile, readFile } from "fs/promises";
import path from "path";
import { chromium } from "playwright";
import { draftRoot, ensureDataDirectories, hash, saveResumeRecord } from "@/storage/files";
import type { JobAnalysis, MasterProfile } from "@/validation/schemas";

const escapeHtml = (value: string) => value.replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" })[character] ?? character);
const known = (value: string | undefined) => value && value !== "UNKNOWN" ? value : "";
const contactLabel = (value: string) => /linkedin/i.test(value) ? "LinkedIn" : /github/i.test(value) ? "GitHub" : /portfolio|vercel/i.test(value) ? "Portfolio" : value.replace(/^https?:\/\//, "").replace(/\/$/, "");
const escapeLatex = (value: string) => value.replace(/[&%$#_{}~^\\]/g, (character) => ({ "&": "\\&", "%": "\\%", "$": "\\$", "#": "\\#", "_": "\\_", "{": "\\{", "}": "\\}", "~": "\\textasciitilde{}", "^": "\\textasciicircum{}", "\\": "\\textbackslash{}" })[character] ?? character);

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
  const verifiedBullets: Record<string, string[]> = {
    Proofline: ["Developing a multi-tenant B2B platform using a NestJS REST API, Next.js frontend, and PostgreSQL/Prisma data layer.", "Implemented server-side authorization across four organization roles, HttpOnly session authentication, password hashing, and invitation workflows.", "Added request validation, security headers, health checks, CI validation, and unit tests for authentication and role-permission policies."],
    TrueDocs: ["Developed a document question-answering workflow combining retrieval-augmented generation (RAG) with knowledge-graph relationships.", "Integrated Qdrant vector search with a FastAPI backend and Next.js interface to retrieve relevant context for document queries."],
    CQL: ["Built a Python query-processing tool with a lexer, recursive-descent parser, AST, semantic validation, and code generation, separating parsing from execution.", "Implemented SQL-style filtering, aggregation, GROUP BY/HAVING, sorting, LIMIT, DISTINCT, string functions, and arithmetic expressions."],
    InvisiQ: ["Developed a full-stack virtual queue-management application using React, Node.js/Express, and Socket.IO to deliver live queue updates.", "Integrated Firebase Realtime Database to persist and synchronize queue state across clients, keeping queue information consistent during live updates.", "Connected the Gemini API to support AI-assisted interactions within the queue-management workflow."],
  };
  const technology = item.highlights.filter((value) => value !== "UNKNOWN" && value.length <= 35).slice(0, 6);
  const bullets = verifiedBullets[item.title] ?? item.highlights.filter((value) => value !== "UNKNOWN" && value.length > 35).slice(0, 2);
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
  const allSkills = profile.skills.filter((skill) => skill !== "UNKNOWN");
  const skillGroups = [
    ["Languages", ["C++", "C", "Java", "Python", "JavaScript", "TypeScript"]],
    ["Core CS", ["Data Structures & Algorithms", "Object-Oriented Programming", "Operating Systems", "Computer Networks"]],
    ["Software Engineering", ["REST APIs", "debugging", "API testing", "Git", "CI/CD"]],
    ["Frameworks", ["React.js", "Next.js", "Node.js", "NestJS", "Express.js", "FastAPI"]],
    ["Databases and Tools", ["PostgreSQL", "Prisma", "MongoDB", "Redis", "Firebase", "Docker", "Swagger"]],
    ["AI/ML", ["LLMs", "Agentic AI", "RAG", "Knowledge Graphs", "Vector Search"]],
  ].map(([label, candidates]) => [label, (candidates as string[]).filter((skill) => allSkills.some((knownSkill) => knownSkill.toLowerCase() === skill.toLowerCase()))] as [string, string[]]).filter(([, values]) => values.length);
  return `<!doctype html><html><head><meta charset="utf-8"><style>
    @page { size: A4; margin: 0.29in 0.52in 0.32in; }
    * { box-sizing: border-box; } body { font-family: Georgia, "Times New Roman", serif; color: #111; font-size: 9.35pt; line-height: 1.12; margin: 0; } h1 { font-size: 25pt; line-height: 1; letter-spacing: .1px; margin: 0 0 5px; text-align: center; font-variant: small-caps; font-weight: 400; } .contact { text-align: center; font-size: 8.7pt; margin: 0 0 7px; } .contact a { color: inherit; text-decoration: underline; } h2 { color: #c53030; font-size: 12pt; font-weight: 400; border-bottom: 1px solid #c53030; padding-bottom: 2px; margin: 7px 0 3px; } p { margin: 0; } article { margin: 0 0 4px; break-inside: avoid; } .entry-head { display: flex; justify-content: space-between; gap: 15px; line-height: 1.08; } .entry-head strong:last-child { white-space: nowrap; } .entry-sub { margin-top: 1px; } .education-sub { display: flex; justify-content: space-between; gap: 15px; } .project-line { line-height: 1.1; } .project-tech { text-decoration: underline; } .project-date { float: right; white-space: nowrap; } ul { margin: 2px 0 0 14px; padding: 0; } li { margin-bottom: 1px; padding-left: 1px; } .skills { line-height: 1.16; } .skills strong { font-weight: 700; } .tailored { display: none; }
  </style></head><body>
  <h1>${escapeHtml(profile.identity.full_name)}</h1>
  <p class="contact">☎ <u>${escapeHtml(known(profile.identity.phone))}</u> &nbsp;&nbsp; ✉ <u>${escapeHtml(known(profile.identity.email))}</u>${profile.identity.links.map((link) => ` &nbsp;&nbsp; <u>${escapeHtml(contactLabel(link))}</u>`).join("")}</p>
  ${profile.education.length ? `<h2>Education</h2>${profile.education.map(educationHtml).join("")}` : ""}
  ${experience.length ? `<h2>Experience</h2>${experience.map(itemHtml).join("")}` : ""}
  ${projects.length ? `<h2>Projects</h2>${projects.map(projectHtml).join("")}` : ""}
  ${skillGroups.length ? `<h2>Technical Skills</h2><div class="skills">${skillGroups.map(([label, values]) => `<div><strong>${escapeHtml(label)}:</strong> ${values.map((skill) => escapeHtml(skill)).join(", ")}</div>`).join("")}</div>` : ""}
  <h2>Honours &amp; Achievements</h2><ul class="achievements"><li>Achieved <strong>All India Rank 3</strong> in the Unstop Weekly Coding Challenge.</li><li>Ranked in the <strong>top 8%</strong> among 250,000+ participants in AlgoUniversity ATF 2025.</li><li>Selected for the <strong>Microsoft SEFA 2025 — Software Engineering Program</strong>.</li><li>Solved <strong>300+ DSA problems</strong> on LeetCode and GeeksforGeeks.</li></ul>
  <p class="tailored">Draft generated for ${escapeHtml(roleLabel || "this role")}. Only verified profile content is included.</p>
  </body></html>`;
}

function resumeTex(profile: MasterProfile) {
  const bullets = (items: string[]) => items.map((item) => `\\resumeItem{${escapeLatex(item)}}`).join("\n");
  const experience = profile.experience.filter((item) => !/unknown/i.test(item.title)).slice(0, 2);
  const preferredProjectOrder = ["Proofline", "TrueDocs", "CQL", "InvisiQ"];
  const projects = [...profile.projects].sort((left, right) => (preferredProjectOrder.indexOf(left.title) < 0 ? 99 : preferredProjectOrder.indexOf(left.title)) - (preferredProjectOrder.indexOf(right.title) < 0 ? 99 : preferredProjectOrder.indexOf(right.title))).slice(0, 4);
  const projectBullets: Record<string, string[]> = { Proofline: ["Developing a multi-tenant B2B platform using a NestJS REST API, Next.js frontend, and PostgreSQL/Prisma data layer.", "Implemented server-side authorization across four organization roles, HttpOnly session authentication, password hashing, and invitation workflows.", "Added request validation, security headers, health checks, CI validation, and unit tests for authentication and role-permission policies."], TrueDocs: ["Developed a document question-answering workflow combining retrieval-augmented generation (RAG) with knowledge-graph relationships.", "Integrated Qdrant vector search with a FastAPI backend and Next.js interface to retrieve relevant context for document queries."], CQL: ["Built a Python query-processing tool with a lexer, recursive-descent parser, AST, semantic validation, and code generation.", "Implemented SQL-style filtering, aggregation, GROUP BY/HAVING, sorting, LIMIT, DISTINCT, string functions, and arithmetic expressions."], InvisiQ: ["Developed a full-stack virtual queue-management application using React, Node.js/Express, and Socket.IO to deliver live queue updates.", "Integrated Firebase Realtime Database to persist and synchronize queue state across clients.", "Connected the Gemini API to support AI-assisted interactions within the queue-management workflow."] };
  return `\\documentclass[a4paper,10pt]{article}
\\usepackage[empty]{fullpage}\\usepackage[T1]{fontenc}\\usepackage{titlesec}\\usepackage{enumitem}\\usepackage[hidelinks]{hyperref}\\usepackage[dvipsnames]{xcolor}
\\pagestyle{empty}\\raggedright\\raggedbottom\\titleformat{\\section}{\\vspace{-5pt}\\color{BrickRed}\\normalfont\\large}{}{0em}{}[\\color{BrickRed}\\titlerule\\vspace{-5pt}]
\\newcommand{\\resumeItem}[1]{\\item #1}\\newcommand{\\resumeSubHeadingListStart}{\\begin{itemize}[leftmargin=0.10in,label={},itemsep=0pt,topsep=0pt]}\\newcommand{\\resumeSubHeadingListEnd}{\\end{itemize}}
\\newcommand{\\resumeItemListStart}{\\begin{itemize}[leftmargin=0.16in,label=\\textbullet,itemsep=0pt,topsep=1pt]}\\newcommand{\\resumeItemListEnd}{\\end{itemize}}
\\begin{document}\\begin{center}{\\fontsize{25}{27}\\selectfont\\textsc{${escapeLatex(profile.identity.full_name)}}}\\\\[3pt]\\small ${escapeLatex(profile.identity.phone)} \\quad ${escapeLatex(profile.identity.email)} \\quad GitHub: ${escapeLatex(profile.identity.links.find((link) => /github/i.test(link)) ?? "")} \\quad Portfolio: ${escapeLatex(profile.identity.links.find((link) => /portfolio|vercel/i.test(link)) ?? "")}\\end{center}\\vspace{-8pt}
\\section{Education}${profile.education.map((item) => `\\textbf{${escapeLatex(item.organization ?? item.title)}}\\hfill\\textbf{${escapeLatex(known(item.date_range))}}\\\\\\textit{${escapeLatex(item.title)}}\\hfill\\textit{CGPA: ${escapeLatex(known(item.description))}}`).join("\\\\")}
\\section{Experience}${experience.map((item) => `\\textbf{${escapeLatex(known(item.organization) ? `${known(item.organization)} --- ${item.title}` : item.title)}}\\hfill\\textbf{${escapeLatex(known(item.date_range))}}\\\\\\resumeItemListStart${bullets(compactBullets(item))}\\resumeItemListEnd`).join("\\\\")}
\\section{Projects}${projects.map((item) => `\\textbf{${escapeLatex(item.title)}:} ${escapeLatex(known(item.description))}\\\\\\resumeItemListStart${bullets(projectBullets[item.title] ?? item.highlights.filter((value) => value.length > 35).slice(0, 2))}\\resumeItemListEnd`).join("\\\\")}
\\section{Technical Skills}\\textbf{Languages:} Python, C++, JavaScript, TypeScript, C, Java\\\\\\textbf{Core CS:} Data Structures and Algorithms, Object-Oriented Programming, Operating Systems, Computer Networks\\\\\\textbf{Software Engineering:} REST APIs, Debugging, API Testing, Git, CI/CD\\\\\\textbf{Frameworks:} React, Next.js, Node.js, NestJS, Express\\\\\\textbf{Databases and Tools:} PostgreSQL, Prisma, MongoDB, Redis, Firebase, Docker, Swagger/OpenAPI\\\\\\textbf{AI/ML:} LLMs, Agentic AI, RAG, Knowledge Graphs, Vector Search
\\section{Honours \\& Achievements}\\resumeItemListStart${bullets(["Achieved All India Rank 3 in the Unstop Weekly Coding Challenge.", "Ranked in the top 8% among 250,000+ participants in AlgoUniversity ATF 2025.", "Selected for the Microsoft SEFA 2025 --- Software Engineering Program.", "Solved 300+ DSA problems on LeetCode and GeeksforGeeks."])}\\resumeItemListEnd\\end{document}`;
}

export async function generateResume(profile: MasterProfile, job: JobAnalysis) {
  await ensureDataDirectories();
  const company = (job.company ?? "Company").replace(/[^a-z0-9]+/gi, "_");
  const role = (job.role ?? "Role").replace(/[^a-z0-9]+/gi, "_");
  const candidate = profile.identity.full_name.replace(/[^a-z0-9]+/gi, "_");
  const versionSeed = createHash("sha256").update(`${job.id}:${job.description}:${JSON.stringify(profile)}`).digest("hex").slice(0, 10);
  const fileName = `${candidate}_${company}_${role}_Resume_DRAFT_${versionSeed}.pdf`;
  const htmlPath = path.join(draftRoot, fileName.replace(/\.pdf$/, ".html"));
  const texPath = path.join(draftRoot, fileName.replace(/\.pdf$/, ".tex"));
  const pdfPath = path.join(draftRoot, fileName);
  const html = resumeHtml(profile, job);
  await writeFile(htmlPath, html, "utf8");
  await writeFile(texPath, resumeTex(profile), "utf8");
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "load" });
    await page.pdf({ path: pdfPath, format: "A4", printBackground: true, margin: { top: "0mm", bottom: "0mm", left: "0mm", right: "0mm" } });
  } finally {
    await browser.close();
  }
  const contentHash = hash(await readFile(pdfPath));
  const record = { applicationId: job.id, fileName, htmlPath, texPath, pdfPath, contentHash, version: versionSeed, generatedAt: new Date().toISOString(), changeSummary: ["Generated from the verified local profile pack.", `Target role: ${job.role ?? "not identified"}.`, "Used the fixed one-page serif template with section order, grouped skills, and achievements."] };
  await saveResumeRecord(record);
  return record;
}
