import { spawn } from "child_process";
import { EventEmitter } from "events";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import * as crypto from "crypto";

export interface MatchupConfig {
  white: string;
  black: string;
  games: number;
  label: string;
}

export interface PaperRunConfig {
  matchups: MatchupConfig[];
  paperAngle: "option_a_tension" | "option_b_capability";
  seed: number;
  temperature: number;
  topP: number;
  maxTokens: number;
  contextPolicy: "full_pgn_history" | "last_10_moves" | "fen_only";
  stockfishEvalDepth: number;
  blunderThresholdCp: number;
}

export interface RunStatus {
  runId: string;
  step: string;
  progress: number;
  total: number;
  done: boolean;
  error?: string;
  startedAt: string;
  finishedAt?: string;
}

const PROMPT_TEMPLATE = {
  system: "You are a chess engine. Output only the next move in UCI notation. No explanation.",
  user: "Game so far:\n{pgn}\nIt is {side} to move. Output ONLY the move in UCI notation (e.g. e2e4)."
};

export const jobEmitter = new EventEmitter();
const activeRuns = new Map<string, RunStatus>();

export function getRunStatus(runId: string): RunStatus | null {
  return activeRuns.get(runId) || loadStatusFromDisk(runId);
}

function loadStatusFromDisk(runId: string): RunStatus | null {
  const f = path.join("research/runs", runId, "status.json");
  if (!fs.existsSync(f)) return null;
  return JSON.parse(fs.readFileSync(f, "utf8"));
}

function saveStatus(status: RunStatus) {
  const dir = path.join("research/runs", status.runId);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, "status.json"), JSON.stringify(status, null, 2));
  activeRuns.set(status.runId, status);
}

function emit(runId: string, event: string, data: any) {
  jobEmitter.emit(event, { runId, ...data });
}

function log(runId: string, msg: string) {
  const line = `[${new Date().toISOString()}] ${msg}`;
  emit(runId, "paper:log", { msg: line });
  const logFile = path.join("research/runs", runId, "pipeline.log");
  fs.appendFileSync(logFile, line + "\n");
}

function updateStatus(status: RunStatus, step: string, progress: number, total: number) {
  status.step = step;
  status.progress = progress;
  status.total = total;
  saveStatus(status);
  emit(status.runId, "paper:status", status);
}

function runPython(script: string, args: string[], runId: string): Promise<void> {
  return new Promise((resolve, reject) => {
    log(runId, `Running: python ${script} ${args.join(" ")}`);
    const workDir = path.resolve(process.cwd(), "..");
    
    // Try to use venv Python if it exists
    const venvPythonWindows = path.join(workDir, ".venv", "Scripts", "python.exe");
    const pythonExe = fs.existsSync(venvPythonWindows) ? venvPythonWindows : "python";
    
    const proc = spawn(pythonExe, [script, ...args], {
      cwd: workDir,
      shell: true
    });
    proc.stdout.on("data", d => log(runId, d.toString().trim()));
    proc.stderr.on("data", d => log(runId, `[stderr] ${d.toString().trim()}`));
    proc.on("close", code => {
      if (code === 0) resolve();
      else reject(new Error(`${script} exited with code ${code}`));
    });
  });
}

function writeManifest(runId: string, config: PaperRunConfig, gitCommit: string) {
  const manifest = {
    runId,
    gitCommit,
    startedAt: new Date().toISOString(),
    config,
    promptTemplate: PROMPT_TEMPLATE,
    decodingParams: {
      temperature: config.temperature,
      topP: config.topP,
      maxTokens: config.maxTokens,
    },
    contextPolicy: config.contextPolicy,
    hardware: {
      platform: os.platform(),
      cpus: os.cpus().length,
      cpuModel: os.cpus()[0]?.model || "unknown",
      totalMemoryGB: (os.totalmem() / 1e9).toFixed(1),
      nodeVersion: process.version,
    },
    randomSeed: config.seed,
    paperAngle: config.paperAngle,
    stockfishEvalDepth: config.stockfishEvalDepth,
    blunderThresholdCp: config.blunderThresholdCp,
    uciOptions: {
      Threads: "default",
      Hash: "default",
      MultiPV: "default",
      UCI_AnalyseMode: "default",
      SyzygyPath: "none"
    },
    totalMatchups: config.matchups.length,
    totalGames: config.matchups.reduce((s, m) => s + m.games, 0),
  };
  const dir = path.join("research/runs", runId);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, "run_manifest.json"), JSON.stringify(manifest, null, 2));
  return manifest;
}

function getGitCommit(): string {
  try {
    return require("child_process")
      .execSync("git rev-parse HEAD").toString().trim();
  } catch { return "unknown"; }
}

async function mergePGNs(runId: string): Promise<string> {
  const runDir = path.join("research/runs", runId);
  const pgns = fs.readdirSync(runDir)
    .filter(f => f.endsWith(".pgn"))
    .map(f => path.join(runDir, f));

  const masterPath = path.join(runDir, "all-games.pgn");

  // Wait for write stream to finish before copying
  await new Promise<void>((resolve, reject) => {
    const out = fs.createWriteStream(masterPath);
    
    for (const pgn of pgns) {
      const content = fs.readFileSync(pgn, "utf8");
      out.write(content + "\n");
    }
    
    out.end();
    out.on('finish', () => resolve());
    out.on('error', reject);
  });

  // Also write to canonical research/all-games-v2.pgn
  const canonical = "research/all-games-v2.pgn";
  fs.copyFileSync(masterPath, canonical);
  log(runId, `Merged ${pgns.length} PGNs → ${canonical}`);
  return masterPath;
}

