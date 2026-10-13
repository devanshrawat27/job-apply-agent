import { describe, expect, it } from "vitest";
import { normalizeCareerProfile } from "./normalize";

describe("career profile normalizer", () => {
  it("maps the rich handoff format and preserves conflicts", () => {
    const profile = normalizeCareerProfile({
      document_metadata: { version: "1.0", created_date: "2026-10-13" },
      personal_details: { full_name: { value: "Devansh Rawat" }, email: { value: "devansh@example.com" }, phone: { value: "123" }, location: { value: "India" }, professional_summary: { value: "Engineer" } },
      education: [{ institution: "University", degree: "B.Tech", cgpa_values: [{ value: "7.7" }, { value: "8.1" }] }],
      experience: [], projects: [], skills: { languages: ["TypeScript"] }, conflicting_facts: [{ field: "CGPA", values: ["7.7", "8.1"], status: "NEEDS_MY_CONFIRMATION" }], existing_resume_files: [{ filename: "resume.pdf" }],
    });
    expect(profile?.identity.full_name).toBe("Devansh Rawat");
    expect(profile?.skills).toContain("TypeScript");
    expect(profile?.conflicts.length).toBe(2);
    expect(profile?.source_resumes).toEqual(["resume.pdf"]);
  });
});
