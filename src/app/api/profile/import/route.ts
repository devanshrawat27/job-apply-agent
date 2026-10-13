import { NextResponse } from "next/server";
import { MasterProfileSchema } from "@/validation/schemas";
import { saveProfile } from "@/storage/files";
import { normalizeCareerProfile } from "@/profile/normalize";

export async function POST(request: Request) {
  try {
    const payload = await request.json();
    const rawProfile = payload.profile ?? payload;
    const parsed = MasterProfileSchema.safeParse(rawProfile);
    const normalized = parsed.success ? parsed.data : normalizeCareerProfile(rawProfile);
    if (!normalized) {
      return NextResponse.json({ error: "Profile validation failed. Use the supplied template or the career profile pack format.", details: parsed.success ? [] : parsed.error.issues.map((issue) => `${issue.path.join(".") || "profile"}: ${issue.message}`) }, { status: 400 });
    }
    await saveProfile(normalized, { json: JSON.stringify(rawProfile, null, 2), markdown: typeof payload.markdown === "string" ? payload.markdown : undefined });
    return NextResponse.json({ message: "Master Profile saved locally, normalized, and validated. Source pack was preserved.", profile: normalized });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to import profile." }, { status: 400 });
  }
}
