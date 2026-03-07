import { useState, useEffect } from "react";
import { io, Socket } from "socket.io-client";

const API = "http://localhost:3001";

const PRESET_MATRIX = [
  { white: "tinyllama:latest", black: "tinyllama:latest", games: 200, label: "tinyllama vs tinyllama" },
  { white: "phi3:latest",      black: "phi3:latest",      games: 200, label: "phi3 vs phi3" },
  { white: "tinyllama:latest", black: "phi3:latest",      games: 200, label: "tinyllama vs phi3 (A)" },
  { white: "phi3:latest",      black: "tinyllama:latest", games: 200, label: "phi3 vs tinyllama (B)" },
  { white: "llama3.1:8b",      black: "phi3:latest",      games: 200, label: "llama3.1 vs phi3" },
  { white: "llama3.1:8b",      black: "tinyllama:latest", games: 200, label: "llama3.1 vs tinyllama" },
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

  // Re-attach to existing run on refresh
  useEffect(() => {
    const saved = localStorage.getItem("paper_run_id");
    if (saved) {
      setRunId(saved);
      fetchStatus(saved);
    }
  }, []);

  useEffect(() => {
    if (!runId) return;
    const s = io(API);
    s.emit("join:paper", runId);
    s.on("paper:status", (d) => setStatus(d));
    s.on("paper:log",    (msg) => setLogs(l => [...l.slice(-200), msg]));
    s.on("paper:done",   (d) => { setStatus(d); fetchArtifacts(runId); });
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
    const r = await fetch(`${API}/api/paper/run`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(config),
    });
    const d = await r.json();
    setRunId(d.runId);
    setLogs([]);
    localStorage.setItem("paper_run_id", d.runId);
  }

  const totalGames = config.matchups.reduce((s, m) => s + m.games, 0);

  return (
    <div style={{ padding: 32, maxWidth: 900, margin: "0 auto", fontFamily: "monospace" }}>
      <h1>🧪 Paper Run Generator</h1>

      {/* Matchup Matrix */}
      <section>
        <h2>Matchups ({totalGames} total games)</h2>
        {config.matchups.map((m, i) => (
          <div key={i} style={{ display: "flex", gap: 8, marginBottom: 6, alignItems: "center" }}>
            <span style={{ width: 240 }}>{m.label}</span>
            <input value={m.games} type="number" style={{ width: 70 }}
              onChange={e => {
                const updated = [...config.matchups];
                updated[i] = { ...m, games: +e.target.value };
                setConfig({ ...config, matchups: updated });
              }} />
            <span>games</span>
          </div>
        ))}
      </section>

      {/* Decoding Params */}
      <section style={{ marginTop: 24 }}>
        <h2>Experiment Config</h2>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          {[
            ["Seed",             "seed",              "number"],
            ["Temperature",      "temperature",       "number"],
            ["Top-P",            "topP",              "number"],
            ["Max Tokens",       "maxTokens",         "number"],
            ["Stockfish Depth",  "stockfishEvalDepth","number"],
            ["Blunder CP Threshold","blunderThresholdCp","number"],
          ].map(([label, key, type]) => (
            <label key={key}>
              {label}
              <input type={type} value={(config as any)[key]}
                style={{ display: "block", width: "100%", marginTop: 4 }}
                onChange={e => setConfig({ ...config, [key]: +e.target.value })} />
            </label>
          ))}
          <label>
            Context Policy
            <select value={config.contextPolicy}
              style={{ display: "block", width: "100%", marginTop: 4 }}
              onChange={e => setConfig({ ...config, contextPolicy: e.target.value })}>
              <option value="full_pgn_history">Full PGN History</option>
              <option value="last_10_moves">Last 10 Moves Only</option>
              <option value="fen_only">FEN Only</option>
            </select>
          </label>
        </div>
      </section>

      {/* Start Button */}
      <button onClick={startRun} disabled={!!runId && !status?.done}
        style={{ marginTop: 24, padding: "12px 32px", fontSize: 16,
                 background: "#4C72B0", color: "white", border: "none", borderRadius: 8, cursor: "pointer" }}>
        {runId && !status?.done ? "⏳ Running..." : "🚀 Start Full Paper Run"}
      </button>

      {/* Progress */}
      {status && (
        <div style={{ marginTop: 24, background: "#1a1a2e", color: "#eee", padding: 16, borderRadius: 8 }}>
          <div><b>Step:</b> {status.step}</div>
          <div><b>Progress:</b> {status.progress} / {status.total}</div>
          <div style={{ background: "#333", borderRadius: 4, height: 10, marginTop: 8 }}>
            <div style={{ background: "#4C72B0", width: `${(status.progress/status.total)*100}%`, height: "100%", borderRadius: 4 }} />
          </div>
          {status.done && <div style={{ color: "#55A868", marginTop: 8 }}>✅ Done!</div>}
          {status.error && <div style={{ color: "#DD8452", marginTop: 8 }}>❌ {status.error}</div>}
        </div>
      )}

      {/* Live Logs */}
      {logs.length > 0 && (
        <pre style={{ marginTop: 16, background: "#111", color: "#aaa",
                      padding: 12, borderRadius: 8, height: 200, overflowY: "auto", fontSize: 12 }}>
          {logs.join("\n")}
        </pre>
      )}

      {/* Artifacts */}
      {artifacts.length > 0 && (
        <div style={{ marginTop: 24 }}>
          <h2>📦 Artifacts</h2>
          {artifacts.map(f => (
            <div key={f}>
              <a href={`${API}/artifacts/${runId}/${f}`} target="_blank" rel="noreferrer">{f}</a>
            </div>
          ))}
          <a href={`${API}/api/paper/run/${runId}/artifacts?zip=true`}
             style={{ display: "inline-block", marginTop: 12, padding: "8px 20px",
                      background: "#55A868", color: "white", borderRadius: 6, textDecoration: "none" }}>
            ⬇️ Download artifacts.zip
          </a>
        </div>
      )}
    </div>
  );
}
