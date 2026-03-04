# LLMArena Frontend Implementation Checklist

This document outlines all the frontend components, pages, and features that need to be implemented.

## Pages (7 total)

### 1. Home Page (`client/src/pages/Home.tsx`)
**Status:** Not implemented
**Purpose:** Landing page + live games feed
**Features:**
- [ ] Hero section with "Register your bot" CTA
- [ ] Live games grid (3 columns)
  - [ ] Each card shows: white bot name, black bot name, current FEN (visual), move count, time elapsed
  - [ ] Clicking card opens `/game/:matchId` in a new tab
- [ ] Top 10 leaderboard widget in sidebar
- [ ] Recent completed games feed
- [ ] Auto-refresh list every 10 seconds

### 2. Bot Registration Page (`client/src/pages/RegisterBot.tsx`)
**Status:** Not implemented
**Purpose:** New bot setup wizard
**Features:**
- [ ] Step 1: Basic info (name, avatar emoji, bio)
- [ ] Step 2: Endpoint config
  - [ ] Endpoint URL
  - [ ] Model name
  - [ ] Auto-detect provider type from URL
- [ ] Step 3: Runner mode selection
  - [ ] Self-hosted (download script) ← default
  - [ ] Hosted (paste API key)
- [ ] Step 4: Matchmaking preferences
  - [ ] Auto-accept challenges (toggle)
  - [ ] Max concurrent games (slider)
  - [ ] Time per move (slider: 10-300 seconds)
  - [ ] Min/max Elo opponent (optional)
- [ ] Step 5: Testing
  - [ ] "Test connection" button
  - [ ] Spinner while waiting for runner to connect
  - [ ] Success ✅ or failure message
- [ ] Final step: Reveal bot token for bot runner setup

### 3. Game Spectator Page (`client/src/pages/Game.tsx`)
**Status:** Partially implemented
**Purpose:** Live chess game view for spectators
**Features:**
- [ ] Top bar: White bot | Elo | vs. | Black bot | Elo
- [ ] Chess board display (8x8 grid)
  - [ ] Interactive (can flip board, highlight last move, show legal moves on hover)
  - [ ] Or: Use react-chessboard library
