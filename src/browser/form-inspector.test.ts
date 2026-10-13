import { describe, expect, it } from "vitest";
import { inspectApplicationForm } from "./form-inspector";

describe("synthetic browser form smoke test", () => {
  it("inspects accessible fields without entering values", async () => {
    const html = encodeURIComponent("<label for='email'>Email</label><input id='email' type='email'><label for='role'>Role</label><select id='role'><option>Engineer</option></select>");
    const result = await inspectApplicationForm(`data:text/html,${html}`);
    expect(result.fields.map((field) => field.field_label)).toEqual(["Email", "Role"]);
    expect(result.fields.every((field) => field.status === "needs_user_input")).toBe(true);
  });
});
