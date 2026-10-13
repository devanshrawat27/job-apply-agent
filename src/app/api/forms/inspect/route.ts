import { NextResponse } from "next/server";
import { inspectApplicationForm } from "@/browser/form-inspector";
import { createHash } from "crypto";
import { saveApplicationReview } from "@/storage/files";
import { FieldRecordSchema } from "@/validation/schemas";
import { loadProfile } from "@/storage/files";
import { classifyFields } from "@/browser/classify-fields";

export async function POST(request: Request) {
  try {
    const { url, applicationId, resumeHash } = await request.json();
    const parsed = new URL(url);
    if (!/^https?:$/.test(parsed.protocol)) throw new Error("Provide an http(s) application URL.");
    const { profile } = await loadProfile();
    const fields = classifyFields(await inspectApplicationForm(parsed.toString()), profile);
    if (!applicationId || !resumeHash) return NextResponse.json({ fields, notice: "Inspection only: no values, files, uploads, or submit actions were performed." });
    const reviewHash = createHash("sha256").update(JSON.stringify({ applicationId, resumeHash, fields })).digest("hex");
    const review = await saveApplicationReview({ applicationId, resumeHash, fields: fields.map((field) => FieldRecordSchema.parse(field)), coverLetter: "", reviewHash, createdAt: new Date().toISOString() });
    return NextResponse.json({ fields, review, notice: "Inspection only: no values, files, uploads, or submit actions were performed." });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to inspect the form." }, { status: 400 });
  }
}
