#!/usr/bin/env node

/**
 * Sequential Game Runner CLI
 * 
 * Run chess games one-by-one (sequential) to avoid API stress and rate limiting.
 * Perfect for research papers requiring stable, reproducible results.
 * 
 * Usage:
 *   npm run batch:sequential:6games         # Run 6-game batch (recommended)
 *   npm run batch:sequential:test           # Run 2-game test
 *   npm run batch:sequential custom.json    # Use custom config file
 *   npm run batch:sequential help           # Show help
 */

import { SequentialGameRunner, SEQUENTIAL_PRESETS, SequentialBatchConfig } from './SequentialGameRunner';
import * as fs from 'fs';
import * as path from 'path';
import express from 'express';
import { Server as SocketServer } from 'socket.io';
import http from 'http';

async function main() {
  const args = process.argv.slice(2);
  const command = args[0] || '6games';
  
  let config: SequentialBatchConfig;
  
  // Parse command
  if (command === '6games') {
    config = SEQUENTIAL_PRESETS.six_games_sequential;
  } else if (command === 'test') {
    config = SEQUENTIAL_PRESETS.two_games_test;
  } else if (command === 'help' || command === '-h' || command === '--help') {
    showHelp();
    process.exit(0);
  } else if (command === 'custom' && args[1]) {
    // Load custom config file
    const configPath = path.resolve(args[1]);
    if (!fs.existsSync(configPath)) {
      console.error(`❌ Config file not found: ${configPath}`);
      process.exit(1);
    }
    config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  } else if (fs.existsSync(command)) {
    // File path provided as first arg
    config = JSON.parse(fs.readFileSync(command, 'utf8'));
  } else {
    console.log(`❌ Unknown command: ${command}\n`);
    showHelp();
    process.exit(1);
  }
  
  // Setup minimal HTTP and Socket.io server for game communication
  const app = express();
  const server = http.createServer(app);
  const io = new SocketServer(server, {
    cors: { origin: '*' }
  });
  
  // Start listening on an ephemeral port to avoid conflicts with existing dev server (e.g. :3001)
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, 'localhost', () => {
      server.off('error', reject);
      resolve();
    });
  });
  
  try {
    // Run the sequential batch
    const runner = new SequentialGameRunner(config);
    const result = await runner.run(io);
    
    // Exit successfully
    console.log(`\n✅ Batch execution completed successfully!`);
    process.exit(0);
    
  } catch (error) {
    console.error(`\n❌ Batch execution failed: ${error instanceof Error ? error.message : error}`);
    process.exit(1);
  } finally {
    server.close();
  }
}

function showHelp(): void {
  console.log(`
🎮 NeuroChess Sequential Game Runner
=====================================

Run chess games ONE-BY-ONE (sequentially) to avoid API stress.
Perfect for research papers and stable test runs.

USAGE:
  npm run batch:sequential:6games      Run 6 games (recommended)
  npm run batch:sequential:test        Run 2-game test
  npm run batch:sequential custom.json Use custom config file
  npm run batch:sequential help        Show this help message

QUICK START:

1️⃣  First time? Test with 2 games:
    npm run batch:sequential:test
    Takes ~10-15 minutes
    Outputs to: batch_results/sequential_2games_test/

2️⃣  Ready for real data? Run 6 games:
    npm run batch:sequential:6games
    Takes ~45-60 minutes
    Outputs to: batch_results/sequential_6games/

3️⃣  Custom setup:
    Create my_config.json:
    {
      "totalGames": 6,
      "moveTimeoutMs": 30000,
      "gameTimeoutMs": 600000,
      "maxRetries": 2,
      "moveDelayMs": 500,
      "interGameDelayMs": 2000,
      "games": [
        {
          "whiteModel": "gpt-4o",
          "whiteEndpointUrl": "https://api.openai.com/v1",
          "whiteApiKey": "sk-...",
          "blackModel": "claude-3.5-sonnet",
          "blackEndpointUrl": "https://api.anthropic.com",
          "blackApiKey": "sk-ant-...",
          "enableRobotExecution": false,
          "moveDelayMs": 500,
          "maxMoves": 100
        }
      ],
      "outputDir": "./batch_results/my_experiment"
    }
    
    Then run:
    npm run batch:sequential:custom my_config.json

KEY FEATURES:

✅ Sequential Execution
   Games run one-by-one, no concurrent API calls
   Prevents rate limiting and timeout errors
   Perfect for research papers

✅ Automatic Retry Logic
   Failed games retry up to 2 times
   Exponential backoff: 5s, 10s, 15s waits
   Failed games recorded but don't stop batch

✅ Comprehensive Logging
   Every decision timestamped and logged
   Log file: batch_results/.../batch_YYYY-MM-DD.log
   Summary JSON: batch_results/.../batch_summary.json

✅ Research-Grade Output
   Game-by-game results
   Combined dataset for analysis
   Publication-ready format

✅ Safety & Timeouts
   30-second timeout per LLM move
   10-minute timeout per complete game
   500ms delay between moves
   2-second delay between games

CONFIGURATION OPTIONS:

totalGames          Number of games to run (required)
games              Array of game configs (required)
outputDir          Output directory path (required)

moveTimeoutMs      Timeout per move (default: 30000)
gameTimeoutMs      Timeout per game (default: 600000)
maxRetries         Max retries per failed game (default: 2)
moveDelayMs        Delay between moves (default: 500)
interGameDelayMs   Delay between games (default: 2000)
exportInterval     Export every N games (default: 1)

GAME CONFIG:

whiteModel         LLM model for white pieces
whiteEndpointUrl   API endpoint URL
whiteApiKey        API key
blackModel         LLM model for black pieces
blackEndpointUrl   API endpoint URL
blackApiKey        API key
enableRobotExecution  Enable robotics (default: false)
moveDelayMs        Move delay (default: 500)
maxMoves           Max moves per game (default: 100)

COMMON ISSUES:

❌ "Timeout after 30000ms: White move 1"
   → AI took too long to respond, retrying...
   → If persists, check API limits and rate limits

❌ "Illegal move"
   → AI generated invalid move
   → Check if model is playing legal chess

❌ "Config file not found"
   → Check file path and ensure file exists
   → Use absolute path if in different directory

OUTPUT FILES:

batch_summary.json       Complete batch results
batch_YYYY-MM-DD.log    Timestamped log file
game_data_*.json        Individual game data
dataset.json            Combined dataset

RESEARCH PAPER TIPS:

📝 Include in your paper:
   - Final game outcomes from batch_summary.json
   - Move counts and game durations
   - Error rates and recovery statistics
   - Timestamp logs for reproducibility

📊 Analyze:
   - dataset.json has all game moves and decisions
   - Each move includes LLM reasoning and confidence
   - Compare model performance head-to-head

🔬 Reproducibility:
   - Save the config file used
   - Save API versions in logs
   - Document any hardware specs
   - Keep batch_summary.json as proof

NEED HELP?

Check these files:
  research/docs/SEQUENTIAL_QUICK_REFERENCE.md
  research/docs/TEST_GUIDE.md
  research/docs/SEQUENTIAL_RUNNER_IMPLEMENTATION.md

Need to set API keys? See:
  research/docs/START_HERE.md

For troubleshooting:
  Look in batch_results/*/batch_YYYY-MM-DD.log for detailed error messages
`);
}

// Run main
main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
