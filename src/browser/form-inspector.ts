import { chromium } from "playwright";
import { currentSessionPage } from "@/browser/session";
import type { z } from "zod";
import { FieldRecordSchema } from "@/validation/schemas";
import { detectAdapter, type AdapterInfo } from "@/browser/adapters";

export type DetectedField = z.infer<typeof FieldRecordSchema>;

export async function inspectApplicationForm(url: string): Promise<{ fields: DetectedField[]; adapter: AdapterInfo }> {
  const existingPage = currentSessionPage();
  if (existingPage && !existingPage.isClosed() && existingPage.url() === url) return inspectPage(existingPage, url);
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    await page.goto(url, { waitUntil: "domcontentloaded" });
    return await inspectPage(page, url);
  } finally {
    await browser.close();
  }
}

async function inspectPage(page: import("playwright").Page, url: string) {
    const raw = await page.locator("input, textarea, select").evaluateAll((elements) => elements.map((element) => {
      const input = element as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement;
      const id = input.id;
      const label = id ? document.querySelector(`label[for="${CSS.escape(id)}"]`)?.textContent?.trim() : undefined;
      const select = input instanceof HTMLSelectElement ? Array.from(input.options).map((option) => option.text.trim()).filter(Boolean) : [];
      return { label: label || input.getAttribute("aria-label") || input.getAttribute("name") || "Unlabeled field", type: input.getAttribute("type") || input.tagName.toLowerCase(), options: select };
    }));
    const fields = raw.map((field) => FieldRecordSchema.parse({ field_label: field.label, field_type: field.type, available_options: field.options, proposed_value: null, source: null, confidence: 0, risk: "high", status: "needs_user_input", reason: "Inspection only. The agent will not infer an answer or upload files." }));
    return { fields, adapter: detectAdapter(url, await page.locator("body").innerText().catch(() => "")) };
}
