import { chromium, type BrowserContext, type Page } from "playwright";
import path from "path";

let context: BrowserContext | null = null;
let page: Page | null = null;

export function sessionDirectory() {
  return path.resolve(process.env.PLAYWRIGHT_USER_DATA_DIR || "./playwright-profile");
}

export async function openManualSession(url: string) {
  if (!context) context = await chromium.launchPersistentContext(sessionDirectory(), { headless: false });
  page = page && !page.isClosed() ? page : await context.newPage();
  await page.goto(url, { waitUntil: "domcontentloaded" });
  return { url: page.url(), title: await page.title().catch(() => ""), profileDirectory: sessionDirectory() };
}

export async function closeManualSession() {
  if (context) await context.close();
  context = null;
  page = null;
}

export function currentSessionPage() {
  return page;
}

export async function uploadResumeFile(pdfPath: string) {
  if (!page || page.isClosed()) throw new Error("Open the application URL in the manual browser session first.");
  const fileInput = page.locator('input[type="file"]').first();
  if (await fileInput.count() === 0) throw new Error("No resume file input was found on the current page.");
  await fileInput.setInputFiles(pdfPath);
  return { url: page.url(), fileName: path.basename(pdfPath) };
}

export async function clickSubmitAfterReview() {
  if (!page || page.isClosed()) throw new Error("Open the application URL in the manual browser session first.");
  const buttons = page.getByRole("button", { name: /submit application|submit/i });
  const count = await buttons.count();
  if (count !== 1) throw new Error(`Expected exactly one accessible Submit button, found ${count}. Review and submit manually.`);
  await buttons.click();
  return { url: page.url(), title: await page.title().catch(() => "") };
}
