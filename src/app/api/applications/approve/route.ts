import { NextResponse } from "next/server";
import { approveFinalApplication } from "@/storage/files";
import { FinalApprovalRequestSchema } from "@/validation/schemas";

export async function POST(request: Request) {
  try {
    const input = FinalApprovalRequestSchema.parse(await request.json());
    const status = await approveFinalApplication(input.applicationId, input.reviewHash);
    return NextResponse.json({ approved: true, status, message: "Final application review approved. Submit remains disabled until a future guarded execution milestone." });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to approve the application." }, { status: 400 });
  }
}
