import React, { useEffect, useMemo, useRef, useState } from "react";
import { useBomb } from "./hooks/useBomb";
import { useWallet } from "./services/wallet";

const Icons = {
  bomb: <img src="/images/bomb.png" alt="" />,
  flag: <img src="/images/flag.png" alt="" />,
  smile: <img src="/images/smiley-face.png" alt="" />,
  cool: <img src="/images/cool-face.png" alt="" />,
  dead: <img src="/images/dead-face.png" alt="" />,
  surprised: <span style={{ fontSize: 18 }}>😮</span>,
};

function short(addr: string | null) {
  return addr ? addr.slice(0, 6) + "..." + addr.slice(-4) : "";
}

export default function App() {
  const { address, isConnected, connectWallet, disconnectWallet } = useWallet();

  const {
    SIZE, BOMB_COUNT,
    localBoard, adj,
    openedTiles, bombTiles, flaggedTiles,
    showAll, isActive,
    statusMsg, startGame, pickTile, toggleFlag,
    loadingStep, progress
  } = useBomb(address);

  const [elapsed, setElapsed] = useState(0);
  const timer = useRef<any>(null);

  // Game timer (runs only while game is active & not revealed)
  useEffect(() => {
    if (isActive && !showAll) {
      timer.current = setInterval(() => setElapsed((t) => t + 1), 1000);
    } else {
      clearInterval(timer.current);
      timer.current = null;
      if (!isActive) setElapsed(0);
    }
    return () => clearInterval(timer.current);
  }, [isActive, showAll]);

  // Which face icon should show
  const face = useMemo(() => {
    if (showAll && bombTiles.size > 0) return Icons.dead; // hit bomb
    if (showAll) return Icons.cool; // end game - no bombs hit
    return Icons.smile;
  }, [showAll, bombTiles]);

  return (
    <div style={{ minHeight: "100vh", paddingTop: 24, textAlign: "center" }}>

      {/* Wallet controls */}
      <div style={{ marginBottom: 12, color: "white", fontFamily: "MS Sans Serif" }}>
        {!isConnected ? (
          <button className="win98-btn" onClick={connectWallet}>Connect Wallet</button>
        ) : (
          <>
            ✅ {short(address)}
            <button className="win98-btn" onClick={disconnectWallet} style={{ marginLeft: 8 }}>
              Disconnect
            </button>
          </>
        )}
      </div>

      {/* Encryption / TX progress */}
      {loadingStep && (
        <div style={{ color: "white", marginBottom: 10 }}>
          {loadingStep === "encrypt" && (
            <div className="win98-progress-wrapper">
              <div className="win98-progress-bar" style={{ width: `${progress}%` }} />
            </div>
          )}
          {statusMsg}
        </div>
      )}
      {!loadingStep && statusMsg && <div style={{ color: "white", marginBottom: 8 }}>{statusMsg}</div>}

      {/* UI hint */}
      <div style={{ color: "#ffc", fontSize: 13, marginBottom: 6 }}>
        Left-click: open &nbsp;|&nbsp; Right-click: flag 🚩 &nbsp;|&nbsp; Click 😊 to restart
      </div>

      {/* Game board */}
      <table id="board" style={{ margin: "0 auto" }}>
        <tbody>

          {/* Title bar */}
          <tr>
            <td id="window-title-bar" colSpan={SIZE}>Minesweeper</td>
          </tr>

          {/* Game status bar */}
          <tr>
            <td colSpan={SIZE}>
              <div id="status-bar">
                {/* Remaining bombs (based on flags) */}
                <div id="bomb-counter">
                  {String(BOMB_COUNT - flaggedTiles.size).padStart(3, "0")}
                </div>

                {/* Reset/start button */}
                <div id="reset" onClick={startGame} style={{ cursor: "pointer" }}>
                  {face}
                </div>

                {/* Timer */}
                <div id="timer">{String(elapsed).padStart(3, "0")}</div>
              </div>
            </td>
          </tr>

          {/* Grid */}
          {localBoard.map((row, r) => (
            <tr key={r}>
              {row.map((_, c) => {
                const id = `${r}-${c}`;
                const isBomb = localBoard[r][c] === 1;
                const revealed = showAll || openedTiles.has(id);
                const flagged = flaggedTiles.has(id);

                return (
                  <td
                    key={c}
                    data-cell={id}
                    className={revealed ? "revealed wave" : flagged ? "flag" : ""}
                    onClick={() => pickTile(r, c)}
                    onContextMenu={(e) => (e.preventDefault(), toggleFlag(r, c))}
                  >
                    {flagged && !revealed ? Icons.flag :
                     revealed && isBomb ? Icons.bomb :
                     revealed && adj[r][c] > 0 ? adj[r][c] : ""}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>

      {/* Reveal animation */}
      <style>{`
        .wave { animation: waveReveal 160ms ease-out forwards; }
        @keyframes waveReveal {
          from { transform: scale(0.75); opacity: 0; }
          to   { transform: scale(1); opacity: 1; }
        }
        .flag img { width: 16px; }
      `}</style>
    </div>
  );
}
