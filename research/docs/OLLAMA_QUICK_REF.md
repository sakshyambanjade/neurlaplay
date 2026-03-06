# 🦙 Ollama Quick Reference

## ✅ Correct Commands (Run from `server` directory)

### Quick Test (4 games, ~2 minutes)
```bash
cd server
npm run batch:ollama:quick
```

### Full Tournament (18 games, ~15 minutes)
```bash
cd server
npm run batch:ollama:tournament
```

### Custom Config
```bash
cd server
npm run batch:sequential ../research/configs/your_config.json
```

## 📊 Analyze Results

```bash
cd research
python analyze_research.py ../server/game-data/research-match-*.json --paper
```

## 📈 Generate Visualizations

```bash
cd research
pip install matplotlib seaborn
python visualize_research.py ../server/game-data/research-match-*_paper.json
```

## 🔧 Troubleshooting

### Error: "ENOENT: no such file or directory, open package.json"
**Fix**: Run commands from `server` directory, not `research` directory
```bash
cd server  # ← Important!
npm run batch:ollama:quick
```

### Error: "Connection refused" / "ECONNREFUSED"
**Fix**: Start Ollama service
```bash
ollama serve
```

### Error: "Model not found"
**Fix**: Pull the model
```bash
ollama pull llama3.1:8b
```

## 📁 File Locations

- **Configs**: `research/configs/batch_config_ollama_*.json`
- **Scripts**: Run from `server/` directory
- **Results**: `server/game-data/research-match-*.json`
- **Analysis**: Run from `research/` directory

## 🎯 Complete Workflow

```bash
# 1. Start Ollama
ollama serve

# 2. Run games (from root)
cd server
npm run batch:ollama:quick

# 3. Analyze (from root)
cd ../research
python analyze_research.py ../server/game-data/research-match-*.json --paper

# 4. Visualize
python visualize_research.py ../server/game-data/research-match-*_paper.json
```
