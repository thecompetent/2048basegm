import { NextRequest, NextResponse } from "next/server";
import { Address, Hex, createWalletClient, http } from "viem";
import { base, baseSepolia } from "viem/chains";

export const dynamic = "force-dynamic";

type Body = {
  wallet: Address;
  score: number;
  moves?: number;
  durationMs?: number;
};

function bad(msg: string, code = 400) { return new NextResponse(msg, { status: code }); }

export async function POST(req: NextRequest) {
  const { wallet, score, moves, durationMs } = (await req.json()) as Body;
  if (!wallet || typeof score !== "number") return bad("INVALID_BODY");

  // Basic anti-abuse: at least some moves and 15+ seconds
  if ((moves ?? 0) < 10 || (durationMs ?? 0) < 15_000) return bad("PLAY_MORE");

  const contractAddress = process.env.NEXT_PUBLIC_CONTRACT_ADDRESS as Address;
  if (!contractAddress) return bad("NO_CONTRACT");

  const pk = process.env.SIGNER_PRIVATE_KEY as Hex;
  if (!pk) return bad("NO_SIGNER", 500);

  // EIP-712 typed data (structured for on-chain EIP712)
  const nowSec = Math.floor(Date.now() / 1000);
  const day = Math.floor(nowSec / (24 * 60 * 60));
  const validUntil = nowSec + 10 * 60; // 10 minutes

  // We'll sign the EIP-191 hash of EIP712-encodable data off-chain using viem wallet client
  const chainIdStr = process.env.NEXT_PUBLIC_CHAIN_ID || "8453"; // 8453=base, 84532=baseSepolia
  const chain = chainIdStr === "84532" ? baseSepolia : base;
  const rpcUrl = process.env.NEXT_PUBLIC_BASE_RPC; // optional; falls back to default
  const client = createWalletClient({ chain, transport: http(rpcUrl) }).extend((c) => ({
    async signTyped({ pk, domain, types, message }: any) {
      const { privateKeyToAccount } = await import("viem/accounts");
      const account = privateKeyToAccount(pk);
      return c.signTypedData({ account, domain, types, primaryType: "ScoreClaim", message });
    }
  }));

  const domain = { name: "GmManager", version: "1", chainId: Number(chainIdStr), verifyingContract: contractAddress };
  const types = {
    ScoreClaim: [
      { name: "wallet", type: "address" },
      { name: "score", type: "uint256" },
      { name: "validUntil", type: "uint256" },
      { name: "day", type: "uint64" },
    ],
  } as const;

  const claim = { wallet, score: BigInt(score), validUntil: BigInt(validUntil), day: BigInt(day) } as const;

  const signature = await (client as any).signTyped({ pk, domain, types, message: claim });

  return NextResponse.json({ claim: { ...claim, score: Number(score) }, signature, contractAddress });
}
