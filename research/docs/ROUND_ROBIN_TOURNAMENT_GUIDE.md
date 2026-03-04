# 🏆 ROUND-ROBIN TOURNAMENT GUIDE

## Overview

A **Round-Robin Tournament** is the fairest way to rank multiple LLM models. Each model plays every other model, ensuring no model is disadvantaged by matchup selection.

### What You Get

```
INPUT:  6 LLM models (Groq, OpenRouter, Google, Mistral, HuggingFace, Together)
PROCESS: Each plays every other = 15 unique pairings
        Each pairing plays TWICE (white & black rotation)
OUTPUT: 30 total games → Complete rankings → Publication-ready table
```

---

## Tournament Structure

### 6 Models = 15 Unique Pairings

```
Pairing 1:  NeuroChess (Groq)       vs  DeepSeek (OpenRouter)
Pairing 2:  NeuroChess (Groq)       vs  Gemini 2.0 (Google)
Pairing 3:  NeuroChess (Groq)       vs  Codestral (Mistral)
Pairing 4:  NeuroChess (Groq)       vs  Qwen 2.5 (HuggingFace)
Pairing 5:  NeuroChess (Groq)       vs  Llama 3.2 (Together)

Pairing 6:  DeepSeek (OpenRouter)   vs  Gemini 2.0 (Google)
Pairing 7:  DeepSeek (OpenRouter)   vs  Codestral (Mistral)
Pairing 8:  DeepSeek (OpenRouter)   vs  Qwen 2.5 (HuggingFace)
Pairing 9:  DeepSeek (OpenRouter)   vs  Llama 3.2 (Together)

Pairing 10: Gemini 2.0 (Google)     vs  Codestral (Mistral)
Pairing 11: Gemini 2.0 (Google)     vs  Qwen 2.5 (HuggingFace)
Pairing 12: Gemini 2.0 (Google)     vs  Llama 3.2 (Together)

Pairing 13: Codestral (Mistral)     vs  Qwen 2.5 (HuggingFace)
Pairing 14: Codestral (Mistral)     vs  Llama 3.2 (Together)

Pairing 15: Qwen 2.5 (HuggingFace)  vs  Llama 3.2 (Together)
```

### Games Per Pairing: 2 (Color Balance)

For EACH pairing, two games are played:

```
Pairing 1 - Game Set A:
  Game 1:  NeuroChess (WHITE)      vs  DeepSeek (BLACK)
  Game 2:  DeepSeek (WHITE)        vs  NeuroChess (BLACK)
  
  → WHY? Testing if color advantage affects outcome
  → Both get equal white/black games
  → Ensures fair Elo ranking
```

### Total Games

```
15 pairings × 2 games per pairing = 30 total games
```

---

## Running the Tournament

### Prerequisites

Get API keys for at least 4 providers (the more, the better diversity):

```bash
✓ Groq:       https://console.groq.com/keys
✓ OpenRouter: https://openrouter.ai
✓ Google:     https://aistudio.google.com
✓ Mistral:    https://mistral.ai/platform
  HuggingFace: https://huggingface.co (optional)
  Together:   https://together.ai (optional)
```

### Step 1: Add Keys to `.env`

```bash
# server/.env
GROQ_API_KEY=gsk_...
OPENROUTER_API_KEY=sk-or-...
GOOGLE_API_KEY=AIza...
MISTRAL_API_KEY=mapi-...
HUGGINGFACE_API_KEY=hf_...
TOGETHER_API_KEY=tapi-...
```

### Step 2: Start Backend

```powershell
cd d:\llmarena\server
npm run dev
# Keep this running!
```

### Step 3: Run Tournament (New Terminal)

```powershell
cd d:\llmarena\server
npm run tournament:roundrobin
```

### Expected Output

