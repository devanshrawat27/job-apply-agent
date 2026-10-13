import { chromium } from "playwright";
import { FieldRecordSchema } from "@/validation/schemas";

/** Fills only low-risk, profile-verified text/select values. It cannot upload or submit. */
export async function fillVerifiedFields(url: string, proposedFields: unknown[]) {
  const fields = proposedFields.map((field) => FieldRecordSchema.parse(field));
  const eligible = fields.filter((field) => field.status === "verified_autofill" && field.risk === "low" && field.proposed_value && !/resume|cv|upload|file|authorization|sponsor|salary|compensation|gender|race|disability|veteran|criminal/i.test(field.field_label));
  const browser = await chromium.launch({ headless: false });
  try {
    const page = await browser.newPage();
    await page.goto(url, { waitUntil: "domcontentloaded" });
    const filled: string[] = [];
    for (const field of eligible) {
      const locator = page.getByLabel(field.field_label, { exact: false });
      const count = await locator.count();
      if (count !== 1) continue;
      const tag = await locator.evaluate((element) => element.tagName.toLowerCase());
      if (tag === "select") await locator.selectOption({ label: field.proposed_value! });
      else await locator.fill(field.proposed_value!);
      const displayed = await locator.inputValue();
      if (displayed === field.proposed_value) filled.push(field.field_label);
    }
    return { filled, skipped: fields.length - filled.length };
  } finally {
    await browser.close();
  }
}
