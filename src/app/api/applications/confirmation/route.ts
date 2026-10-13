import { NextResponse } from "next/server";
import { recordConfirmation } from "@/storage/files";
import { ConfirmationSchema } from "@/validation/schemas";

export async function POST(request: Request) {
  try { const input = ConfirmationSchema.parse(await request.json()); return NextResponse.json({ confirmation: await recordConfirmation(input.applicationId, input), message: "Confirmation evidence recorded. This is marked confirmed only because you supplied the observed evidence." }); }
  catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to record confirmation evidence." }, { status: 400 }); }
}
