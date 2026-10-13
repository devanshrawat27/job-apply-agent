import { MasterProfileSchema, type MasterProfile } from "@/validation/schemas";

const valueOf = (entry: unknown) => typeof entry === "object" && entry !== null && "value" in entry ? String((entry as { value?: unknown }).value ?? "") : String(entry ?? "");
const textList = (values: unknown) => Array.isArray(values) ? values.filter((value): value is string => typeof value === "string" && value.trim().length > 0) : [];

export function normalizeCareerProfile(raw: Record<string, unknown>): MasterProfile | null {
  if (!raw.personal_details || !raw.document_metadata) return null;
  const personal = raw.personal_details as Record<string, unknown>;
  const metadata = raw.document_metadata as Record<string, unknown>;
  const details = (personal.personal_details ?? personal) as Record<string, unknown>;
  const identity = {
    full_name: valueOf(details.full_name), email: valueOf(details.email), phone: valueOf(details.phone), location: valueOf(details.location),
    links: [valueOf((raw.professional_links as Record<string, unknown> | undefined)?.github_profile), valueOf((raw.professional_links as Record<string, unknown> | undefined)?.portfolio_url)].filter(Boolean),
  };
  const summary = valueOf(details.professional_summary) || "UNKNOWN";
  const education = Array.isArray(raw.education) ? raw.education.map((item) => { const entry = item as Record<string, unknown>; const cgpa = Array.isArray(entry.cgpa_values) ? entry.cgpa_values.map(valueOf).filter(Boolean) : []; return { title: valueOf(entry.degree) || "Education", organization: valueOf(entry.institution), date_range: [valueOf(entry.start_date), valueOf(entry.end_date_expected)].filter(Boolean).join(" – "), description: cgpa.join("; "), highlights: [], source: "career profile pack", status: "needs_confirmation" as const }; }) : [];
  const experience = Array.isArray(raw.experience) ? raw.experience.map((item) => { const entry = item as Record<string, unknown>; const titles = Array.isArray(entry.title_values) ? entry.title_values : [entry.title]; return { title: valueOf(titles[0]) || "Experience", organization: valueOf(entry.organization), date_range: valueOf(entry.dates) || [valueOf(entry.start_date), valueOf(entry.end_date)].filter(Boolean).join(" – "), description: textList(entry.verified_or_recorded_responsibilities ?? entry.responsibilities).join(" "), highlights: textList(entry.technical_environment), source: "career profile pack", status: "needs_confirmation" as const }; }) : [];
  const projects = Array.isArray(raw.projects) ? raw.projects.map((item) => { const entry = item as Record<string, unknown>; return { title: valueOf(entry.name) || "Project", organization: "", date_range: valueOf(entry.dates), description: valueOf(entry.description), highlights: [...textList(entry.technologies_recorded), ...textList(entry.capabilities_recorded)], source: "career profile pack", status: "needs_confirmation" as const }; }) : [];
  const skillsObject = raw.skills as Record<string, unknown> | undefined;
  const skills = skillsObject ? Object.values(skillsObject).flatMap((value) => textList(value)) : textList(raw.skills);
  const conflicts = [
    ...((Array.isArray(raw.conflicting_facts) ? raw.conflicting_facts : []).map((item) => { const entry = item as Record<string, unknown>; return `${valueOf(entry.field)}: ${textList(entry.values).join(" vs ")} (${valueOf(entry.status)})`; })),
    ...education.filter((item) => item.description).map((item) => `${item.title} has conflicting recorded values: ${item.description}`),
  ];
  const sourceResumes = Array.isArray(raw.existing_resume_files) ? raw.existing_resume_files.map((item) => valueOf((item as Record<string, unknown>).filename)).filter(Boolean) : [];
  return MasterProfileSchema.parse({ schema_version: String(metadata.version ?? "1.0"), last_verified: String(metadata.created_date ?? new Date().toISOString().slice(0, 10)), identity, summary, education, experience, projects, skills: Array.from(new Set(skills)), preferences: raw.job_preferences ?? {}, conflicts, source_resumes: sourceResumes });
}
