/**
 * Concurrent Experiment CLI
 * 
 * Run: npm run experiment:concurrent
 * 
 * Launches 6-model concurrent experiment with 3 match types
 * Results automatically exported to experiment-results/
 */

import 'dotenv/config';
import ConcurrentExperimentRunner from './ConcurrentExperimentRunner';
import * as fs from 'fs';
import * as path from 'path';

const EXPERIMENT_CONFIG_PATH = path.join(__dirname, '../../research/configs/experiment-6models-concurrent.json');

async function loadConfig(configPath: string) {
  const configText = fs.readFileSync(configPath, 'utf-8');
  const config = JSON.parse(configText);

  // Substitute environment variables
  const substitute = (obj: any): any => {
    if (typeof obj === 'string') {
      if (obj.startsWith('${') && obj.endsWith('}')) {
        const envVar = obj.slice(2, -1);
        const value = process.env[envVar];
        if (!value) {
          console.warn(`⚠️  Missing environment variable: ${envVar}`);
          console.warn(`   Add to server/.env: ${envVar}=your_key`);
          console.warn(`   Get key from: ${envVar === 'GROQ_API_KEY' ? 'console.groq.com/keys' : 'provider.com'}`);
        }
        return value || '';
      }
      return obj;
    }
    if (Array.isArray(obj)) {
      return obj.map(substitute);
    }
    if (typeof obj === 'object') {
      return Object.fromEntries(
        Object.entries(obj).map(([k, v]) => [k, substitute(v)])
      );
    }
    return obj;
  };

  return substitute(config);
}

async function main() {
  console.log(`\n🧠 NeuroChess Concurrent Experiment Launcher\n`);

  // Load config
  console.log(`📖 Loading configuration from: ${EXPERIMENT_CONFIG_PATH}`);
  const config = await loadConfig(EXPERIMENT_CONFIG_PATH);

  // Validate API keys
  console.log(`\n🔑 Checking API keys...`);
  let missingKeys = 0;

  config.matchTypes.forEach((type: any, idx: number) => {
    const whiteName = `${type.whiteProvider.toUpperCase()}_API_KEY`;
    const blackName = `${type.blackProvider.toUpperCase()}_API_KEY`;

    if (!type.whiteApiKey || type.whiteApiKey === '') {
      console.warn(`  ❌ ${whiteName} (Match Type ${idx + 1} White)`);
      missingKeys++;
    } else {
      console.log(`  ✓ ${type.whiteProvider} White API key loaded`);
    }

    if (!type.blackApiKey || type.blackApiKey === '') {
      console.warn(`  ❌ ${blackName} (Match Type ${idx + 1} Black)`);
      missingKeys++;
    } else {
      console.log(`  ✓ ${type.blackProvider} Black API key loaded`);
    }
  });

  if (missingKeys > 0) {
    console.error(`\n❌ Missing ${missingKeys} API key(s). Add them to server/.env:\n`);
    console.log(config._instructions.step1_get_keys_for_free.join('\n'));
    console.log(`\nThen run: npm run experiment:concurrent`);
    process.exit(1);
  }

  console.log(`\n✅ All API keys present!\n`);

  // Create output directory
  const outputDir = path.join(process.cwd(), config.outputDir);
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  // Create runner
  const runner = new ConcurrentExperimentRunner(config);

  // Mock io for now (would be real Socket.io in production)
  const mockIo = {
    to: () => ({
      emit: () => {}
    })
  };

  // Run experiment
  try {
    await runner.run(mockIo);
    console.log(`\n✨ Experiment completed successfully!`);
    console.log(`📊 Check results in: ${outputDir}`);
  } catch (error) {
    console.error(`\n❌ Experiment failed:`, error);
    process.exit(1);
  }
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
