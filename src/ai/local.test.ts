import { describe, expect, it } from "vitest";
import { getLocalAIStatus } from "./local";

describe("local AI provider", () => {
  it("fails safely when Ollama is unavailable", async () => {
    const status = await getLocalAIStatus();
    expect(status.available).toBe(false);
    expect(status.model).toBeTruthy();
  });
});
