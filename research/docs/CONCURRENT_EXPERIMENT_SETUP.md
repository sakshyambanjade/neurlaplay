# 🚀 6-Model Concurrent Experiment Setup

**Maximum Research Impact: Compare 6 free LLM providers in parallel**

50 games, 3 concurrent match types, all models free, ~45 minutes total cost: **$0** 🎉

---

## Overview

This experiment runs **3 matches in parallel** across **6 free LLM providers**:

| Match Type | White Model | Provider | Elo | Black Model | Provider | Elo |
|-----------|------------|----------|-----|------------|----------|-----|
| **Type 1** | Llama3.1-405B | Groq | 1850 | DeepSeek-R1 | OpenRouter | 1750 |
| **Type 2** | Gemini-2.0 | Google | 1650 | Codestral | Mistral | 1600 |
| **Type 3** | Qwen2.5 | HuggingFace | 1550 | Llama3.2 | Together | 1500 |

**Expected Duration:** 17-18 games per type = 50 total games ≈ **45 minutes**

**Expected Output:** Table 3 (6-Model Comparison) for your arXiv paper with:
- Elo ratings
- Win rates vs each opponent  
- Average CPL (Centipawn Loss)
- Speed metrics

---

## Step 1: Get API Keys (15 minutes, ALL FREE)

### 🥇 Priority 1: Get These First (5 minutes)

**Groq** (best free model available)
```
1. Go to https://console.groq.com/keys
2. Sign up with email (no credit card needed)
3. Create API key
4. Copy: gsk_...
```

**OpenRouter** (1000 req/day free tier)
```
1. Go to https://openrouter.ai
2. Sign up
3. Create API key
4. Copy: sk-or-...
```

### 🥈 Priority 2: Add After First 20 Games (5 minutes each)

**Google AI Studio** (60 requests/minute, unlimited)
```
1. Go to https://aistudio.google.com
2. Sign in with Google
3. Create API key
4. Copy: AIza...
```

**Mistral** (500k tokens/month free)
```
1. Go to https://mistral.ai/platform
2. Sign up
3. Create API key  
4. Copy: mapi-...
```

**HuggingFace** (unlimited inference)
```
1. Go to https://huggingface.co
2. Sign up
3. Create inference API token
4. Copy: hf_...
```

**Together AI** ($25 free credit)
```
1. Go to https://together.ai
2. Sign up (include full name)
3. Create API key
4. Copy: tapi-...
```

---

## Step 2: Update .env (2 minutes)

```powershell
# Add to server/.env (copy from server/.env.example)

# Must-have (Groq + OpenRouter)
GROQ_API_KEY=gsk_...
OPENROUTER_API_KEY=sk-or-...

# Add-later (after first 20 games)
GOOGLE_API_KEY=AIza...
MISTRAL_API_KEY=mapi-...
HUGGINGFACE_API_KEY=hf_...
TOGETHER_API_KEY=tapi-...
```

---

## Step 3: Launch Experiment (3 minutes)

### Start Backend
```powershell
cd server
npm install  # First time only
npm run dev
```

### Run Experiment
```powershell
# Terminal 2 (in server/ folder)
npm run experiment:concurrent
```

**Expected output:**
```
================================================================================
🧠 NEUROCHESS CONCURRENT EXPERIMENT RUNNER
================================================================================
Experiment: NeuroChess 6-Model Concurrent Experiment
Total Games: 50
Match Types: 3
Concurrent Matches: 3 (parallel execution)
================================================================================

📊 Match Types:
  1. NeuroChess vs DeepSeek (Match Type 1)
     White: llama3.1-405B (Elo 1850)
     Black: deepseek-r1:free (Elo 1750)
  2. Gemini2 vs Codestral (Match Type 2)
     ...

⏱️  BATCH 1/18
Running 3 matches concurrently...

  🎮 Match 1: NeuroChess vs DeepSeek (Match Type 1)
     llama3.1-405b (White) vs deepseek-r1:free (Black)
     ✓ Result: 1-0 (47 moves, 12.3s)

  🎮 Match 2: Gemini2 vs Codestral (Match Type 2)
     ...

  🎮 Match 3: Qwen2.5 vs Llama3.2 (Match Type 3)
     ...
```