```
================================================================================
🏆 NEUROCHESS ROUND-ROBIN TOURNAMENT LAUNCHER
================================================================================

📂 Loading config: server/src/research/configs/tournament-roundrobin.json
✓ Loaded 6 models for tournament
  • NeuroChess (Groq) (groq/llama3.1-405b) - Elo ~1850
  • DeepSeek (OpenRouter) (openrouter/deepseek-r1:free) - Elo ~1750
  • Gemini 2.0 (Google) (google/google-gemini-2.0-flash-exp) - Elo ~1650
  • Codestral (Mistral) (mistral/mistral-large-latest) - Elo ~1600
  • Qwen 2.5 (HuggingFace) (huggingface/Qwen2.5-Coder-32B) - Elo ~1550
  • Llama 3.2 (Together) (together/meta-llama/Llama-3.2-3B) - Elo ~1500

🔐 Validating API keys...
✓ All API keys found!

📋 Tournament Schedule: 15 pairings, 30 games total

Preview of Pairings:
  1. NeuroChess vs DeepSeek
     Game 1: NeuroChess (W) vs DeepSeek (B)
     Game 2: DeepSeek (W) vs NeuroChess (B)
  ... and more

⏱️ Estimated Duration: ~45 minutes

================================================================================
🚀 Starting tournament... this may take a while!
================================================================================

📋 Pairing 1/15
   NeuroChess (groq) vs DeepSeek (openrouter)
   🎮 Game 1: NeuroChess (white) vs DeepSeek (black)
      ✓ NeuroChess wins (47 moves, 12.3s)
      
   📊 Current Standings:
   ---
   1. NeuroChess              1      1-0-0    1.0         100.0%
   2. DeepSeek                1      0-0-1    0.0         0.0%
   ---

   🎮 Game 2: DeepSeek (white) vs NeuroChess (black)
      ✓ NeuroChess wins (45 moves, 10.8s)
      
   📊 Current Standings:
   ---
   1. NeuroChess              2      2-0-0    2.0         100.0%
   2. DeepSeek                2      0-0-2    0.0         0.0%
   ---

[... continues for all 15 pairings, 30 games total ...]

================================================================================
🎉 TOURNAMENT COMPLETE!
================================================================================

📊 Check these files for results:

  • tournament-results/standings.json (Final rankings)
  • tournament-results/tournament-table.md (Markdown table)
  • tournament-results/tournament-table.latex (LaTeX table for paper)
  • tournament-results/all-games.json (Detailed game records)
  • tournament-results/head-to-head.json (Individual matchup records)

📝 Ready to copy table to your research paper!
```

---

## Understanding Results

### Final Standings

After all 30 games, you'll see a table like this:

```
Rank | Model              | Provider    | Elo  | Games | W-D-L  | Score | %
-----|-------------------|-------------|------|-------|--------|-------|-------
1    | NeuroChess (Groq) | groq        | 1850 | 10    | 7-2-1  | 8.0   | 80.0%
2    | DeepSeek          | openrouter  | 1750 | 10    | 5-3-2  | 6.5   | 65.0%
3    | Gemini 2.0        | google      | 1650 | 10    | 4-3-3  | 5.5   | 55.0%
4    | Codestral         | mistral     | 1600 | 10    | 4-2-4  | 5.0   | 50.0%
5    | Qwen 2.5          | huggingface | 1550 | 10    | 3-1-6  | 3.5   | 35.0%
6    | Llama 3.2         | together    | 1500 | 10    | 2-1-7  | 2.5   | 25.0%
```

### What Each Column Means

| Column | Meaning |
|--------|---------|
| **Rank** | Final position (1st = best) |
| **Model** | LLM model name |
| **Provider** | API provider (Groq, OpenRouter, etc.) |
| **Elo** | Estimated chess strength (higher = stronger) |
| **Games** | Total games played (should be 10 for each, all 5 opponents × 2) |
| **W-D-L** | Wins-Draws-Losses |
| **Score** | Wins + 0.5×Draws (max score = 10) |
| **%** | Win percentage (Score / Max × 100) |

### Interpreting Results

**Example Analysis:**

```
NeuroChess (Groq): 7 wins, 2 draws, 1 loss = 8.0 points / 10 = 80%
  → Beat almost every model
  → Strong chess ability
  → Best choice for reasoning tasks

DeepSeek (OpenRouter): 5 wins, 3 draws, 2 losses = 6.5 points / 10 = 65%
  → Middle tier
  → Decent chess skills
  → Some variance in play

Llama 3.2 (Together): 2 wins, 1 draw, 7 losses = 2.5 points / 10 = 25%
  → Smallest model
  → Weaker at chess
  → Still viable for other tasks
```

---

## Output Files Explained

After `npm run tournament:roundrobin` completes, you'll find:

### 1. `standings.json` → Final Rankings

```json
[
  {
    "model": "NeuroChess (Groq)",
    "provider": "groq",
    "eloEstimate": 1850,
    "gamesPlayed": 10,
    "wins": 7,
    "draws": 2,
    "losses": 1,
    "winRate": 0.7,
    "drawRate": 0.2,
    "lossRate": 0.1,
    "score": 8.0,
    "scorePercentage": 80.0
  },
  ...
]
```

Use this for: **Automatic table generation, statistical analysis**

### 2. `tournament-table.md` → Markdown Table

```markdown
# Round-Robin Tournament Results

| Rank | Model | Provider | Elo | Games | W-D-L | Score | % |
|------|-------|----------|-----|-------|-------|-------|-----
| 1 | NeuroChess (Groq) | groq | 1850 | 10 | 7-2-1 | 8.0 | 80.0% |
| 2 | DeepSeek (OpenRouter) | openrouter | 1750 | 10 | 5-3-2 | 6.5 | 65.0% |
...
```