- [ ] Right sidebar: Bot panels
  - [ ] White panel: name, model, avatar, current eval (if white's turn)
  - [ ] Black panel: name, model, avatar, current eval (if black's turn)
  - [ ] "Thinking..." spinner during move
- [ ] Evaluation bar (vertical) next to board
  - [ ] Updated in real-time from Stockfish WASM
  - [ ] Shows +/- centipawns
  - [ ] Visual: blue/white for white advantage, red/black for black
- [ ] Move history panel below board
  - [ ] 1.e4 e5 2.Nf3 Nc6 ... (clickable for position review)
  - [ ] Click on move → board jumps to that position
- [ ] Reasoning display
  - [ ] White's reasoning on left bubble
  - [ ] Black's reasoning on right bubble
  - [ ] Each shows the reasoning text from the LLM
- [ ] Status bar: "White is thinking... (12s left)" with timeout progress bar
- [ ] Game over modal
  - [ ] Result (1-0, 0-1, 1/2-1/2)
  - [ ] Winner and termination reason
  - [ ] Elo changes for both bots
  - [ ] "View analysis" button → `/analysis/:matchId`

### 4. Bot Profile Page (`client/src/pages/BotProfile.tsx`)
**Status:** Not implemented
**Purpose:** Public profile for each bot
**URL:** `/bot/:slug`
**Features:**
- [ ] Header card
  - [ ] Avatar emoji
  - [ ] Bot name
  - [ ] Model name and endpoint type
  - [ ] Owner name (if public)
  - [ ] Bio/description
  - [ ] "Live" indicator if currently in a game
- [ ] Stats row
  - [ ] Current Elo + peak Elo
  - [ ] W/L/D record
  - [ ] Win %
  - [ ] Current win streak / best win streak
- [ ] Elo over time chart (Recharts LineChart)
  - [ ] X-axis: date
  - [ ] Y-axis: Elo rating
  - [ ] Point for each game
- [ ] Statistics cards (3 columns)
  - [ ] Accuracy %: Average Stockfish accuracy over last 20 games
  - [ ] Avg move time: How fast LLM responds
  - [ ] Blunder rate: Blunders per game
- [ ] Opening tendencies (as white and black)
  - [ ] Top 5 opening moves and percentages
  - [ ] e4 (68%), d4 (20%), Nf3 (12%)
- [ ] Match history table (last 20)
  - [ ] Columns: date, opponent, result, termination, moves
  - [ ] Clickable rows → `/game/:matchId`
- [ ] Pagination for match history

### 5. Leaderboard Page (`client/src/pages/Leaderboard.tsx`)
**Status:** Not implemented
**Purpose:** Global rankings
**Features:**
- [ ] Filters (top bar)
  - [ ] Time range: All time / 7 days / 30 days
  - [ ] Model type: All / GPT-4o / Claude / Gemini / Groq / Llama / etc.
  - [ ] Min games: 10+ / 50+ / 100+
- [ ] Sortable table
  - [ ] Rank (1, 2, 3...)
  - [ ] Bot name (clickable → profile)
  - [ ] Model
  - [ ] Elo (default sort DESC)
  - [ ] Record (e.g., 47W-31L-12D)
  - [ ] Win %
  - [ ] Accuracy %
  - [ ] Blunder rate
  - [ ] Peak Elo
- [ ] Pagination (25 per page)
- [ ] Highlight current user's bot (if logged in)

### 6. Game Analysis Page (`client/src/pages/Analysis.tsx`)
**Status:** Not implemented
**Purpose:** Post-game move-by-move analysis
**URL:** `/analysis/:matchId`
**Features:**
- [ ] Game header
  - [ ] White bot vs Black bot
  - [ ] Result and termination
  - [ ] Total moves and game duration
  - [ ] Elo changes
- [ ] Board + explorer
  - [ ] Board showing current position
  - [ ] Navigate with arrow keys / click moves
  - [ ] Shows Stockfish eval at each position
- [ ] Moves table (all moves with analysis)
  - [ ] Columns: Move #, Player, SAN, Reasoning, SF Eval before, SF Eval after, CP Loss, Quality
  - [ ] Quality color-coded:
    - [ ] 🟢 Excellent (Best move)
    - [ ] 🟡 Good
    - [ ] 🟠 Inaccuracy
    - [ ] 🔴 Mistake
    - [ ] 🟣 Blunder
  - [ ] Click row → jump to that position on board
- [ ] Statistics cards
  - [ ] White accuracy % (avg CP loss)
  - [ ] Black accuracy %
  - [ ] White blunders
  - [ ] Black blunders
- [ ] Chart: Evaluation over game
  - [ ] X-axis: Move number
  - [ ] Y-axis: Evaluation in CP
  - [ ] Line shows material balance + positional eval
- [ ] Downloads
  - [ ] Download PGN button
  - [ ] Download CSV button (research data for analysis)

### 7. Profile/Settings Page (`client/src/pages/Profile.tsx`)
**Status:** Not implemented (User auth required)
**Purpose:** Manage owned bots
**Features:**
- [ ] List of owned bots
- [ ] For each bot:
  - [ ] Name and model
  - [ ] Current Elo and status
  - [ ] Edit button → modal with editable fields
  - [ ] Delete button → confirmation
  - [ ] Regenerate token button
- [ ] Account settings
  - [ ] Email
  - [ ] Delete account (wipes all bots)
- [ ] API documentation
  - [ ] Copy bot token for runner setup
  - [ ] Connection test status

---

## Components (15+ total)

### Board Components
- [ ] `ChessBoard.tsx` — 8x8 board display (or wrapper around react-chessboard)
- [ ] `EvalBar.tsx` — Vertical evaluation bar (blue/white → red/black)
- [ ] `MoveArrows.tsx` — Arrows showing last move on board

### Game Components
- [ ] `BotPanel.tsx` — Shows bot info (name, model, avatar, thinking spinner)
- [ ] `MoveHistory.tsx` — Scrollable move list ( clickable PGN notation)
- [ ] `StatusBar.tsx` — "White is thinking... (15s)" with timeout bar
- [ ] `ReasoningBubble.tsx` — LLM reasoning display (left/right)
- [ ] `EvaluationDisplay.tsx` — Shows CP eval in text

### Profile Components
- [ ] `EloChart.tsx` — Recharts LineChart of Elo over time
- [ ] `StatsCard.tsx` — Accuracy %, move time, blunder rate
- [ ] `OpeningTendencies.tsx` — Pie/bar chart of opening moves
- [ ] `MatchHistoryTable.tsx` — Table of last 20 games

### Leaderboard Components
- [ ] `LeaderboardTable.tsx` — Sortable table with Elo rankings
- [ ] `ModelFilter.tsx` — Dropdown to filter by model type
- [ ] `TimeRangeFilter.tsx` — All time / 7d / 30d selector

### Analysis Components
- [ ] `MoveTable.tsx` — All moves with SF quality ratings
- [ ] `EvalGraph.tsx` — Evaluation line chart over game
- [ ] `AccuracyCard.tsx` — Accuracy %stats for both sides
- [ ] `AnalysisBoard.tsx` — Board + controls for move navigation

### Shared Components
- [ ] `LoadingSpinner.tsx` — Reusable spinner
- [ ] `Card.tsx` — Container component with Tailwind styling
- [ ] `Button.tsx` — Styled button
- [ ] `Modal.tsx` — Overlay modal component
- [ ] `WizardStep.tsx` — Multi-step form component

---

## Hooks (6 total)

### Existing
- [ ] `useSocket` — Socket.io connection
- [x] `useGameStore` — Zustand store for match state

### Missing
- [ ] `useStockfish` — Initialize and call Stockfish WASM
  - [ ] `analyzePosition(fen, depth)` → Promise<{eval, bestMove}>
  - [ ] Listen to analysis progress
  - [ ] Debounce repeated analysis
- [ ] `useChess` — Wrapper around chess.js
  - [ ] `makeMove(), legalMoves(), reset()`, etc.
- [ ] `useResize` — Window resize listener for responsive board
- [ ] `useLocalStorage` — Persist UI preferences (dark mode, board orientation)
- [ ] `useCountdown` — Timer for move timeout displays

---

## Store (Zustand)

### Existing Game Store (`store/gameStore.ts`)
**Status:** Partially implemented
**Needs:**
- [ ] Add fields:
  - [ ] `whiteBot`: { name, model, elo, reasoning }
  - [ ] `blackBot`: { name, model, elo, reasoning }
  - [ ] `evaluation`: number (centipawns from SF)
  - [ ] `legalMoves`: string[] (for current position)
  - [ ] `moveArrows`: Array<{from, to}> (last move)
  - [ ] `selectedMove`: number | null (for analysis)
  - [ ] `gameLog`: Array<{color, move, reasoning, eval}>
  - [ ] `startTime`: Date
  - [ ] `endTime`: Date | null
- [ ] Add actions:
  - [ ] `setEvaluation(cp)`
  - [ ] `selectMove(moveNumber)`
  - [ ] `showGameLog(moves[])`

### New Spectator Store (`store/spectatorStore.ts`)
- [ ] Active games list
- [ ] Live game subscriptions
- [ ] Auto-refresh on interval

### New Leaderboard Store (`store/leaderboardStore.ts`)
- [ ] Bot rankings  
- [ ] Filters (time range, model, min games)
- [ ] Pagination

---

## Library Modules (5 total)

### Existing
- [ ] `lib/supabase.ts` — Supabase client
- [ ] `lib/llm.ts` — LLM API caller (same logic as bot-runner)

### Missing
- [ ] `lib/stockfish.ts` — WASM engine wrapper
  - [ ] `initStockfish()` → returns worker
  - [ ] `analyzePosition(fen, depth)` → Promise<eval>
  - [ ] `classifyMove(cpLoss)` → "best"|"excellent"|"good"|"inaccuracy"|"mistake"|"blunder"
- [ ] `lib/moveQuality.ts` — Helper functions
  - [ ] `cpLossToQuality(cpLoss)`
  - [ ] `formatEvaluation(cp)` → "+1.2" or "-0.5" or "M5"
- [ ] `lib/api.ts` — REST API calls to backend
  - [ ] `getBot(slug)`
  - [ ] `getLeaderboard(filters)`
  - [ ] `getMatch(matchId)`
  - [ ] `triggerAnalysis(matchId)`

---

## Styling & Assets

- [ ] Tailwind CSS configuration
  - [ ] Custom colors for chess board
  - [ ] Dark mode support
- [ ] Favicon (♟️ chess piece)
- [ ] Stockfish WASM files in `public/stockfish/`
  - [ ] `stockfish.js`
  - [ ] `stockfish.wasm`
  - [ ] Download from https://github.com/nmrugg/stockfish.js

---

## Priority Build Order

1. **CRITICAL:**
   - [x] MatchRoom / MatchRegistry (core game state)
   - [x] Socket handlers (move/forfeit/game end)
   - [x] Bot runner (so you can test locally)
   - [x] Matchmaker (auto-pairing)
   - [ ] `Game.tsx` page (so spectators can watch)
   - [ ] `ChessBoard.tsx` component
   - [ ] Stockfish WASM integration

2. **HIGH:**
   - [ ] `BotProfile.tsx` page (bot identity/reputation)
   - [ ] `EloChart.tsx` component
   - [ ] `Leaderboard.tsx` page
   - [ ] Supabase integration for persistence

3. **MEDIUM:**
   - [ ] `RegisterBot.tsx` page
   - [ ] Bot management/editing
   - [ ] Analysis page + components
   - [ ] Move history widget
   - [ ] Reasoning display

4. **POLISH:**
   - [ ] Dark mode
   - [ ] Animation (move arrows, piece slide)
   - [ ] Sound effects
   - [ ] Mobile responsiveness
   - [ ] Accessibility (ARIA labels, keyboard nav)

---

## Notes for Implementation

- Use **Recharts** for all charts (EloChart, EvalGraph)
- Use **react-chessboard** for board rendering (or build simple SVG board)
- Use **Zustand** for all state (already configured)
- Use **Socket.io** for live updates
- Use **Tailwind CSS** for styling
- Test with **at least 2 different LLM providers** (OpenAI + Claude + Groq)
- Every page should have loading/error states

---

## Validation Checklist Before "Done"

- [ ] 2+ bots can play a complete game in terminal
- [ ] Game result is validated correct (checkmate, stalemate, draw, timeout, forfeit)
- [ ] Elo ratings are calculated correctly
- [ ] Spectators can watch game live in browser
- [ ] Bot profiles show accurate stats and game history
- [ ] Leaderboard ranks all bots correctly
- [ ] Analysis page shows accurate move quality (Stockfish)
- [ ] Bot registration wizard guides user to create a new bot
- [ ] Bot runner successfully starts and connects
- [ ] All Socket events fire correctly (no missed events)
- [ ] Server can handle 10+ concurrent games
