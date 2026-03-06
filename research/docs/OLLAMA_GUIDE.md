# Ollama Integration Guide

## Available Models

Your local Ollama models:
- **qwen3-coder:30b** (18 GB) - Best performance
- **llama3.1:8b** (4.9 GB) - Strong general model
- **llama3:8b** (4.7 GB) - Original Llama 3
- **phi3:latest** (2.2 GB) - Compact Microsoft model
- **tinyllama:latest** (637 MB) - Baseline/testing

Cloud models: deepseek-v3.1:671b-cloud, gpt-oss:120b-cloud, qwen3-coder:480b-cloud

## Quick Start

### 1. Ensure Ollama is Running
```bash
ollama serve
```

### 2. Run Quick Test (4 games)
```bash
cd server
npm run batch:ollama:quick
```

### 3. Analyze Results
```bash
cd ../research
python analyze_research.py ../server/game-data/research-match-*.json
```

## Available Batch Commands

All commands run from `server/` directory:

```bash
cd server

# Ollama presets
npm run batch:ollama:quick        # 4 games, 2 min
npm run batch:ollama:tournament   # 18 games, 15 min

# Custom config
npm run batch:sequential ../research/configs/your_config.json

# Built-in research presets
npm run batch:sequential:test     # 2 games test
npm run batch:sequential:6games   # 6 games research batch
```

## Configuration Files

Located in `research/configs/`:

**batch_config_ollama_quick_test.json** - Quick 4-game test
```json
{
  "totalGames": 4,
  "concurrentGames": 1,
  "games": [
    {
      "whiteModel": "qwen3-coder-30b",
      "whiteEndpointUrl": "http://localhost:11434/v1/chat/completions",
      "whiteApiModel": "qwen3-coder:30b",
      "whiteApiKey": "ollama-no-auth",
      "blackModel": "llama3.1-8b",
      "blackEndpointUrl": "http://localhost:11434/v1/chat/completions",
      "blackApiModel": "llama3.1:8b",
      "blackApiKey": "ollama-no-auth",
      "enableStockfish": true,
      "moveDelayMs": 1000,
      "maxMoves": 100
    }
  ]
}
```

**batch_config_ollama_tournament.json** - Full 18-game comparison

## Analysis & Visualization

### Basic Analysis
```bash
cd research
python analyze_research.py ../server/game-data/research-match-TIMESTAMP.json
```

### Generate Research Export
```bash
python analyze_research.py ../server/game-data/research-match-TIMESTAMP.json --paper
```

### Create Visualizations
```bash
pip install matplotlib seaborn
python visualize_research.py ../server/game-data/research-match-TIMESTAMP_paper.json
```

## New Analysis Metrics

The enhanced analyzer provides:

### Game Phase Analysis
- Opening (moves 1-10)
- Middlegame (moves 11-40)  
- Endgame (moves 41+)
- Accuracy and CPL per phase

### Accuracy Breakdown
- Excellent (<0.5 CPL)
- Good (0.5-1.0 CPL)
- OK (1.0-2.0 CPL)
- Inaccuracies (2.0-5.0 CPL)
- Mistakes (5.0-10.0 CPL)
- Blunders (>10.0 CPL)

### Critical Moments
- Automatic detection of game-deciding positions
- Large evaluation swings
- Blunders in close positions

### Time Management
- Correlation between thinking time and move quality
- Fast vs slow move analysis

### Model Comparison
- Head-to-head statistics
- Color-specific performance
- Detailed accuracy breakdown

## Visualization Outputs

Charts generated in `*_charts/` folder:
- `accuracy_distribution.png` - Move quality bar chart
- `game_phase_comparison.png` - Performance by game phase
- `model_comparison.png` - Model vs model comparison
- `cpl_timeline.png` - Game progression timeline

## Performance Tips

### Large Models (30B)
```json
{
  "concurrentGames": 1,
  "moveDelayMs": 2000,
  "moveTimeoutMs": 120000
}
```

### Small Models (<7B)
```json
{
  "concurrentGames": 2,
  "moveDelayMs": 500,
  "moveTimeoutMs": 60000
}
```

## Troubleshooting

### Connection Errors
```bash
# Check Ollama is running
ollama list

# Start if needed
ollama serve
```

### Model Not Found
```bash
# Check available models
ollama list

# Pull missing model
ollama pull llama3.1:8b
```

### Out of Memory
- Set `concurrentGames: 1` in config
- Use smaller models
- Close other applications

### Wrong Directory Error
```bash
# Commands must run from server directory
cd server  # ← Important!
npm run batch:ollama:quick
```

## Expected Performance

Estimated Elo ratings by model size:
- qwen3-coder:30b → ~1600-1800 (strongest)
- llama3.1:8b → ~1400-1600
- llama3:8b → ~1350-1550
- phi3 → ~1300-1500
- tinyllama → ~1000-1200 (baseline)

Good performance indicators:
- Average CPL: 2.5-4.0 (good), 4.0-8.0 (average)
- Blunder rate: <5% (good), 5-15% (average)
- Overall accuracy: >70% (good), 50-70% (average)

## Research Workflow

1. **Setup**
   ```bash
   ollama serve
   ```

2. **Run Test**
   ```bash
   cd server
   npm run batch:ollama:quick
   ```

3. **Analyze**
   ```bash
   cd ../research
   python analyze_research.py ../server/game-data/research-match-*.json --paper
   ```

4. **Visualize**
   ```bash
   pip install matplotlib seaborn
   python visualize_research.py ../server/game-data/*_paper.json
   ```

5. **Research**
   - Use metrics for tables
   - Include charts as figures
   - Analyze critical moments for case studies

## Next Steps

- Run quick test to verify setup
- Run full tournament for comprehensive data
- Analyze results with enhanced metrics
- Generate visualizations for papers/presentations
- Experiment with different model combinations
