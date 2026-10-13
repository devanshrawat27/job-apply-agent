import { describe, expect, it } from "vitest";
import { ApplicationStatusSchema, ConfirmationSchema } from "@/validation/schemas";

describe("application tracker contracts", () => {
  it("accepts only known lifecycle statuses", () => {
    expect(ApplicationStatusSchema.parse("confirmation_unverified")).toBe("confirmation_unverified");
    expect(() => ApplicationStatusSchema.parse("success_without_evidence")).toThrow();
  });
  it("requires observed confirmation evidence", () => {
    expect(() => ConfirmationSchema.parse({ applicationId: "a", evidenceText: "" })).toThrow();
    expect(ConfirmationSchema.parse({ applicationId: "a", evidenceText: "Application ID 123" }).evidenceText).toContain("123");
  });
});
