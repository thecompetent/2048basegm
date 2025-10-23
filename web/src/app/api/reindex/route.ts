import { NextRequest, NextResponse } from "next/server";
import { kv } from "@vercel/kv";
import { createPublicClient, http, parseAbiItem, Address } from "viem";
import { base } from "viem/chains";

export const dynamic = "force-dynamic";

const eventAbi = parseAbiItem("event GmClaimed(address indexed user, uint256 score, uint8 scoreMultiplier, uint64 streakMultiplier, uint64 day, uint256 pointsAdded, uint256 newTotal)");

export async function POST(req: NextRequest) {
  const contract = process.env.NEXT_PUBLIC_CONTRACT_ADDRESS as Address;
  const fromBlockStr = (await kv.get<string>("fromBlock")) ?? "0";
  const fromBlock = BigInt(fromBlockStr);

  const client = createPublicClient({ chain: base, transport: http(process.env.NEXT_PUBLIC_BASE_RPC) });
  const latest = await client.getBlockNumber();

  const logs = await client.getLogs({
    address: contract,
    fromBlock,
    toBlock: latest,
    event: eventAbi,
  });

  for (const lg of logs) {
    const { user, newTotal } = lg.args as any;
    await kv.zadd("leaders", { member: (user as string).toLowerCase(), score: Number(newTotal) });
  }

  await kv.set("fromBlock", latest.toString());
  return NextResponse.json({ ok: true, processed: logs.length, upTo: latest.toString() });
}

