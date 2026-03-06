# Stockfish Integration

Stockfish WASM engine is integrated for client-side chess analysis with **zero server cost**.

## Features

- ✅ Real-time position analysis
- ✅ Move quality classification (best, excellent, good, inaccuracy, mistake, blunder)
- ✅ Web Worker for non-blocking UI
- ✅ Configurable search depth

## Usage

### 1. Using the Hook

```tsx
import { useStockfish } from './hooks';

function MyComponent() {
  const { isReady, analyze } = useStockfish();

  const analyzePosition = async () => {
    const fen = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
    const result = await analyze(fen, 18); // depth = 18
    
    console.log('Best move:', result.bestMove);
    console.log('Evaluation:', result.evaluation); // in centipawns
  };

  return (
    <button onClick={analyzePosition} disabled={!isReady}>
      Analyze
    </button>
  );
}
```

### 2. Using the Component

```tsx
import { PositionAnalysis } from './components/Analysis';

function GamePage() {
  const currentFen = "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1";
  
  return <PositionAnalysis fen={currentFen} depth={18} />;
}
```

### 3. Direct API

```tsx
import { initStockfish, analyzePosition, classifyMove } from './lib/stockfish';

// Initialize once (or use useStockfish hook)
initStockfish();

// Analyze
const result = await analyzePosition(fen, 18);

// Classify move quality
const quality = classifyMove(cpLoss, isBestMove);
// Returns: 'best' | 'excellent' | 'good' | 'inaccuracy' | 'mistake' | 'blunder'
```

## Files

- `client/lib/stockfish.ts` - Core Stockfish wrapper
- `client/hooks/index.ts` - React hook for easy integration
- `client/components/Analysis/PositionAnalysis.tsx` - Example component
- `client/public/stockfish/stockfish.js` - Stockfish WASM engine (1.5MB)

## Evaluation Scale

- **Centipawns**: `100 cp = 1 pawn advantage`
- **Mate scores**: `±99999` indicates forced mate
- **Move quality**:
  - Best: 0 cp loss
  - Excellent: ≤20 cp loss
  - Good: ≤50 cp loss
  - Inaccuracy: ≤100 cp loss
  - Mistake: ≤300 cp loss
  - Blunder: >300 cp loss

## Performance

- **Depth 15**: ~0.5s (fast)
- **Depth 18**: ~2s (balanced) - **recommended**
- **Depth 20**: ~5s (deep)
- **Depth 25**: ~30s (very deep)

## Notes

- Runs entirely in browser (Web Worker)
- No server load
- ~1.5MB download (cached after first load)
- Non-blocking UI
