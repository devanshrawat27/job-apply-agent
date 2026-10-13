import { NextResponse } from "next/server";
import { approveResume } from "@/storage/files";
import { ApprovalRequestSchema } from "@/validation/schemas";

export async function POST(request: Request) {
  try {
    const input = ApprovalRequestSchema.parse(await request.json());
    const record = await approveResume(input.applicationId, input.contentHash);
    return NextResponse.json({ approved: true, record, message: "This exact resume version is approved. Upload remains a separate action and submission remains blocked." });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to approve this resume." }, { status: 400 });
  }
}
