import { NextResponse } from "next/server";
import { generateLocalText, getLocalAIStatus } from "@/ai/local";
import { loadProfile } from "@/storage/files";
import { JobAnalysisSchema } from "@/validation/schemas";

export async function POST(request: Request) {
  try {
    const job = JobAnalysisSchema.parse(await request.json());
    const status = await getLocalAIStatus();
    if (!status.available) return NextResponse.json({ error: `${status.message} Install the configured Ollama model first.` }, { status: 503 });
    const { profile } = await loadProfile();
    if (!profile) throw new Error("A validated local Profile Pack is required.");
    const prompt = `You are a conservative resume reviewer. Use only the supplied facts. Do not invent metrics, dates, employers, skills, or ownership. Return concise bullet suggestions for tailoring a resume to this job. Mark any unsupported requirement as UNKNOWN.\n\nJOB:\n${job.description}\n\nPROFILE SUMMARY:\n${profile.summary}\nSKILLS:\n${profile.skills.join(", ")}\nEXPERIENCE:\n${profile.experience.map((item) => `${item.title} at ${item.organization}: ${item.description}`).join("\n")}\nPROJECTS:\n${profile.projects.map((item) => `${item.title}: ${item.description}`).join("\n")}`;
    const suggestions = await generateLocalText(prompt);
    return NextResponse.json({ model: status.model, suggestions, message: "Local AI suggestions generated for review only." });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to generate local AI suggestions." }, { status: 400 });
  }
}
