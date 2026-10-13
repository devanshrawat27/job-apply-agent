import { describe, expect, it } from "vitest";
import { sessionDirectory } from "./session";

describe("browser session", () => {
  it("uses a dedicated configurable local profile directory", () => {
    expect(sessionDirectory()).toContain("playwright-profile");
  });
});
