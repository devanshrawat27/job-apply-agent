import { NextResponse } from "next/server";
import { MasterProfileSchema } from "@/validation/schemas";
import { saveProfile } from "@/storage/files";

export async function POST(request: Request) {
  try {
    const payload = await request.json();
    const parsed = MasterProfileSchema.safeParse(payload.profile ?? payload);
    if (!parsed.success) {
      return NextResponse.json({ error: "Profile validation failed.", details: parsed.error.issues.map((issue) => `${issue.path.join(".") || "profile"}: ${issue.message}`) }, { status: 400 });
    }
    await saveProfile(parsed.data);
    return NextResponse.json({ message: "Master Profile saved locally and validated.", profile: parsed.data });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to import profile." }, { status: 400 });
  }
}
