import { describe, expect, it } from "vitest";
import { classifyFields } from "./classify-fields";
import type { DetectedField } from "./form-inspector";
import type { MasterProfile } from "@/validation/schemas";

const profile: MasterProfile = { schema_version: "1.0", last_verified: "2026-10-13", identity: { full_name: "Test Person", email: "test@example.test", phone: "UNKNOWN", location: "Pune, India", links: [] }, summary: "", education: [], experience: [], projects: [], skills: [], preferences: {}, conflicts: [], source_resumes: [] };
const field = (label: string): DetectedField => ({ field_label: label, field_type: "text", available_options: [], proposed_value: null, source: null, confidence: 0, risk: "high", status: "needs_user_input", reason: "Inspection only." });

describe("classifyFields", () => {
  it("classifies exact identity fields and blocks sensitive fields", () => {
    const result = classifyFields([field("Full name"), field("Work authorization")], profile);
    expect(result[0]).toMatchObject({ status: "verified_autofill", proposed_value: "Test Person", risk: "low" });
    expect(result[1]).toMatchObject({ status: "needs_user_input", risk: "high" });
  });
});
