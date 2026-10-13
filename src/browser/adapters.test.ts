import { describe, expect, it } from "vitest";
import { detectAdapter, fieldNameHints } from "./adapters";

describe("ATS adapter detection", () => {
  it("recognizes supported Greenhouse and Lever hosts", () => {
    expect(detectAdapter("https://boards.greenhouse.io/example/jobs/1")).toMatchObject({ id: "greenhouse", supported: true });
    expect(detectAdapter("https://jobs.lever.co/example/abc")).toMatchObject({ id: "lever", supported: true });
  });
  it("does not claim Workday or unknown forms are supported", () => {
    expect(detectAdapter("https://example.myworkdayjobs.com/en-US/apply").supported).toBe(false);
    expect(detectAdapter("https://example.test/apply").id).toBe("generic");
  });
  it("provides conservative name/id hints for common identity fields", () => {
    expect(fieldNameHints("greenhouse", "First name")).toContain("first");
    expect(fieldNameHints("lever", "Email")).toContain("email");
    expect(fieldNameHints("lever", "Name")).toEqual(["name"]);
  });
});
