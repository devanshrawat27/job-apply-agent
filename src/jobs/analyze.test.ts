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
});
