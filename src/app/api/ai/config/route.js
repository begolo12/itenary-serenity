import { NextResponse } from "next/server";
import { providerStatus, requireAiUser } from "../../../../lib/server/ai-credentials";

export async function GET(request) {
  try {
    await requireAiUser(request);
    return NextResponse.json({ providers: providerStatus() });
  } catch (error) {
    return NextResponse.json({ error: error.message || "Sesi tidak valid." }, { status: error.status || 500 });
  }
}
