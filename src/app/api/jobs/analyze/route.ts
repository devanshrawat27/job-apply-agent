import { NextResponse } from "next/server";
import { analyzeJob } from "@/jobs/analyze";
import { loadProfile, saveJobAnalysis } from "@/storage/files";
import { JobInputSchema } from "@/validation/schemas";

async function fetchJobText(url: string) {
  const response = await fetch(url, { headers: { "User-Agent": "PersonalJobApplicationAgent/0.1 (local review tool)" }, signal: AbortSignal.timeout(15_000) });
  if (!response.ok) throw new Error(`The job URL returned ${response.status}. Paste the job description instead.`);
  const html = await response.text();
  return html.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi, " ").replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/\s{2,}/g, " ").trim();
}

export async function POST(request: Request) {
  try {
    const input = JobInputSchema.parse(await request.json());
    const description = input.description || await fetchJobText(input.sourceUrl!);
    const { profile } = await loadProfile();
    const job = analyzeJob(description, input.sourceUrl || null, profile);
    await saveJobAnalysis(job);
    return NextResponse.json({ job, profileReady: Boolean(profile), warning: profile ? null : "Job analyzed, but evidence mapping and resume generation stay blocked until the Profile Pack is installed." });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to analyze this job." }, { status: 400 });
  }
}
