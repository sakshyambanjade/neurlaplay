#!/usr/bin/env node

/**
 * CLI script to run batch games
 * 
 * Usage:
 *   npm run batch:50        # Run 50-game tournament
 *   npm run batch:quick     # Run 3 quick test games
 *   npm run batch:compare   # Run model comparison (12 games)
 *   npm run batch:custom config.json  # Use custom config file
 */

import { BatchGameRunner, BATCH_PRESETS } from './BatchGameRunner';
import * as fs from 'fs';
import * as path from 'path';
import express from 'express';
import { Server as SocketServer } from 'socket.io';
import http from 'http';

async function main() {
  const args = process.argv.slice(2);
  const command = args[0] || 'quick';
  
  // Get request batch preset or custom config
  let config;
  
  if (command === 'quick') {
    config = BATCH_PRESETS.quick_test_3;
  } else if (command === '50') {
    config = BATCH_PRESETS.tournament_50;
  } else if (command === 'compare') {
    config = BATCH_PRESETS.model_comparison;
  } else if (command === 'custom' && args[1]) {
    // Load custom config file
    const configPath = path.resolve(args[1]);
    if (!fs.existsSync(configPath)) {
      console.error(`❌ Config file not found: ${configPath}`);
      process.exit(1);
    }
    config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  } else {
    console.log(`
🎮 NeuroChess Batch Game Runner
================================

Usage:
  npm run batch:50       - Run 50-game tournament
  npm run batch:quick    - Run 3 quick test games
  npm run batch:compare  - Run 12-game model comparison
  npm run batch:custom   - Run custom config (see examples below)

Examples:

1️⃣  Quick test (3 games, same model):
    npm run batch:quick

2️⃣  Full tournament (50 games, GPT-4o vs Claude):
    npm run batch:50

3️⃣  Model comparison (12 games, multiple matchups):
    npm run batch:compare

4️⃣  Custom configuration:
    npm run batch:custom my_config.json

📋 Sample my_config.json:
{
  "totalGames": 10,
  "concurrentGames": 3,
  "exportInterval": 5,
  "games": [
    {
      "whiteModel": "gpt-4o",
      "whiteEndpointUrl": "https://api.openai.com/v1",
      "whiteApiKey": "sk-...",
      "blackModel": "claude-3.5-sonnet",
      "blackEndpointUrl": "https://api.anthropic.com",
      "blackApiKey": "sk-ant-...",
      "enableRobotExecution": false,
      "moveDelayMs": 100,
      "enableStockfish": false
    }
  ],
  "outputDir": "./results",
  "resumeOnFail": true
}

🔑 Environment Variables:
  OPENAI_API_KEY=sk-...
  ANTHROPIC_API_KEY=sk-ant-...

After running, check batch_report.json for results.
    `);
    process.exit(0);
  }
  
  // Create minimal Express/Socket.io server for batch runner
  const app = express();
  const httpServer = http.createServer(app);
  const io = new SocketServer(httpServer, {
    cors: { origin: '*' }
  });
  
  // Start batch runner
  const runner = new BatchGameRunner(config as any);
  
  try {
    await runner.run(io);
    
    console.log(`\n📊 Final Results:`);
    const progress = runner.getProgress();
    console.log(`  Completed: ${progress.completed}`);
    console.log(`  Failed: ${progress.failed}`);
    console.log(`  Success Rate: ${((progress.completed/(progress.completed+progress.failed))*100).toFixed(1)}%`);
    
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Batch run failed:', error);
    process.exit(1);
  }
}

main();
