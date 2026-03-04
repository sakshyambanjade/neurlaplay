#!/usr/bin/env tsx

import RoundRobinTournament from './RoundRobinTournament';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

/**
 * Tournament CLI Entry Point
 * 
 * Usage: npm run tournament:roundrobin
 * 
 * Runs a complete round-robin tournament where each model plays
 * every other model (6 models = 30 total games)
 */

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../../.env') });

interface TournamentConfig {
  models: Array<{
    name: string;
    provider: string;
    model: string;
    apiKeyEnv: string;
    eloEstimate: number;
  }>;
  maxGamesPerModel?: number;
  moveDelayMs?: number;
  outputDirectory?: string;
}

async function loadConfig(configPath: string): Promise<TournamentConfig> {
  try {
    const configContent = fs.readFileSync(configPath, 'utf-8');
    return JSON.parse(configContent);
  } catch (error) {
    console.error('❌ Failed to load tournament config:', error);
    throw error;
  }
}

function substituteEnvVars(config: TournamentConfig): void {
  config.models.forEach(model => {
    const envVarName = model.apiKeyEnv;
    const envValue = process.env[envVarName];

    if (!envValue) {
      throw new Error(
        `❌ Missing environment variable: ${envVarName}\n` +
          `   Please add it to server/.env file\n` +
          `   Example: ${envVarName}=your_actual_api_key`
      );
    }

    // Inject the actual API key
    (model as any).apiKey = envValue;
  });
}

async function main() {
  try {
    // Load default tournament config
    const configPath = path.join(
      __dirname,
      '../research/configs/tournament-roundrobin.json'
    );

    console.log('\n' + '='.repeat(80));
    console.log('🏆 NEUROCHESS ROUND-ROBIN TOURNAMENT LAUNCHER');
    console.log('='.repeat(80) + '\n');

    console.log(`📂 Loading config: ${configPath}`);
    const config = await loadConfig(configPath);

    console.log(`✓ Loaded ${config.models.length} models for tournament`);
    config.models.forEach(m => {
      console.log(`  • ${m.name} (${m.provider}/${m.model}) - Elo ~${m.eloEstimate}`);
    });

    console.log('\n🔐 Validating API keys...');
    substituteEnvVars(config);
    console.log('✓ All API keys found!\n');

    // Initialize tournament
    const tournament = new RoundRobinTournament(
      config.models.map(m => ({
        name: m.name,
        provider: m.provider,
        model: m.model,
        apiKey: (m as any).apiKey,
        eloEstimate: m.eloEstimate,
      })),
      config.outputDirectory || 'tournament-results',
      config.maxGamesPerModel || 150,
      config.moveDelayMs || 500
    );

    // Display tournament schedule
    const schedule = tournament.getSchedule();
    const totalGames = tournament.getTotalGames();

    console.log(`📋 Tournament Schedule: ${schedule.length} pairings, ${totalGames} games total\n`);

    // Show first few pairings as preview
    console.log('Preview of Pairings:');
    schedule.slice(0, 5).forEach(pairing => {
      console.log(
        `  ${pairing.pairingNumber}. ${pairing.model1} vs ${pairing.model2}`
      );
      pairing.games.forEach(game => {
        console.log(
          `     Game ${game.gameNumber}: ${game.white} (W) vs ${game.black} (B)`
        );
      });
    });
    if (schedule.length > 5) {
      console.log(`  ... and ${schedule.length - 5} more pairings`);
    }

    console.log(`\n⏱️  Estimated Duration: ~${Math.ceil(totalGames * 1.5)} minutes\n`);

    // Confirm start
    console.log('='.repeat(80));
    console.log('🚀 Starting tournament... this may take a while!');
    console.log('='.repeat(80) + '\n');

    // Run tournament
    await tournament.run();

    console.log('\n' + '='.repeat(80));
    console.log('🎉 TOURNAMENT COMPLETE!');
    console.log('='.repeat(80));
    console.log(
      '\n📊 Check these files for results:\n'
    );
    console.log(`  • tournament-results/standings.json (Final rankings)`);
    console.log(`  • tournament-results/tournament-table.md (Markdown table)`);
    console.log(`  • tournament-results/tournament-table.latex (LaTeX table for paper)`);
    console.log(`  • tournament-results/all-games.json (Detailed game records)`);
    console.log(`  • tournament-results/head-to-head.json (Individual matchup records)`);
    console.log('\n📝 Ready to copy table to your research paper!\n');
  } catch (error) {
    console.error('\n❌ Tournament failed:', error);
    process.exit(1);
  }
}

main();
