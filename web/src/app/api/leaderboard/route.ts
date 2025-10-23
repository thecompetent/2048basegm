import { NextRequest, NextResponse } from "next/server";
import { kv } from "@vercel/kv";

export const dynamic = "force-dynamic";

// Simple endpoints:
// GET: return top N
// POST: upsert user stats (used by an off-chain indexer or webhook)

export async function GET(req: NextRequest) {
  const n = Number(req.nextUrl.searchParams.get("n") || 20);
  const leaders = (await kv.zrange<(string)>("leaders", -n, -1, { withScores: true })) as any[];
  // leaders comes as [member, score, member, score,...]
  const out: { user: string; points: number }[] = [];
  for (let i = 0; i < leaders.length; i += 2) out.push({ user: leaders[i] as string, points: Number(leaders[i + 1]) });
  out.reverse();
  return NextResponse.json({ leaders: out });
}

export async function POST(req: NextRequest) {
  const b = await req.json();
  const { user, totalPoints } = b as { user: string; totalPoints: number };
  if (!user || typeof totalPoints !== "number") return new NextResponse("INVALID_BODY", { status: 400 });
  await kv.zadd("leaders", { score: totalPoints, member: user.toLowerCase() });
  return NextResponse.json({ ok: true });
}

