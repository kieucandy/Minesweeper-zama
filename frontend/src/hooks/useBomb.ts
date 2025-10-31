// hooks/useBomb.ts
import { useState } from "react";
import { createGame } from "../services/contract";
import { useAppKitProvider } from "@reown/appkit/react";
import type { Provider } from "@reown/appkit/react";

const SIZE = 8;
const TOTAL = SIZE * SIZE;
const BOMB_COUNT = 10;

const key = (r: number, c: number) => `${r}-${c}`;

export function useBomb(account: string | null) {
  const { walletProvider } = useAppKitProvider<Provider>("eip155");

  const [localBoard, setLocalBoard] = useState<number[][]>([]);
  const [adj, setAdj] = useState<number[][]>([]);
  const [openedTiles, setOpenedTiles] = useState<Set<string>>(new Set());
  const [bombTiles, setBombTiles] = useState<Set<string>>(new Set());
  const [flaggedTiles, setFlaggedTiles] = useState<Set<string>>(new Set());

  const [isActive, setActive] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const [statusMsg, setStatus] = useState("");

  const [loadingStep, setStep] =
    useState<"" | "encrypt" | "confirm" | "onchain">("");
  const [progress, setProgress] = useState(0);

  // Compute adjacency numbers for each non-bomb tile
  const computeAdj = (b: number[][]) => {
    const d = Array.from({ length: SIZE }, () => Array(SIZE).fill(0));
    for (let r = 0; r < SIZE; r++) {
      for (let c = 0; c < SIZE; c++) {
        if (b[r][c] === 1) continue;
        let s = 0;
        for (let dr = -1; dr <= 1; dr++)
          for (let dc = -1; dc <= 1; dc++) {
            const rr = r + dr, cc = c + dc;
            if (rr >= 0 && cc >= 0 && rr < SIZE && cc < SIZE && b[rr][cc] === 1) s++;
          }
        d[r][c] = s;
      }
    }
    return d;
  };

  // Start / restart game
  const startGame = async () => {
    if (!account) return setStatus("⚠️ Please connect your wallet first.");

    // Reset game state
    setOpenedTiles(new Set());
    setBombTiles(new Set());
    setFlaggedTiles(new Set());
    setShowAll(false);
    setActive(false);

    // Generate board locally (not on-chain)
    const flat = Array(TOTAL).fill(0);
    let placed = 0;
    while (placed < BOMB_COUNT) {
      const i = Math.floor(Math.random() * TOTAL);
      if (flat[i] === 0) (flat[i] = 1), placed++;
    }
    const matrix = Array.from({ length: SIZE }, (_, r) =>
      flat.slice(r * SIZE, r * SIZE + SIZE)
    );

    setLocalBoard(matrix);
    setAdj(computeAdj(matrix));

    // Encrypt + setup on-chain
    setStatus("🔐 Encrypting board...");
    setStep("encrypt");

    const seed = Math.floor(Math.random() * 999999);
    const timer = setInterval(() => {
      setProgress((p) => Math.min(100, p + 3));
    }, 120);

    try {
      const tx = await createGame(walletProvider!, flat, seed);
      setStep("confirm");
      setStatus("🦊 Waiting for wallet confirmation...");
      await tx.wait();
      clearInterval(timer);
      setStep("");
      setStatus("✅ Game ready! Left-click to open, Right-click to flag.");
      setActive(true);
    } catch {
      clearInterval(timer);
      setStep("");
      setStatus("❌ Transaction cancelled.");
    }
  };

  // Right-click flag toggle
  const toggleFlag = (r: number, c: number) => {
    if (!isActive || showAll) return;
    const id = key(r, c);
    if (openedTiles.has(id)) return;

    const next = new Set(flaggedTiles);
    next.has(id) ? next.delete(id) : next.add(id);
    setFlaggedTiles(next);
  };

  // Left-click reveal tile (pure client-side logic)
  const pickTile = (r: number, c: number) => {
    if (!isActive || showAll) return;

    const id = key(r, c);
    if (openedTiles.has(id) || flaggedTiles.has(id)) return;

    // Hit bomb
    if (localBoard[r][c] === 1) {
      const nb = new Set(bombTiles);
      nb.add(id);
      setBombTiles(nb);
      setShowAll(true);
      setActive(false);
      setStatus("💥 BOOM! Game Over.");
      return;
    }

    // Flood-fill reveal
    const next = new Set(openedTiles);
    const queue: [number, number][] = [[r, c]];
    let wave = 0;

    while (queue.length) {
      const [rr, cc] = queue.shift()!;
      const kk = key(rr, cc);
      if (next.has(kk)) continue;
      next.add(kk);

      // Wave animation timing
      (document.querySelector(`[data-cell="${kk}"]`) as HTMLElement)
        ?.style.setProperty("--delay", `${wave * 18}ms`);
      wave++;

      // Expand blank areas
      if (adj[rr][cc] === 0) {
        for (let dr = -1; dr <= 1; dr++)
          for (let dc = -1; dc <= 1; dc++)
            if (dr || dc) {
              const nr = rr + dr, nc = cc + dc;
              if (nr >= 0 && nc >= 0 && nr < SIZE && nc < SIZE)
                queue.push([nr, nc]);
            }
      }
    }

    setOpenedTiles(next);

    // Win condition
    if (next.size === TOTAL - BOMB_COUNT) {
      setShowAll(true);
      setActive(false);
      setStatus("🏆 Clear! You win!");
    }
  };

  return {
    SIZE, BOMB_COUNT,
    localBoard, adj,
    openedTiles, bombTiles, flaggedTiles,
    showAll, isActive,
    statusMsg, startGame, pickTile, toggleFlag,
    loadingStep, progress
  };
}
