import { NextResponse } from "next/server";
import { getLocalAIStatus } from "@/ai/local";

export async function GET() {
  return NextResponse.json(await getLocalAIStatus());
}
