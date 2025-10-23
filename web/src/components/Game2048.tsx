"use client";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";

type Cell = number; // 0 means empty, otherwise tile value (2,4,8,...)

const SIZE = 4;

function emptyGrid(): Cell[][] {
  return Array.from({ length: SIZE }, () => Array.from({ length: SIZE }, () => 0));
}

function addRandomTile(grid: Cell[][]): void {
  const empties: [number, number][] = [];
  for (let r = 0; r < SIZE; r++) for (let c = 0; c < SIZE; c++) if (!grid[r][c]) empties.push([r, c]);
  if (empties.length === 0) return;
  const [r, c] = empties[Math.floor(Math.random() * empties.length)];
  grid[r][c] = Math.random() < 0.9 ? 2 : 4;
}

function clone(grid: Cell[][]): Cell[][] {
  return grid.map((row) => row.slice());
}

function compress(row: Cell[]): { row: Cell[]; score: number } {
  const filtered = row.filter((x) => x !== 0);
  const result: number[] = [];
  let score = 0;
  for (let i = 0; i < filtered.length; i++) {
    if (i < filtered.length - 1 && filtered[i] === filtered[i + 1]) {
      const v = filtered[i] * 2;
      result.push(v);
      score += v;
      i++;
    } else {
      result.push(filtered[i]);
    }
  }
  while (result.length < SIZE) result.push(0);
  return { row: result, score };
}

function rotateRight(grid: Cell[][]): Cell[][] {
  const g = emptyGrid();
  for (let r = 0; r < SIZE; r++) for (let c = 0; c < SIZE; c++) g[c][SIZE - 1 - r] = grid[r][c];
  return g;
}

function moveLeft(grid: Cell[][]): { grid: Cell[][]; moved: boolean; score: number } {
  let moved = false;
  let score = 0;
  const g = grid.map((row) => {
    const { row: r, score: s } = compress(row);
    if (r.some((x, i) => x !== row[i])) moved = true;
    score += s;
    return r;
  });
  return { grid: g, moved, score };
}

function canMove(grid: Cell[][]): boolean {
  for (let r = 0; r < SIZE; r++) for (let c = 0; c < SIZE; c++) if (grid[r][c] === 0) return true;
  for (let r = 0; r < SIZE; r++) for (let c = 0; c < SIZE - 1; c++) if (grid[r][c] === grid[r][c + 1]) return true;
  for (let c = 0; c < SIZE; c++) for (let r = 0; r < SIZE - 1; r++) if (grid[r][c] === grid[r + 1][c]) return true;
  return false;
}

export default function Game2048() {
  const [grid, setGrid] = useState<Cell[][]>(() => {
    const g = emptyGrid();
    addRandomTile(g); addRandomTile(g);
    return g;
  });
  const [score, setScore] = useState(0);
  const [moves, setMoves] = useState(0);
  const [over, setOver] = useState(false);
  const startedAt = useRef<number>(Date.now());

  const reset = useCallback(() => {
    const g = emptyGrid();
    addRandomTile(g); addRandomTile(g);
    setGrid(g); setScore(0); setMoves(0); setOver(false); startedAt.current = Date.now();
  }, []);

  const handleMove = useCallback((dir: "left" | "right" | "up" | "down") => {
    if (over) return;
    let g = clone(grid);
    let res;
    if (dir === "left") res = moveLeft(g);
    if (dir === "right") { g = rotateRight(rotateRight(g)); res = moveLeft(g); g = rotateRight(rotateRight(res.grid)); }
    if (dir === "up") { g = rotateRight(rotateRight(rotateRight(g))); res = moveLeft(g); g = rotateRight(res.grid); }
    if (dir === "down") { g = rotateRight(g); res = moveLeft(g); g = rotateRight(rotateRight(rotateRight(res.grid))); }
    if (!res) return;
    if (res.moved) { addRandomTile(g); setGrid(g); setScore((s) => s + res!.score); setMoves((m) => m + 1); }
    if (!canMove(g)) setOver(true);
  }, [grid, over]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") handleMove("left");
      if (e.key === "ArrowRight") handleMove("right");
      if (e.key === "ArrowUp") handleMove("up");
      if (e.key === "ArrowDown") handleMove("down");
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [handleMove]);

  const gameOver = over;

  const submit = async () => {
    const wallet = (window as any).ethereum;
    if (!wallet) { alert("Önce cüzdan bağlayın"); return; }
    const accounts = await wallet.request({ method: "eth_requestAccounts" });
    const address = accounts[0];
    try {
      const res = await fetch("/api/sign-score", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ wallet: address, score, moves, durationMs: Date.now() - startedAt.current })
      });
      if (!res.ok) {
        const t = await res.text();
        throw new Error(t);
      }
      const { claim, signature, contractAddress } = await res.json();
      // client sends transaction via viem public client (optional: wagmi action)
      const { createWalletClient, custom, parseAbi, getContract } = await import("viem");
      const { base } = await import("wagmi/chains");
      const client = createWalletClient({ chain: base, transport: custom((window as any).ethereum) });
      const abi = parseAbi([
        "function claimGm((address wallet,uint256 score,uint256 validUntil,uint64 day) c, bytes sig)",
      ]);
      const hash = await client.writeContract({
        address: contractAddress,
        abi,
        functionName: "claimGm",
        args: [claim, signature],
        account: address as `0x${string}`,
      });
      alert(`Tx gönderildi: ${hash}`);
    } catch (e: any) {
      alert(`Hata: ${e.message || e}`);
    }
  };

  return (
    <div className="card">
      <div className="row" style={{ justifyContent: "space-between" }}>
        <h2>2048</h2>
        <div>
          <button className="btn" onClick={reset}>Sıfırla</button>
        </div>
      </div>
      <p>Skor: {score} | Hamle: {moves} {gameOver && "| Oyun Bitti"}</p>
      <div style={{ display: "grid", gridTemplateColumns: `repeat(${SIZE}, 80px)`, gap: 8 }}>
        {grid.map((row, r) => row.map((v, c) => (
          <div key={`${r}-${c}`} style={{ width: 80, height: 80, background: v?"#fde68a":"#e5e7eb", display: "flex", alignItems: "center", justifyContent: "center", borderRadius: 8, fontWeight: 700 }}>
            {v || ""}
          </div>
        )))}
      </div>
      <div className="row" style={{ marginTop: 12 }}>
        <button className="btn" onClick={() => handleMove("up")}>↑</button>
        <button className="btn" onClick={() => handleMove("left")}>←</button>
        <button className="btn" onClick={() => handleMove("down")}>↓</button>
        <button className="btn" onClick={() => handleMove("right")}>→</button>
      </div>
      <div style={{ marginTop: 12 }}>
        <button className="btn" disabled={!gameOver} onClick={submit}>GM Claim Gönder</button>
      </div>
    </div>
  );
}

