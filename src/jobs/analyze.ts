import { applicationId } from "@/storage/files";
import type { JobAnalysis, MasterProfile } from "@/validation/schemas";

const lines = (value: string) => value
  .replace(/\b(Project Role Description|Must have skills|Good to have skills|Minimum [^:]{1,50}experience is required|Educational Qualification|Locations|Summary|Roles & Responsibilities|Professional & Technical Skills|Additional Information)\s*:/gi, "\n$1:")
  .split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
const clean = (value: string) => value.replace(/^[-*•\d.)\s]+/, "").trim();

function capture(text: string, patterns: RegExp[]) {
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match?.[1]) return match[1].trim().replace(/[|,]$/, "");
  }
  return null;
}

function evidenceCorpus(profile: MasterProfile) {
  return [profile.summary, ...profile.skills, ...profile.experience.flatMap((item) => [item.title, item.organization, item.description, ...item.highlights]), ...profile.projects.flatMap((item) => [item.title, item.description, ...item.highlights])]
    .filter((item): item is string => Boolean(item && item !== "UNKNOWN"));
}

export function analyzeJob(description: string, sourceUrl: string | null, profile: MasterProfile | null): JobAnalysis {
  const normalized = lines(description).join("\n");
  const role = capture(normalized, [/(?:project role|job title|position|role)\s*[:|-]\s*([^\n]+)/i, /^(.+(?:engineer|developer|designer|analyst|intern|manager))$/im]);
  const company = /accenture\.com/i.test(sourceUrl ?? "") ? "Accenture" : capture(normalized, [/(?:company|organization|employer)\s*[:|-]\s*([^\n]+)/i, /(?:at|join)\s+([A-Z][\w.& -]{2,})/]);
  const location = capture(normalized, [/(?:location|locations|based in)\s*[:|-]\s*([^\n]+)/i, /locations\s+([A-Z][\w -]{2,})/i]);
  const employmentType = capture(normalized, [/(?:employment type|job type|type)\s*[:|-]\s*([^\n]+)/i]);
  const candidates = lines(normalized).filter((line) => /^(?:[-*•]|\d+[.)])/.test(line) || /(?:requirements|qualifications|what you(?:'|’)ll need)/i.test(line));
  const sections = Array.from(normalized.matchAll(/(?:must have skills|good to have skills|minimum [^:]{1,50}experience is required|educational qualification|locations)\s*:?\s*(.*?)(?=\s+(?:good to have skills|minimum [^:]{1,50}experience is required|educational qualification|summary|locations|additional information)\s*:?|$)/gi)).map((match) => match[0].trim());
  const requirements = Array.from(new Set([...sections, ...candidates.map(clean)].filter((line) => line.length > 10 && line.length < 240 && !/^requirements:?$/i.test(line)))).slice(0, 10);
  const corpus = profile ? evidenceCorpus(profile).join("\n") : "";
  const evidence = requirements.map((requirement) => {
    const keywords = requirement.toLowerCase().match(/[a-z][a-z+#.]{2,}/g) ?? [];
    const matches = corpus.split("\n").filter((item) => keywords.some((word) => item.toLowerCase().includes(word))).slice(0, 3);
    return { requirement, evidence: matches, status: matches.length ? "supported" as const : "unknown" as const };
  });
  return {
    id: applicationId(company, role), sourceUrl, company, role, location, employmentType,
    description, requirements, evidence, analyzedAt: new Date().toISOString(),
  };
}
