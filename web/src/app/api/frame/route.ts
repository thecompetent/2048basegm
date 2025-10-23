import { NextRequest } from "next/server";
import { createFrames, Button } from "frog";
import { neynar } from "@neynar/nodejs-sdk";

export const dynamic = "force-dynamic";

const app = createFrames({
  basePath: "/api/frame",
});

export const GET = app(async () => {
  return {
    image: (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", width: "100%", height: "100%", background: "#111", color: "#fff", fontSize: 42 }}>
        2048basegm oyna ve GM haklarını kazan!
      </div>
    ),
    intents: [
      <Button action="/api/frame/play">Oyunu Aç</Button>,
    ],
  };
});

export const POST = GET;