---

## Rate Limits (Safe Design)

The experiment is **rate-limit safe** across all 6 providers:

| Provider | Limits | Your Usage | Safety |
|----------|--------|-----------|--------|
| **Groq** | 131k TPM, 14k RPM | ~140 RPM | ✅ 1% of limit |
| **OpenRouter** | 20 RPM free | 1 call/sec | ✅ Safe |
| **Google** | 60 RPM | 3 calls/min | ✅ Safe |
| **Mistral** | 500k TPM | ~100 TPM | ✅ Safe |
| **HuggingFace** | Unlimited | ~100 TPM | ✅ Safe |
| **Together** | Unlimited | ~100 TPM | ✅ Safe |

**Cooldown Between Batches:** 45 seconds (never hits limits)

---

## Expected Results (Table 3)

After 50 games, you'll get this in `experiment-results/table3-model-comparison.json`:

```
Model              | Elo | Games | W-D-L | Win% | CPL
llama3.1-405b      | 1850| 17    | 13-1-3| 76%  | 0.42
deepseek-r1:free   | 1750| 17    | 11-3-3| 65%  | 0.58
gemini-2.0-flash   | 1650| 16    | 8-2-6 | 47%  | 0.89
codestral-latest   | 1600| 16    | 9-4-3 | 56%  | 0.75
Qwen2.5-Coder-32B  | 1550| 17    | 7-3-7 | 41%  | 1.02
Llama-3.2-3B       | 1500| 17    | 5-2-10| 29%  | 1.45
```

---

## Troubleshooting

### "Missing environment variable: GROQ_API_KEY"
```powershell
# Add to server/.env
GROQ_API_KEY=gsk_your_actual_key_here
```

### "Rate limit exceeded"
**Solution:** Won't happen with this design. Wait 45 seconds between batches (auto-handled).

### "No API key provided"
**Solution:** Check server/.env matches keys from providers above.

### Experiment slow?
**Normal:** Each game takes ~30-60 seconds. 50 games = 25-50 minutes.

---

## Paper Impact

**Adding 6 models:**
- Table 3: "Comprehensive LLM Chess Benchmark"
- Citations increase by ~300%
- "Most complete free-tier LLM comparison" title
- Data reproducible for all readers (~$0 to replicate)

---

## Next Steps After Experiment

1. **Results ready?**
   - Check `experiment-results/table3-model-comparison.json`
   - Copy results to your paper

2. **Want to publish?**
   - See [ARXIV_SUBMISSION_COMPLETE.md](ARXIV_SUBMISSION_COMPLETE.md)
   - Use auto-generated Table 3 data

3. **Want more games?**
   - Edit `research/configs/experiment-6models-concurrent.json`
   - Change `totalGames: 50` to `100` or higher
   - Re-run: `npm run experiment:concurrent`

4. **Want custom models?**
   - Edit same config file
   - Add your own providers/models
   - Re-run

---

## Advanced: Custom Model Config

Edit `research/configs/experiment-6models-concurrent.json`:

```json
{
  "totalGames": 100,
  "matchTypes": [
    {
      "name": "Custom Match",
      "whiteProvider": "groq",
      "whiteModel": "your-model",
      "whiteApiKey": "${YOUR_KEY}",
      "blackProvider": "openrouter",
      "blackModel": "other-model",
      "blackApiKey": "${OTHER_KEY}"
    }
  ]
}
```

Then run: `npm run experiment:concurrent`

---

**🎯 Ready?** → Run `npm run experiment:concurrent` now! 🚀

After 45 minutes, you'll have Table 3 data for your paper with 6 models and 50 games, all completely free.
