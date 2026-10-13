import { describe, expect, it } from "vitest";
import { detectAdapter } from "./adapters";

describe("ATS adapter detection", () => {
  it("recognizes supported Greenhouse and Lever hosts", () => {
    expect(detectAdapter("https://boards.greenhouse.io/example/jobs/1")).toMatchObject({ id: "greenhouse", supported: true });
    expect(detectAdapter("https://jobs.lever.co/example/abc")).toMatchObject({ id: "lever", supported: true });
  });
  it("does not claim Workday or unknown forms are supported", () => {
    expect(detectAdapter("https://example.myworkdayjobs.com/en-US/apply").supported).toBe(false);
    expect(detectAdapter("https://example.test/apply").id).toBe("generic");
  });
});
