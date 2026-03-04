# ⚡ Quick Reference Card - LLM Arena

**Print this card and keep it at your desk!**

---

## 🚀 GO LIVE IN 5 MINUTES

```
Step 1: Setup (2 min)
────────────────────
cd client && npm install
cd server && npm install
# Add API keys to server/.env

Step 2: Start Servers (2 min)
─────────────────────────────
# Terminal 1
cd server && npm run dev

# Terminal 2  
cd client && npm run dev

Step 3: Open Browser (1 min)
────────────────────────────
http://localhost:5173/launcher
↓
Click button, watch it work! ✨
```

---

## 🎮 Your Options

### A. Want a beautiful web UI? (RECOMMENDED) ⭐
```
1. Visit: http://localhost:5173/launcher
2. Click start button
3. Watch live progress
4. Download results
```
Time: 45-60 min | Cost: $0 | Effort: Minimal

### B. Want to use terminal? (CLI)
```
npm run tournament:roundrobin
   ├─ 6 models
   ├─ 30 games
   ├─ Fair round-robin
   └─ 45 min

npm run experiment:concurrent
   ├─ 6 models
   ├─ 50 games
   ├─ 3 concurrent
   └─ 45 min

npm run batch:quick
   ├─ Test setup
   ├─ 3 games
   └─ 2 min
```

### C. Want to run one experiment?
```
npm run batch:50
   ├─ Single provider
   ├─ 50 games
   └─ 45 min
```

---

## 🔑 API Keys Needed

```
Required (for all models):
├─ GROQ_API_KEY              (groq.com)
└─ OPENROUTER_API_KEY        (openrouter.ai)

Optional (additional models):
├─ GOOGLE_API_KEY            (google.com)
├─ MISTRAL_API_KEY           (mistral.ai)
├─ HUGGINGFACE_API_KEY       (huggingface.co)
└─ TOGETHER_API_KEY          (together.ai)
```

**Add them to:** `server/.env`

```env
GROQ_API_KEY=gsk_yourkey...
OPENROUTER_API_KEY=sk-or-...
# etc
```

---

## 📊 What You Get

### Tournament Results
```
tournament-results/
├─ standings.json      (Model rankings by Elo)
├─ tournament-table.latex (Beautiful LaTeX table)
├─ head-to-head.json   (All match details)
├─ games.pgn           (Chess games in PGN)
└─ full-results.csv    (Complete data export)
```

### Download Formats
- 📄 LaTeX (for paper) ← Use this for Table 3!
- 📊 JSON (for processing)
- 📋 CSV (for spreadsheet)

---

## 💻 Commands You'll Use

| Command | What | Time |
|---------|------|------|
| `npm run dev` | Start everything | - |
| `npm run tournament:roundrobin` | Fair tournament | 45m |
| `npm run experiment:concurrent` | Fast parallel | 45m |
| `npm run batch:quick` | 3 games test | 2m |
| `npm run batch:50` | Single provider | 45m |
| `npm run batch:compare` | Model vs model | 12m |

---

## 🌐 URLs to Remember

| URL | What |
|-----|------|
| `http://localhost:5173` | Main app |
| `http://localhost:5173/launcher` | Game launcher |
| `http://localhost:5173/leaderboard` | Live rankings |
| `http://localhost:3001` | API server |

---

## 🐛 Troubleshooting

**Problem:** "API key not found"
```
Solution: Add GROQ_API_KEY and OPENROUTER_API_KEY to server/.env
```

**Problem:** "Port 3001 already in use"
```
Solution: 
# Windows:
netstat -ano | findstr :3001
taskkill /PID [PID] /F

# Mac/Linux:
lsof -i :3001
kill -9 [PID]
```

**Problem:** "Connection refused on localhost:3001"
```
Solution: Did you run `npm run dev` in server folder?
Terminal 1: cd server && npm run dev
Terminal 2: cd client && npm run dev
```

**Problem:** "Games won't start"
```
Solution:
1. Check API keys in server/.env exist
2. Check internet connection
3. Check logs in server terminal
```

---

## 📋 Checklist Before Running

- [ ] `server/.env` has GROQ_API_KEY
- [ ] `server/.env` has OPENROUTER_API_KEY  
- [ ] Both servers running (npm run dev in 2 terminals)
- [ ] Can open http://localhost:5173 in browser
- [ ] Browser console shows no red errors

---

## 🎯 Typical Session

```
9:00 AM  - Open launcher
9:05 AM  - Click "Start Tournament"
9:10 AM  - Grab coffee, watch progress bar
9:50 AM  - Game 29 complete
9:55 AM  - Click "Download LaTeX"
10:00 AM - Paste table into paper.tex
10:05 AM - Run pdflatex paper.tex
10:10 AM - Submit to arXiv ✨
```

**Result: Publication-ready data in ONE HOUR!**

---

## 📚 Read These Next

1. **One-click user?** → [ONE_CLICK_INTEGRATION.md](ONE_CLICK_INTEGRATION.md)
2. **Tournament curious?** → [ROUND_ROBIN_TOURNAMENT_GUIDE.md](research/docs/ROUND_ROBIN_TOURNAMENT_GUIDE.md)
3. **Batch games user?** → [BATCH_GAMES_SETUP_COMPLETE.md](research/docs/BATCH_GAMES_SETUP_COMPLETE.md)
4. **Full reference?** → [START_HERE.md](research/docs/START_HERE.md)
5. **System overview?** → [PROJECT_STRUCTURE.md](research/docs/PROJECT_STRUCTURE.md)

---

## 🚨 Critical Warnings

⚠️ **Each game costs API credits** (~$0.01 per game)  
⚠️ **Make sure API keys have quota remaining**  
⚠️ **Games take ~2 minutes each (50 games = 100 minutes)**  
⚠️ **Don't close browser during tournament**  
⚠️ **Files stay in `tournament-results/` after completion**  

---

## ✨ Pro Tips

1. **Fastest results?** Use the web launcher (zero CLI needed)
2. **Need 6 models?** Use `experiment:concurrent` (3 parallel games)
3. **Fair comparison?** Use `tournament:roundrobin` (each vs each)
4. **Testing mode?** Use `batch:quick` (fast 2-minute test)
5. **Single provider?** Use `batch:50` (consistent single model)

**Latest version:** Always check [START_HERE.md](research/docs/START_HERE.md) for updates!

---

**Last Updated:** 2024-01-15  
**Status:** Production Ready ✅  
**Questions?** Check the docs folder or create an issue.

