import { describe, expect, it } from "vitest";
import { analyzeJob } from "@/jobs/analyze";
import type { MasterProfile } from "@/validation/schemas";

const profile: MasterProfile = {
  schema_version: "1.0", last_verified: "2026-10-13",
  identity: { full_name: "Test Person", email: "test@example.test", phone: "UNKNOWN", location: "India", links: [] },
  summary: "TypeScript developer", education: [], experience: [], projects: [], skills: ["TypeScript", "React"], preferences: {}, conflicts: [], source_resumes: [],
};

describe("analyzeJob", () => {
  it("maps only evidence found in the verified profile", () => {
    const job = analyzeJob("Company: Acme\nRole: Frontend Developer\nRequirements:\n- TypeScript and React experience\n- Work authorization", null, profile);
    expect(job.company).toBe("Acme");
    expect(job.role).toBe("Frontend Developer");
    expect(job.requirements).not.toContain("Requirements:");
    expect(job.evidence[0]).toMatchObject({ status: "supported" });
    expect(job.evidence[1]).toMatchObject({ status: "unknown", evidence: [] });
  });

  it("turns inline Accenture headings into short reviewable requirements", () => {
    const job = analyzeJob("Project Role : Custom Software Engineer Project Role Description : Build software. Must have skills : Aveva OSIsoft PI Good to have skills : NA Minimum 0-2 year(s) of experience is required Educational Qualification : 15 years full time education Locations Bengaluru", "https://www.accenture.com/in-en/careers/jobdetails?id=demo", profile);
    expect(job.company).toBe("Accenture");
    expect(job.role).toBe("Custom Software Engineer");
    expect(job.requirements.some((item) => item.includes("Aveva OSIsoft PI"))).toBe(true);
    expect(job.requirements.every((item) => item.length < 240)).toBe(true);
  });
});
