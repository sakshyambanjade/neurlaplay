import { SequentialGameRunner } from '../SequentialGameRunner.js';
import type { BatchConfig, PaperCollectionOptions, PaperDatapoint, GamePaperSummary } from '../types.js';

export class GameRunner {
  private readonly runner: SequentialGameRunner;

  constructor(ollamaBaseUrl: string) {
    this.runner = new SequentialGameRunner(ollamaBaseUrl);
  }

  setRunDirectory(runDir: string): void {
    this.runner.setRunDirectory(runDir);
  }

  async runBatch(config: BatchConfig): Promise<{ outputFile: string; summary: Record<string, unknown> }> {
    return this.runner.run(config);
  }

  async runPaperMatchup(
    config: BatchConfig,
    options: PaperCollectionOptions,
    hooks?: {
      onDatapoint?: (datapoint: PaperDatapoint) => void;
      onGameComplete?: (summary: GamePaperSummary) => void;
    }
  ): Promise<{ outputFile: string; summary: Record<string, unknown>; games: GamePaperSummary[] }> {
    return this.runner.runPaperBatch(config, options, hooks);
  }
}
