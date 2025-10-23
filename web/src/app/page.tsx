"use client";
import { useEffect, useMemo, useState } from "react";
import { RainbowKitProvider, getDefaultWallets, ConnectButton } from "@rainbow-me/rainbowkit";
import "@rainbow-me/rainbowkit/styles.css";
import { WagmiConfig, configureChains, createConfig } from "wagmi";
import { base, baseSepolia } from "wagmi/chains";
import { http } from "viem";
import Game2048 from "@/components/Game2048";

const rpcUrl = process.env.NEXT_PUBLIC_BASE_RPC || "https://mainnet.base.org";

export default function Home() {
  const { chains, publicClient } = useMemo(() => {
    const chainIdStr = process.env.NEXT_PUBLIC_CHAIN_ID || "8453";
    const chain = chainIdStr === "84532" ? baseSepolia : base;
    return configureChains([chain], [http(rpcUrl)]);
  }, []);

  const { connectors } = getDefaultWallets({ appName: "2048basegm", chains });
  const config = useMemo(() => createConfig({ autoConnect: true, connectors, publicClient }), [connectors, publicClient]);

  const [address, setAddress] = useState<string | null>(null);

  useEffect(() => {
    // lazy fetch address via window.ethereum if connected
    const eth = (window as any).ethereum;
    if (!eth) return;
    eth.request({ method: "eth_accounts" }).then((accs: string[]) => { if (accs?.[0]) setAddress(accs[0]); });
    eth.on?.("accountsChanged", (accs: string[]) => setAddress(accs?.[0] ?? null));
  }, []);

  return (
    <WagmiConfig config={config}>
      <RainbowKitProvider chains={chains}>
        <div className="container">
          <div className="row" style={{ justifyContent: "space-between" }}>
            <h1>2048basegm</h1>
            <ConnectButton />
          </div>
          <div className="card">
            <p>Bağlandı: {address ?? "-"}</p>
          </div>
          <Game2048 />
        </div>
      </RainbowKitProvider>
    </WagmiConfig>
  );
}
