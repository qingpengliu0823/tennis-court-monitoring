import { NextResponse } from "next/server";
import { runScheduler } from "@/lib/scheduler";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const result = await runScheduler();
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