Use this for: **Copying directly into GitHub/Markdown documents**

### 3. `tournament-table.latex` → LaTeX Table (for arXiv)

```latex
\begin{table}[h]
\centering
\caption{Round-Robin Tournament Rankings (6 Models)}
\begin{tabular}{lccccccc}
\hline
Rank & Model & Provider & Elo & Games & W-D-L & Score & \% \\
\hline
1 & NeuroChess (Groq) & groq & 1850 & 10 & 7-2-1 & 8.0 & 80.0 \\
2 & DeepSeek (OpenRouter) & openrouter & 1750 & 10 & 5-3-2 & 6.5 & 65.0 \\
...
\end{tabular}
\label{table:roundrobin}
\end{table}
```

Use this for: **Direct paste into LaTeX/PDF papers**

### 4. `all-games.json` → Complete Game Records

```json
[
  {
    "whitePlayer": "NeuroChess (Groq)",
    "blackPlayer": "DeepSeek (OpenRouter)",
    "whiteProvider": "groq",
    "blackProvider": "openrouter",
    "result": "white",
    "moves": 47,
    "durationMs": 12300,
    "pgn": "1.e4 c5 2.Nf3 ... 1-0",
    "dateTime": "2026-03-05T10:15:22.123Z",
    "pairingNumber": 1,
    "gameNumber": 1
  },
  ...  (30 total games)
]
```

Use this for: **Detailed analysis, PGN extraction, move study**

### 5. `head-to-head.json` → Pairwise Records

```json
{
  "NeuroChess (Groq) vs DeepSeek (OpenRouter)": {
    "model1": "NeuroChess (Groq)",
    "model2": "DeepSeek (OpenRouter)",
    "games": 2,
    "model1Wins": 2,
    "model2Wins": 0,
    "draws": 0,
    "model1Record": "2-0-0"
  },
  ...
}
```

Use this for: **Specific matchup analysis, dominance checking**

### 6. `tournament-summary.txt` → Human-Readable Summary

```
ROUND-ROBIN TOURNAMENT SUMMARY
============================================================

Total Participants: 6
Total Pairings: 15
Total Games: 30
Date: 2026-03-05T10:45:33.456Z

FINAL STANDINGS:
------------------------------------------------------------
1. NeuroChess (Groq) (groq)
   Elo: 1850
   Record: 7W-2D-1L (10 games)
   Score: 8.0 / 10 (80.0%)

2. DeepSeek (OpenRouter) (openrouter)
   Elo: 1750
   Record: 5W-3D-2L (10 games)
   Score: 6.5 / 10 (65.0%)
   
...
```

Use this for: **Quick reference, email reports**

---

## Using Results in Your Research Paper

### Section: Results & Methodology

```latex
\section{Round-Robin Tournament Results}

We conducted a comprehensive round-robin tournament evaluating 
six free-tier LLM providers on chess move quality. Each model 
was pitted against every other model twice, once as white and 
once as black, for a total of 30 games (Table~\ref{table:roundrobin}).

The results demonstrate significant variation in chess-playing 
ability across providers. Groq's Llama3.1-405B achieved the 
highest ranking with an 80\% win rate, while Together's 
Llama3.2-3B achieved a 25\% win rate, establishing clear 
performance tiers among free-tier LLM providers.

Each pairing was conducted using identical prompting strategies 
to ensure fair comparison. The tournament structure ensures no 
selection bias, as all models faced all opponents.

\input{tables/tournament-roundrobin}  % Insert the LaTeX table here
```

### Copy-Paste LaTeX Table

Open `tournament-results/tournament-table.latex` and copy the entire content into your paper:

```latex
% In your paper's main .tex file:
\documentclass{article}

\begin{document}

\section{Results}

% PASTE HERE:
\begin{table}[h]
\centering
\caption{Round-Robin Tournament Rankings (6 Models)}
\begin{tabular}{lccccccc}
\hline
Rank & Model & Provider & Elo & Games & W-D-L & Score & \% \\
...
\end{tabular}
\label{table:roundrobin}
\end{table}

\end{document}
```

### Statistical Interpretation for Paper

```
"Our round-robin tournament provides a comprehensive benchmark
of free-tier LLM chess capability. The results form three 
distinct tiers:

Tier 1 (1800-1850 Elo): Groq's Llama3.1-405B, showing superior 
strategic reasoning.

Tier 2 (1600-1750 Elo): OpenRouter, Google, and Mistral models, 
with comparable performance.

Tier 3 (1500-1600 Elo): HuggingFace and Together models, 
showing emerging capability but lower consistency.

This stratification validates the expected correlation between 
model size/capabilities and chess move quality."
```

---

## Customizing Your Tournament

### Edit the Tournament Configuration

