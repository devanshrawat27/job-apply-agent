import { createHash } from "crypto";
import { NextResponse } from "next/server";
import { updateApplicationReview } from "@/storage/files";
import { ReviewUpdateSchema } from "@/validation/schemas";

export async function POST(request: Request) {
  try {
    const input = ReviewUpdateSchema.parse(await request.json());
    const review = await updateApplicationReview(input.applicationId, input.fields, input.coverLetter);
    return NextResponse.json({ review, reviewHash: createHash("sha256").update(JSON.stringify(review)).digest("hex"), message: "Field decisions saved. Any previous final approval is invalidated." });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to save field decisions." }, { status: 400 });
  }
}
