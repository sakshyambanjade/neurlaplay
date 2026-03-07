import { useState, useEffect } from "react";
import { io, Socket } from "socket.io-client";
import { Chessboard } from "react-chessboard";

const API = "http://localhost:3001";

const PRESET_MATRIX = [
  { white: "tinyllama:latest", black: "tinyllama:latest", games: 333, label: "tinyllama vs tinyllama" },
  { white: "phi3:latest",      black: "phi3:latest",      games: 333, label: "phi3 vs phi3" },
  { white: "tinyllama:latest", black: "phi3:latest",      games: 333, label: "tinyllama vs phi3 (A)" },
  { white: "phi3:latest",      black: "tinyllama:latest", games: 333, label: "phi3 vs tinyllama (B)" },
  { white: "llama3.1:8b",      black: "phi3:latest",      games: 334, label: "llama3.1 vs phi3" },
  { white: "llama3.1:8b",      black: "tinyllama:latest", games: 334, label: "llama3.1 vs tinyllama" },
];

const DEFAULT_CONFIG = {
  matchups: PRESET_MATRIX,
  seed: 42,
  temperature: 0.0,
  topP: 0.9,
  maxTokens: 128,
  contextPolicy: "full_pgn_history",
  stockfishEvalDepth: 18,
  blunderThresholdCp: 200,
};