File: `server/src/research/configs/tournament-roundrobin.json`

```json
{
  "models": [
    {
      "name": "NeuroChess (Groq)",
      "provider": "groq",
      "model": "llama3.1-405b",
      "apiKeyEnv": "GROQ_API_KEY",
      "eloEstimate": 1850
    },
    ... more models ...
  ],
  "moveDelayMs": 500,        // Delay between moves
  "maxGamesPerModel": 150,   // Max moves per game
  "outputDirectory": "tournament-results"
}
```

### Using Only Subset of Models

To run with just 3-4 models instead of 6:

```json
{
  "models": [
    {
      "name": "NeuroChess (Groq)",
      "provider": "groq",
      "model": "llama3.1-405b",
      "apiKeyEnv": "GROQ_API_KEY",
      "eloEstimate": 1850
    },
    {
      "name": "DeepSeek (OpenRouter)",
      "provider": "openrouter",
      "model": "deepseek-r1:free",
      "apiKeyEnv": "OPENROUTER_API_KEY",
      "eloEstimate": 1750
    },
    {
      "name": "Gemini 2.0 (Google)",
      "provider": "google",
      "model": "google-gemini-2.0-flash-exp",
      "apiKeyEnv": "GOOGLE_API_KEY",
      "eloEstimate": 1650
    }
  ]
}
```

This gives you only 3 pairings × 2 games = 6 total games (much faster!)

---

## Troubleshooting

### "API Rate Limit Exceeded"

```
Error: Rate limit exceeded for Groq
Solution: 
  1. Increase moveDelayMs { higher value = slower, safer }
  2. Reduce model count
  3. Use only free API tiers (not paid)
```

### "Missing API Key"

```
Error: GROQ_API_KEY not found in server/.env
Solution:
  1. Get key from https://console.groq.com/keys
  2. Add to server/.env: GROQ_API_KEY=gsk_...
  3. Restart tournament
```

### Tournament Takes Too Long

```
Current: 45-60 minutes for 6 models
Faster:
  1. Use fewer models (3-4 instead of 6)
  2. Reduce maxGamesPerModel to 80-100
  3. Increase moveDelayMs slightly (if rate limits allow)
```

### Games Timing Out

```
Symptom: Some games reach 150 moves without decision
Fix: Lower maxGamesPerModel in config
  "maxGamesPerModel": 100  // default 150
```

---

## Tournament Workflow Summary

**For Your Research Paper:**

```
Step 1: Run Tournament
  $ npm run tournament:roundrobin
  ⏱️ Takes ~45 minutes for 6 models

Step 2: Get Results Files
  → tournament-results/standings.json (data)
  → tournament-results/tournament-table.latex (LaTeX table)

Step 3: Copy Table to Paper
  Open tournament-results/tournament-table.latex
  Paste into your .tex file
  
Step 4: Write Methodology Section
  Use template from "Using Results in Your Research Paper"
  
Step 5: Cite Results
  Table 3: Round-Robin Tournament Rankings
  Reference standings.json for percentages/statistics

Step 6: Submit to arXiv
  ✅ Complete, publication-ready data!
```

---

## Expected Results Benchmark

Based on model specifications, expect these approximate rankings:

| Rank | Model | Expected Win Rate | Notes |
|------|-------|-------------------|-------|
| 1 | Groq Llama3.1 | 75-85% | Strongest, largest model |
| 2 | OpenRouter DeepSeek | 60-70% | Good reasoning, open version |
| 3 | Google Gemini 2.0 | 50-60% | Solid all-arounder |
| 4 | Mistral Codestral | 45-55% | Good, but smaller |
| 5 | HuggingFace Qwen | 35-45% | Smaller model |
| 6 | Together Llama3.2 | 20-30% | Smallest, emerging |

**Note:** Actual results may vary based on:
- Prompt sensitivity
- API response latency
- Random seed effects
- Chess opening theory awareness

If results deviate significantly, investigate:
1. API key validity
2. Model parameter settings
3. Prompt engineering
4. Latency/timeout issues

---

## Additional Resources

- **Game Records:** `tournament-results/all-games.json` (PGNs for all games)
- **Head-to-Head Analysis:** `tournament-results/head-to-head.json`
- **Full Summary:** `tournament-results/tournament-summary.txt`
- **Configuration:** `server/src/research/configs/tournament-roundrobin.json`

---

## Citation

If publishing results from round-robin tournament, cite as:

```bibtex
@misc{llmarena_roundrobin_2026,
  title={Round-Robin LLM Chess Tournament: Comparative Analysis of Six Free-Tier Providers},
  author={Your Name},
  year={2026},
  note={Available at https://github.com/sakshyambanjade/llmarena}
}
```

---

**Ready? Run:** `npm run tournament:roundrobin` 🏆

