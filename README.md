
````md
> Can LLMs really play chess, or are current benchmarks confusing formatting errors with reasoning ability?

NeurLaPlay is an open-source chess benchmark that evaluates Large Language Models using a constrained move-selection system. Instead of asking models to generate raw chess notation like `e2e4`, the model receives a numbered list of legal moves and returns only the index of the move.

This removes illegal output formatting errors and measures actual decision quality.

---

# Why NeurLaPlay?

Most LLM chess evaluations mix two very different failure types:

### 1. Format Failure
The model may know the move but outputs invalid notation.

Example:

`Knight to f3`

instead of:

`g1f3`

### 2. Decision Failure
The model outputs a legal move, but it is strategically poor.

Traditional benchmarks often treat both as the same failure.

NeurLaPlay separates them.

---

# How It Works

At each move, the model receives:

```txt
0: e7e5
1: c7c5
2: g8f6
3: d7d6
````

The model must answer:

```txt
1
```

That move is then played.

This ensures:

* No illegal move notation
* No hallucinated outputs
* Cleaner reasoning evaluation
* Better benchmarking consistency

---

# Key Results

## Free-form Generation (Traditional)

Models tested:

* TinyLlama 1.1B
* Phi-3 Mini 3.8B

Across 37,653 positions:

* 0 valid moves generated
* 100% fallback rate

Meaning many small models failed due to output formatting, not necessarily total chess ignorance.

---

## Constrained Index Protocol

Models tested:

* Llama 3.1 8B
* Qwen3 32B
* Llama 3.3 70B

Across:

* 300 games
* 34,915 positions

Overall fallback rate dropped to:

**5.9%**

---

# Surprising Finding

Win rates:

| Model         | Win Rate |
| ------------- | -------- |
| Llama 3.1 8B  | 49.0%    |
| Qwen3 32B     | 46.0%    |
| Llama 3.3 70B | 33.5%    |

Larger model underperformed, possibly due to API rate limits or infrastructure issues rather than reasoning weakness.

---

# Stack

* React + Vite frontend
* chess.js engine
* Groq API / Ollama models
* Python analytics
* Stockfish evaluation engine

---

# Features

* Legal move indexing
* Deterministic evaluation
* Retry system
* Safe fallback move logic
* Anti-loop / anti-oscillation controls
* Stockfish centipawn-loss analysis
* Tournament automation
* Reproducible manifests

---

# Example Prompt

```txt
FEN: rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1

Legal moves:
0: e7e5
1: c7c5
2: g8f6
3: d7d6

Output only the integer index.
```

---

# Why This Matters Beyond Chess

This method can improve evaluation in:

* Tool-calling agents
* Robotics decision systems
* Multiple-choice reasoning
* API action selection
* Structured planning tasks

Any domain with a fixed action space.

---

# Run Locally

```bash
git clone https://github.com/sakshyambanjade/neurlaplay
cd neurlaplay
npm install
npm run dev
```

---

# Research Paper

Included in this repository:

**Can LLMs Play Chess? Rethinking Evaluation via Constrained-Index Move Selection**

---

# Author

**Sakshyam Banjade**
Asia Pacific University of Technology & Innovation (APU)

---

# Final Statement

Many LLM benchmarks may be testing formatting reliability instead of reasoning.

NeurLaPlay is built to measure the difference.


[Full Research Paper](https://github.com/user-attachments/files/27061813/LLM_CANT_PLAY_CHESS.1.pdf)