export default function PaperRun() {
  const [config, setConfig]       = useState(DEFAULT_CONFIG);
  const [runId, setRunId]         = useState<string | null>(null);
  const [status, setStatus]       = useState<any>(null);
  const [logs, setLogs]           = useState<string[]>([]);
  const [socket, setSocket]       = useState<Socket | null>(null);
  const [artifacts, setArtifacts] = useState<string[]>([]);
  
  // Live game visualization
  const [currentFen, setCurrentFen] = useState("rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1");
  const [gameInfo, setGameInfo] = useState({ 
    white: "", 
    black: "", 
    moveNumber: 0, 
    gameNum: 0, 
    totalGames: 0 
  });
  const [quality, setQuality] = useState({
    illegalSuggestions: 0,
    correctionsApplied: 0,
    lastMove: "",
    lastModel: "",
    lastSide: ""
  });
  const [eta, setEta] = useState({
    completedGames: 0,
    totalGames: 0,
    gamesPerHour: 0,
    etaSec: null as number | null
  });
  const [completedByMatchup, setCompletedByMatchup] = useState<Record<string, number>>({});

  const keyForMatchup = (white: string, black: string) => `${white}__vs__${black}`;

  function resetUiState() {
    setRunId(null);
    setStatus(null);
    setLogs([]);
    setArtifacts([]);
    setCurrentFen("rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1");
    setGameInfo({ white: "", black: "", moveNumber: 0, gameNum: 0, totalGames: 0 });
    setQuality({ illegalSuggestions: 0, correctionsApplied: 0, lastMove: "", lastModel: "", lastSide: "" });
    setEta({ completedGames: 0, totalGames: 0, gamesPerHour: 0, etaSec: null });
  }

  // Always boot to a clean state so stale runs never lock the UI.
  useEffect(() => {
    localStorage.removeItem("paper_run_id");
    resetUiState();
    void loadProgress();
  }, []);

  useEffect(() => {
    if (!runId) return;
    const s = io(API);
    s.emit("join:paper", runId);
    
    // Paper run events
    s.on("paper:status", (d) => setStatus(d));
    s.on("paper:log",    (msg) => setLogs(l => [...l.slice(-200), msg]));
    s.on("paper:done",   (d) => { setStatus(d); fetchArtifacts(runId); });
    s.on("paper:eta",    (d: any) => setEta({
      completedGames: d.completedGames ?? 0,
      totalGames: d.totalGames ?? 0,
      gamesPerHour: d.gamesPerHour ?? 0,
      etaSec: d.etaSec ?? null
    }));
    
    // Live game events  
    s.on("game:move", (d: any) => {
      if (d.fen) setCurrentFen(d.fen);
      if (d.gameInfo) setGameInfo(d.gameInfo);
      if (d.quality) {
        setQuality((prev) => ({
          ...prev,
          illegalSuggestions: d.quality.illegalSuggestions ?? prev.illegalSuggestions,
          correctionsApplied: d.quality.correctionsApplied ?? prev.correctionsApplied,
          lastMove: d.move ?? prev.lastMove,
          lastModel: d.model ?? prev.lastModel,
          lastSide: d.side ?? prev.lastSide
        }));
      }

      if (d.move) {
        const correctionTag = d.quality?.correctionApplied ? " [corrected]" : "";
        const moveLine = `G${d.gameInfo?.gameNum ?? "?"} M${d.gameInfo?.moveNumber ?? "?"}: ${d.side ?? "?"} ${d.model ?? "?"} -> ${d.move}${correctionTag}`;
        setLogs((l) => [...l.slice(-199), moveLine]);
      }
    });
    
    s.on("game:start", (d: any) => {
      setCurrentFen("rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1");
      if (d.gameInfo) setGameInfo(d.gameInfo);
      if (d.quality) {
        setQuality((prev) => ({
          ...prev,
          illegalSuggestions: d.quality.illegalSuggestions ?? prev.illegalSuggestions,
          correctionsApplied: d.quality.correctionsApplied ?? prev.correctionsApplied
        }));
      }
    });

    s.on("game:complete", (d: any) => {
      const summaryLine = `G${d.gameInfo?.gameNum ?? "?"} finished: ${d.result ?? "?"} (${d.termination ?? "unknown"}), moves=${d.moveCount ?? "?"}`;
      setLogs((l) => [...l.slice(-199), summaryLine]);
    });
    
    setSocket(s);
    return () => { s.disconnect(); };
  }, [runId]);

  async function fetchStatus(id: string) {
    const r = await fetch(`${API}/api/paper/run/${id}/status`);
    const d = await r.json();
    setStatus(d);
    if (d.done) fetchArtifacts(id);
  }

  async function fetchArtifacts(id: string) {
    const r = await fetch(`${API}/api/paper/run/${id}/artifacts`);
    const d = await r.json();
    setArtifacts(d.files || []);
  }

  async function startRun() {
    const latestCompletedByMatchup = await loadProgress();
    const remainingMatchups = config.matchups
      .map((m) => {
        const completed = latestCompletedByMatchup[keyForMatchup(m.white, m.black)] ?? 0;
        const remaining = Math.max(0, m.games - completed);
        return { ...m, games: remaining };
      })
      .filter((m) => m.games > 0);

    if (remainingMatchups.length === 0) {
      setLogs((l) => [...l.slice(-199), "All configured matchup targets already reached."]);
      return;
    }

    localStorage.removeItem("paper_run_id");
    resetUiState();

    const r = await fetch(`${API}/api/paper/run`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...config, matchups: remainingMatchups }),
    });
    const d = await r.json();
    setRunId(d.runId);
    setLogs([`Resuming from last progress: ${remainingMatchups.map((m) => `${m.label}=${m.games}`).join(", ")}`]);
    localStorage.setItem("paper_run_id", d.runId);
  }

  async function loadProgress() {
    const r = await fetch(`${API}/api/paper/progress`);
    const d = await r.json();
    const progressMap = d.completedByMatchup || {};
    setCompletedByMatchup(progressMap);
    return progressMap as Record<string, number>;
  }

  async function continueRemaining() {
    const remainingMatchups = config.matchups
      .map((m) => {
        const completed = completedByMatchup[keyForMatchup(m.white, m.black)] ?? 0;
        const remaining = Math.max(0, m.games - completed);
        return { ...m, games: remaining };
      })
      .filter((m) => m.games > 0);

    if (remainingMatchups.length === 0) {
      setLogs((l) => [...l.slice(-199), "All configured matchup targets already reached."]);
      return;
    }

    localStorage.removeItem("paper_run_id");
    resetUiState();

    const r = await fetch(`${API}/api/paper/run`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...config, matchups: remainingMatchups }),
    });
    const d = await r.json();
    setRunId(d.runId);
    setLogs([`Continuing remaining games: ${remainingMatchups.map((m) => `${m.label}=${m.games}`).join(", ")}`]);
    localStorage.setItem("paper_run_id", d.runId);
  }

  async function resetResearch() {
    await fetch(`${API}/api/paper/reset`, { method: "POST" });
    localStorage.removeItem("paper_run_id");
    resetUiState();
  }

  const totalGames = config.matchups.reduce((s, m) => s + m.games, 0);
  const etaHours = eta.etaSec !== null ? eta.etaSec / 3600 : null;
  const etaText = etaHours !== null
    ? (etaHours >= 1 ? `${etaHours.toFixed(2)} h` : `${Math.ceil((eta.etaSec ?? 0) / 60)} min`)
    : "Calculating...";

  return (
    <div style={{ padding: 32, maxWidth: 1600, margin: "0 auto", fontFamily: "monospace", background: "#0a0a0a", minHeight: "100vh", color: "#fff" }}>
      <h1 style={{ fontSize: 36, marginBottom: 32, textAlign: "center" }}>
        ♟️ Live Chess Research - 2000 Game Run
      </h1>

      <div style={{ display: "grid", gridTemplateColumns: "600px 1fr", gap: 32, marginBottom: 32 }}>
        {/* LEFT: Live Chessboard */}
        <div>
          <div style={{ background: "linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)", padding: 20, borderRadius: 12, marginBottom: 16, border: "2px solid #4C72B0" }}>
            <h3 style={{ margin: 0, fontSize: 20 }}>🎮 Live Game View</h3>
            {gameInfo.white ? (
              <div style={{ fontSize: 14, marginTop: 12, lineHeight: 1.8 }}>
                <div>⚪ <strong>White:</strong> {gameInfo.white}</div>
                <div>⚫ <strong>Black:</strong> {gameInfo.black}</div>
                <div>🎯 <strong>Move:</strong> {gameInfo.moveNumber}</div>
                <div>📊 <strong>Game:</strong> {gameInfo.gameNum} / {gameInfo.totalGames}</div>
                <div>🧠 <strong>Illegal suggestions:</strong> {quality.illegalSuggestions}</div>
                <div>🛠️ <strong>Corrections applied:</strong> {quality.correctionsApplied}</div>
                <div>➡️ <strong>Last move:</strong> {quality.lastSide ? `${quality.lastSide} ${quality.lastModel} ${quality.lastMove}` : "-"}</div>
                <div>⏱️ <strong>Run progress:</strong> {eta.completedGames} / {eta.totalGames || totalGames}</div>
                <div>🚀 <strong>Speed:</strong> {eta.gamesPerHour > 0 ? `${eta.gamesPerHour.toFixed(1)} games/hour` : "warming up"}</div>
                <div>🕒 <strong>ETA:</strong> {etaText}</div>
              </div>
            ) : (
              <div style={{ color: "#888", fontSize: 14, marginTop: 12 }}>
                Waiting for games to start...
              </div>
            )}
          </div>
          
          <div style={{ 
            border: "4px solid #4C72B0", 
            borderRadius: 16, 
            overflow: "hidden",
            boxShadow: "0 20px 60px rgba(76, 114, 176, 0.4)"
          }}>
            <Chessboard position={currentFen} boardWidth={568} />
          </div>
        </div>

        {/* RIGHT: Config Panel */}
        <div>
          <section style={{ background: "#1a1a2e", padding: 20, borderRadius: 12, marginBottom: 20 }}>
            <h2 style={{ marginTop: 0 }}>📊 Matchups ({totalGames} total games)</h2>
            {config.matchups.map((m, i) => (
              <div key={i} style={{ display: "flex", gap: 8, marginBottom: 8, alignItems: "center" }}>
                <span style={{ width: 300, fontSize: 14 }}>{m.label}</span>
                <input 
                  value={m.games} 
                  type="number" 
                  style={{ width: 80, padding: 6, background: "#0a0a0a", color: "#fff", border: "1px solid #4C72B0", borderRadius: 4 }}
                  onChange={e => {
                    const updated = [...config.matchups];
                    updated[i] = { ...m, games: +e.target.value };
                    setConfig({ ...config, matchups: updated });
                  }} 
                />
                <span style={{ fontSize: 14 }}>games</span>
                <span style={{ fontSize: 12, color: "#8fb3ff", marginLeft: 8 }}>
                  done: {completedByMatchup[keyForMatchup(m.white, m.black)] ?? 0}
                </span>
                <span style={{ fontSize: 12, color: "#9be3a6" }}>
                  remaining: {Math.max(0, m.games - (completedByMatchup[keyForMatchup(m.white, m.black)] ?? 0))}
                </span>
              </div>
            ))}
            <div style={{ marginTop: 8 }}>
              <button
                onClick={loadProgress}
                style={{
                  padding: "8px 14px",
                  fontSize: 13,
                  background: "#2f4a7a",
                  color: "white",
                  border: "none",
                  borderRadius: 6,
                  cursor: "pointer"
                }}>
                Refresh Completed Counts
              </button>
            </div>
          </section>

          <section style={{ background: "#1a1a2e", padding: 20, borderRadius: 12 }}>
            <h2 style={{ marginTop: 0 }}>⚙️ Experiment Config</h2>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
              {[
                ["Seed",             "seed",              "number"],
                ["Temperature",      "temperature",       "number"],
                ["Top-P",            "topP",              "number"],
                ["Max Tokens",       "maxTokens",         "number"],
                ["Stockfish Depth",  "stockfishEvalDepth","number"],
                ["Blunder CP Threshold","blunderThresholdCp","number"],
              ].map(([label, key, type]) => (
                <label key={key} style={{ fontSize: 14 }}>
                  {label}
                  <input 
                    type={type} 
                    value={(config as any)[key]}
                    style={{ display: "block", width: "100%", marginTop: 6, padding: 8, background: "#0a0a0a", color: "#fff", border: "1px solid #4C72B0", borderRadius: 4 }}
                    onChange={e => setConfig({ ...config, [key]: +e.target.value })} 
                  />
                </label>
              ))}
              <label style={{ fontSize: 14 }}>
                Context Policy
                <select 
                  value={config.contextPolicy}
                  style={{ display: "block", width: "100%", marginTop: 6, padding: 8, background: "#0a0a0a", color: "#fff", border: "1px solid #4C72B0", borderRadius: 4 }}
                  onChange={e => setConfig({ ...config, contextPolicy: e.target.value })}>
                  <option value="full_pgn_history">Full PGN History</option>
                  <option value="last_10_moves">Last 10 Moves Only</option>
                  <option value="fen_only">FEN Only</option>
                </select>
              </label>
            </div>

            <button 
              onClick={startRun} 
              disabled={!!runId && !status?.done}
              style={{ 
                marginTop: 24, 
                padding: "16px 48px", 
                fontSize: 20, 
                fontWeight: "bold",
                width: "100%",
                background: (runId && !status?.done) ? "#666" : "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
                color: "white", 
                border: "none", 
                borderRadius: 12, 
                cursor: (runId && !status?.done) ? "not-allowed" : "pointer",
                boxShadow: "0 6px 20px rgba(102, 126, 234, 0.5)",
                transition: "all 0.3s"
              }}>
              {runId && !status?.done ? "🎮 Games Running..." : "🚀 Start 2000 Game Run"}
            </button>

            <button
              onClick={continueRemaining}
              style={{
                marginTop: 12,
                padding: "12px 24px",
                fontSize: 15,
                fontWeight: "bold",
                width: "100%",
                background: "#2e7d32",
                color: "white",
                border: "none",
                borderRadius: 10,
                cursor: "pointer"
              }}>
              Continue Remaining Games
            </button>

            <button
              onClick={resetResearch}
              style={{
                marginTop: 12,
                padding: "12px 24px",
                fontSize: 15,
                fontWeight: "bold",
                width: "100%",
                background: "#b23b3b",
                color: "white",
                border: "none",
                borderRadius: 10,
                cursor: "pointer"
              }}>
              Reset Research And Start Fresh
            </button>
          </section>
        </div>
      </div>

      {/* Progress */}
      {status && (
        <div style={{ background: "linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)", padding: 20, borderRadius: 12, marginBottom: 20, border: "2px solid #4C72B0" }}>
          <div style={{ fontSize: 16, marginBottom: 8 }}>
            <strong>📍 Stage:</strong> {status.step || "Initializing..."}
          </div>
          <div style={{ fontSize: 14, color: "#aaa" }}>
            <strong>Progress:</strong> {status.progress || 0} / {status.total || 0}
          </div>
          <div style={{ background: "#0a0a0a", borderRadius: 8, height: 24, marginTop: 12, overflow: "hidden" }}>
            <div style={{ 
              background: "linear-gradient(90deg, #667eea 0%, #764ba2 100%)", 
              width: `${((status.progress || 0) / (status.total || 1)) * 100}%`, 
              height: "100%",
              transition: "width 0.5s ease"
            }} />
          </div>
          {status.done && <div style={{ color: "#55A868", marginTop: 12, fontSize: 16 }}>✅ Run Complete!</div>}
          {status.error && <div style={{ color: "#ff6b6b", marginTop: 12, fontSize: 14 }}>❌ {status.error}</div>}
        </div>
      )}

      {/* Live Logs */}
      {logs.length > 0 && (
        <div style={{ marginBottom: 20 }}>
          <h2>📜 Live Activity Log</h2>
          <pre style={{ 
            background: "#000", 
            color: "#0f0",
            padding: 20, 
            borderRadius: 12, 
            height: 300, 
            overflowY: "auto", 
            fontSize: 13,
            border: "2px solid #333", 
            fontFamily: "'Courier New', monospace",
            lineHeight: 1.6
          }}>
            {logs.slice(-100).join("\n")}
          </pre>
        </div>
      )}

      {/* Artifacts */}
      {artifacts.length > 0 && (
        <div style={{ background: "#1a1a2e", padding: 20, borderRadius: 12 }}>
          <h2>📦 Download Results</h2>
          <div style={{ marginBottom: 16 }}>
            {artifacts.map(f => (
              <div key={f} style={{ marginBottom: 8 }}>
                <a 
                  href={`${API}/artifacts/${runId}/${f}`} 
                  target="_blank" 
                  rel="noreferrer"
                  style={{ color: "#667eea", fontSize: 14 }}
                >
                  📄 {f}
                </a>
              </div>
            ))}
          </div>
          <a 
            href={`${API}/api/paper/run/${runId}/artifacts?zip=true`}
            style={{ 
              display: "inline-block", 
              padding: "12px 32px",
              background: "linear-gradient(135deg, #55A868 0%, #3d8e50 100%)", 
              color: "white", 
              borderRadius: 8, 
              textDecoration: "none",
              fontSize: 16,
              fontWeight: "bold",
              boxShadow: "0 4px 15px rgba(85, 168, 104, 0.4)"
            }}>
            ⬇️ Download All (artifacts.zip)
          </a>
        </div>
      )}
    </div>
  );
}
