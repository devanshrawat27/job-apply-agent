import { NextResponse } from "next/server";
import { generateResume } from "@/resumes/generate";
import { loadProfile } from "@/storage/files";
import { JobAnalysisSchema } from "@/validation/schemas";

export async function POST(request: Request) {
  try {
    const job = JobAnalysisSchema.parse(await request.json());
    const { profile, errors } = await loadProfile();
    if (!profile) return NextResponse.json({ error: `Resume generation is blocked: ${errors.join(" ")}` }, { status: 409 });
    if (profile.conflicts.length) return NextResponse.json({ error: "Resume generation is blocked until profile conflicts are resolved.", conflicts: profile.conflicts }, { status: 409 });
    const record = await generateResume(profile, job);
    return NextResponse.json({ record, previewUrl: `/api/resumes/${encodeURIComponent(job.id)}/pdf` });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to generate the resume PDF." }, { status: 400 });
  }
}
