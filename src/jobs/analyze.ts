import { applicationId } from "@/storage/files";
import type { JobAnalysis, MasterProfile } from "@/validation/schemas";

const lines = (value: string) => value.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
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
  const role = capture(description, [/(?:job title|position|role)\s*[:|-]\s*([^\n]+)/i, /^(.+(?:engineer|developer|designer|analyst|intern|manager))$/im]);
  const company = capture(description, [/(?:company|organization|employer)\s*[:|-]\s*([^\n]+)/i, /(?:at|join)\s+([A-Z][\w.& -]{2,})/]);
  const location = capture(description, [/(?:location|based in)\s*[:|-]\s*([^\n]+)/i]);
  const employmentType = capture(description, [/(?:employment type|job type|type)\s*[:|-]\s*([^\n]+)/i]);
  const candidates = lines(description).filter((line) => /^(?:[-*•]|\d+[.)])/.test(line) || /(?:requirements|qualifications|what you(?:'|’)ll need)/i.test(line));
  const requirements = Array.from(new Set(candidates.map(clean).filter((line) => line.length > 10 && !/^requirements:?$/i.test(line)))).slice(0, 10);
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
