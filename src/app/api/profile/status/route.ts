import { NextResponse } from "next/server";
import { loadProfile } from "@/storage/files";

export async function GET() {
  const { profile, errors } = await loadProfile();
  return NextResponse.json({ ready: Boolean(profile), errors, summary: profile ? { name: profile.identity.full_name, lastVerified: profile.last_verified, conflicts: profile.conflicts, sourceResumes: profile.source_resumes } : null });
}
