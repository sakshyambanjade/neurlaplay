import { mkdir, readdir, readFile, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { RuleAudit } from './types.js';

type GameWithAudit = {
  gameId: string;
  result: string;
  termination: string;
  moveCount: number;
  ruleAudit?: RuleAudit;
};

type MatchFile = {
  summary?: Record<string, unknown>;
  games?: GameWithAudit[];
};

type AuditSummary = {
  generatedAt: string;
  sourceFile: string;
  totalGames: number;
  gamesWithRuleAudit: number;
  strictRulePassRate: number;
  checks: {
    boardSetupValidRate: number;
    kingPresenceValidRate: number;
    turnAlternationValidRate: number;
    ownKingSafetyMaintainedRate: number;
  };
  modelMoveQuality: {
    gamesWithoutFallbackRate: number;
    avgFallbackMovesPerGame: number;
    avgInvalidModelMoveAttemptsPerGame: number;
  };
  events: {
    totalCastlingMoves: number;
    totalEnPassantCaptures: number;
    totalPromotions: number;
    totalFallbackMoves: number;
    totalInvalidModelMoveAttempts: number;
  };
  terminations: Record<string, number>;
};

function parseArgValue(name: string): string | undefined {
  const prefix = `${name}=`;
  for (let i = 0; i < process.argv.length; i += 1) {
    const arg = process.argv[i];
    if (!arg || arg === '--') {
      continue;
    }
    if (arg.startsWith(prefix)) {
      return arg.slice(prefix.length);
    }
    if (arg === name) {
      return process.argv[i + 1];
    }
  }
  return undefined;
}

function hasFlag(flag: string): boolean {
  return process.argv.includes(flag);
}

async function findLatestMatchFile(serverCwd: string): Promise<string> {
  const candidates = [
    path.resolve(serverCwd, 'server/game-data'),
    path.resolve(serverCwd, 'game-data')
  ];

  let bestPath: string | null = null;
  let bestMtime = -1;

  for (const dir of candidates) {
    let entries: string[];
    try {
      entries = await readdir(dir);
    } catch {
      continue;
    }

    const files = entries.filter(
      (entry) =>
        entry.startsWith('paper-research-match-') &&
        entry.endsWith('.json')
    );

    for (const file of files) {
      const fullPath = path.join(dir, file);
      try {
        const info = await stat(fullPath);
        const mtime = info.mtimeMs;
        if (mtime > bestMtime) {
          bestMtime = mtime;
          bestPath = fullPath;
        }
      } catch {
        // ignore unreadable file
      }
    }
  }

  if (!bestPath) {
    throw new Error('No paper-research-match-*.json file found in expected game-data directories.');
  }

  return bestPath;
}

function pct(numerator: number, denominator: number): number {
  if (denominator <= 0) {
    return 0;
  }
  return numerator / denominator;
}

function formatPercent(value: number): string {
  return `${(value * 100).toFixed(2)}%`;
}

function summarize(sourceFile: string, games: GameWithAudit[]): AuditSummary {
  const withAudit = games.filter((g) => g.ruleAudit);
  const totalGames = games.length;

  const boardSetupPass = withAudit.filter((g) => g.ruleAudit?.boardSetupValid).length;
  const kingPresencePass = withAudit.filter((g) => g.ruleAudit?.kingPresenceValid).length;
  const turnPass = withAudit.filter((g) => g.ruleAudit?.turnAlternationValid).length;
  const kingSafetyPass = withAudit.filter((g) => g.ruleAudit?.ownKingSafetyMaintained).length;

  const strictPass = withAudit.filter((g) => {
    const a = g.ruleAudit;
    if (!a) {
      return false;
    }
    return (
      a.boardSetupValid &&
      a.kingPresenceValid &&
      a.turnAlternationValid &&
      a.ownKingSafetyMaintained
    );
  }).length;

  const totalFallbackMoves = withAudit.reduce((sum, g) => sum + (g.ruleAudit?.fallbackMovesUsed ?? 0), 0);
  const totalInvalidAttempts = withAudit.reduce((sum, g) => sum + (g.ruleAudit?.invalidModelMoveAttempts ?? 0), 0);
  const totalCastling = withAudit.reduce((sum, g) => sum + (g.ruleAudit?.castlingMoves ?? 0), 0);
  const totalEnPassant = withAudit.reduce((sum, g) => sum + (g.ruleAudit?.enPassantCaptures ?? 0), 0);
  const totalPromotions = withAudit.reduce((sum, g) => sum + (g.ruleAudit?.promotions ?? 0), 0);

  const gamesWithoutFallback = withAudit.filter((g) => (g.ruleAudit?.fallbackMovesUsed ?? 0) === 0).length;

  const terminations: Record<string, number> = {};
  for (const game of games) {
    const key = game.termination || 'unknown';
    terminations[key] = (terminations[key] ?? 0) + 1;
  }

  return {
    generatedAt: new Date().toISOString(),
    sourceFile,
    totalGames,
    gamesWithRuleAudit: withAudit.length,
    strictRulePassRate: pct(strictPass, withAudit.length),
    checks: {
      boardSetupValidRate: pct(boardSetupPass, withAudit.length),
      kingPresenceValidRate: pct(kingPresencePass, withAudit.length),
      turnAlternationValidRate: pct(turnPass, withAudit.length),
      ownKingSafetyMaintainedRate: pct(kingSafetyPass, withAudit.length)
    },
    modelMoveQuality: {
      gamesWithoutFallbackRate: pct(gamesWithoutFallback, withAudit.length),
      avgFallbackMovesPerGame: withAudit.length > 0 ? totalFallbackMoves / withAudit.length : 0,
      avgInvalidModelMoveAttemptsPerGame: withAudit.length > 0 ? totalInvalidAttempts / withAudit.length : 0
    },
    events: {
      totalCastlingMoves: totalCastling,
      totalEnPassantCaptures: totalEnPassant,
      totalPromotions,
      totalFallbackMoves,
      totalInvalidModelMoveAttempts: totalInvalidAttempts
    },
    terminations
  };
}

function toMarkdown(summary: AuditSummary): string {
  const termRows = Object.entries(summary.terminations)
    .sort((a, b) => b[1] - a[1])
    .map(([name, count]) => `| ${name} | ${count} |`)
    .join('\n');

  return [
    '# Rule Audit Summary',
    '',
    `- Generated at: ${summary.generatedAt}`,
    `- Source file: ${summary.sourceFile}`,
    `- Total games: ${summary.totalGames}`,
    `- Games with rule audit: ${summary.gamesWithRuleAudit}`,
    '',
    '## Compliance',
    '',
    `- Strict rule pass rate: ${formatPercent(summary.strictRulePassRate)}`,
    `- Board setup valid rate: ${formatPercent(summary.checks.boardSetupValidRate)}`,
    `- King presence valid rate: ${formatPercent(summary.checks.kingPresenceValidRate)}`,
    `- Turn alternation valid rate: ${formatPercent(summary.checks.turnAlternationValidRate)}`,
    `- Own king safety maintained rate: ${formatPercent(summary.checks.ownKingSafetyMaintainedRate)}`,
    '',
    '## Model Move Quality',
    '',
    `- Games without fallback: ${formatPercent(summary.modelMoveQuality.gamesWithoutFallbackRate)}`,
    `- Avg fallback moves/game: ${summary.modelMoveQuality.avgFallbackMovesPerGame.toFixed(3)}`,
    `- Avg invalid model attempts/game: ${summary.modelMoveQuality.avgInvalidModelMoveAttemptsPerGame.toFixed(3)}`,
    '',
    '## Event Totals',
    '',
    `- Castling moves: ${summary.events.totalCastlingMoves}`,
    `- En passant captures: ${summary.events.totalEnPassantCaptures}`,
    `- Promotions: ${summary.events.totalPromotions}`,
    `- Fallback moves: ${summary.events.totalFallbackMoves}`,
    `- Invalid model move attempts: ${summary.events.totalInvalidModelMoveAttempts}`,
    '',
    '## Terminations',
    '',
    '| Termination | Count |',
    '| --- | ---: |',
    termRows || '| (none) | 0 |',
    ''
  ].join('\n');
}

async function main(): Promise<void> {
  const serverCwd = process.cwd();
  const outputDir = path.resolve(serverCwd, parseArgValue('--outputDir') ?? '../research');
  const inputArg = parseArgValue('--input');

  const sourcePath = inputArg
    ? path.resolve(serverCwd, inputArg)
    : hasFlag('--latest')
      ? await findLatestMatchFile(serverCwd)
      : await findLatestMatchFile(serverCwd);

  const raw = await readFile(sourcePath, 'utf-8');
  const payload = JSON.parse(raw) as MatchFile;
  const games = payload.games ?? [];

  if (games.length === 0) {
    throw new Error('No games found in source file.');
  }

  const summary = summarize(sourcePath, games);
  const markdown = toMarkdown(summary);

  await mkdir(outputDir, { recursive: true });
  const jsonOut = path.join(outputDir, 'rule-audit-summary.json');
  const mdOut = path.join(outputDir, 'rule-audit-summary.md');

  await writeFile(jsonOut, JSON.stringify(summary, null, 2), 'utf-8');
  await writeFile(mdOut, markdown, 'utf-8');

  console.log(`Rule audit summary generated from: ${sourcePath}`);
  console.log(`JSON: ${jsonOut}`);
  console.log(`Markdown: ${mdOut}`);
  console.log(`Strict pass rate: ${formatPercent(summary.strictRulePassRate)}`);
}

main().catch((error: unknown) => {
  console.error('Rule audit summary failed:', error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