function validatePGNHeaders(pgn: string, runId: string): void {
  const requiredHeaders = ["White", "Black", "Date", "Result"];
  const games = pgn.split("\n\n[");
  let missing = 0;
  for (const game of games) {
    for (const h of requiredHeaders) {
      if (!game.includes(`[${h} `)) missing++;
    }
  }
  if (missing > 0) {
    log(runId, `⚠️  WARNING: ${missing} missing PGN headers detected. Fix PGN export.`);
  } else {
    log(runId, `✅ All PGN headers present`);
  }
}

export async function startPaperRun(
  runId: string,
  config: PaperRunConfig,
  runBatchFn: (matchup: MatchupConfig, runDir: string, config: PaperRunConfig) => Promise<string>
) {
  const status: RunStatus = {
    runId, step: "initializing",
    progress: 0,
    total: config.matchups.reduce((s, m) => s + m.games, 0),
    done: false,
    startedAt: new Date().toISOString(),
  };

  const runDir = path.join("research/runs", runId);
  fs.mkdirSync(runDir, { recursive: true });

  try {
    // 1. Write manifest
    const commit = getGitCommit();
    writeManifest(runId, config, commit);
    log(runId, `Manifest written. Commit: ${commit}`);

    // 2. Run all matchups
    let gamesCompleted = 0;
    for (let i = 0; i < config.matchups.length; i++) {
      const m = config.matchups[i];
      updateStatus(status, `Running: ${m.label}`, gamesCompleted, status.total);
      log(runId, `▶ Matchup ${i+1}/${config.matchups.length}: ${m.label} (${m.games} games)`);

      const pgn = await runBatchFn(m, runDir, config);

      // Validate PGN headers immediately
      if (fs.existsSync(pgn)) validatePGNHeaders(fs.readFileSync(pgn, "utf8"), runId);

      gamesCompleted += m.games;
      updateStatus(status, `Completed: ${m.label}`, gamesCompleted, status.total);
    }

    // 3. Merge PGNs
    updateStatus(status, "Merging PGNs", gamesCompleted, status.total);
    const masterPgn = await mergePGNs(runId);

    // 4. Python tension pipeline - convert paths to absolute
    const positionsCSV = path.resolve(runDir, "positions.csv");
    const perPlyCSV    = path.resolve(runDir, "tension_per_ply.csv");
    const perGameCSV   = path.resolve(runDir, "tension_per_game.csv");
    const masterPgnAbsolute = path.resolve(masterPgn);

    updateStatus(status, "Parsing positions", gamesCompleted, status.total);
    await runPython("research/tension/pgn_to_positions.py", [masterPgnAbsolute, positionsCSV], runId);

    updateStatus(status, "Computing tension", gamesCompleted, status.total);
    await runPython("research/tension/compute_tension_dataset.py", [positionsCSV, perPlyCSV, perGameCSV], runId);

    // 5. Human baseline tension (if downloaded)
    const humanPgn = path.resolve("research/baselines/humans/lichess_1400_1600_rapid.pgn");
    if (fs.existsSync(humanPgn)) {
      updateStatus(status, "Processing human baseline", gamesCompleted, status.total);
      const humanPos  = path.resolve(runDir, "human_positions.csv");
      const humanPly  = path.resolve(runDir, "human_tension_per_ply.csv");
      const humanGame = path.resolve(runDir, "human_tension_per_game.csv");
      await runPython("research/tension/pgn_to_positions.py",     [humanPgn, humanPos], runId);
      await runPython("research/tension/compute_tension_dataset.py", [humanPos, humanPly, humanGame], runId);
      log(runId, "✅ Human baseline tension computed");
    } else {
      log(runId, "⚠️  Human baseline PGN not found — run download_human_pgn.py first");
    }

    // 6. Validate metrics
    updateStatus(status, "Validating metrics", gamesCompleted, status.total);
    await runPython("research/validate_metrics.py", [path.resolve(runDir)], runId);

    // 7. Generate figures
    updateStatus(status, "Generating figures", gamesCompleted, status.total);
    await runPython("research/plot_paper_v2.py", [runDir], runId);

    // 8. Package artifacts
    updateStatus(status, "Packaging artifacts", gamesCompleted, status.total);
    await packageArtifacts(runId, runDir);

    status.done = true;
    status.finishedAt = new Date().toISOString();
    saveStatus(status);
    emit(runId, "paper:done", status);
    log(runId, "🎉 Pipeline complete!");

  } catch (err: any) {
    status.error = err.message;
    status.done = true;
    status.finishedAt = new Date().toISOString();
    saveStatus(status);
    emit(runId, "paper:done", status);
    log(runId, `❌ Pipeline failed: ${err.message}`);
  }
}

async function packageArtifacts(runId: string, runDir: string) {
  const { execSync } = require("child_process");
  const zipPath = path.join(runDir, "artifacts.zip");
  try {
    execSync(`cd "${runDir}" && zip -r artifacts.zip . --exclude "*.log"`, { stdio: "pipe" });
  } catch {
    // zip not available — list files only
  }
  const files = fs.readdirSync(runDir);
  fs.writeFileSync(
    path.join(runDir, "artifacts_manifest.json"),
    JSON.stringify({ files, runId, createdAt: new Date().toISOString() }, null, 2)
  );
}

export function getArtifacts(runId: string) {
  const runDir = path.join("research/runs", runId);
  if (!fs.existsSync(runDir)) return { files: [] };
  return { files: fs.readdirSync(runDir) };
}
