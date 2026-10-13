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
