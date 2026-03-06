/**
 * Stockfish WASM integration
 * Runs engine in Web Worker for zero server cost
 */
let worker = null;
/**
 * Initialize Stockfish WASM
 */
export function initStockfish() {
    if (typeof window === 'undefined')
        return;
    try {
        worker = new Worker('/stockfish/stockfish.js');
        worker.postMessage('uci');
        worker.postMessage('isready');
    }
    catch (e) {
        console.error('Failed to initialize Stockfish:', e);
    }
}
/**
 * Analyze a position
 */
export function analyzePosition(fen, depth = 18) {
    return new Promise((resolve) => {
        if (!worker)
            initStockfish();
        if (!worker) {
            resolve({ bestMove: '', evaluation: 0 });
            return;
        }
        let evaluation = 0;
        let bestMove = '';
        const messageHandler = (e) => {
            const line = e.data;
            // Parse centipawn score
            const cpMatch = line.match(/score cp (-?\d+)/);
            if (cpMatch) {
                evaluation = parseInt(cpMatch[1]);
            }
            // Parse mate score
            const mateMatch = line.match(/score mate (-?\d+)/);
            if (mateMatch) {
                const moves = parseInt(mateMatch[1]);
                evaluation = moves > 0 ? 99999 : -99999;
            }
            // Parse best move
            const bmMatch = line.match(/bestmove (\S+)/);
            if (bmMatch) {
                bestMove = bmMatch[1];
                worker?.removeEventListener('message', messageHandler);
                resolve({ bestMove, evaluation });
            }
        };
        worker.addEventListener('message', messageHandler);
        worker.postMessage(`position fen ${fen}`);
        worker.postMessage(`go depth ${depth}`);
    });
}
/**
 * Classify move quality based on centipawn loss
 */
export function classifyMove(cpLoss, isBestMove) {
    if (isBestMove || cpLoss === 0)
        return 'best';
    if (cpLoss <= 20)
        return 'excellent';
    if (cpLoss <= 50)
        return 'good';
    if (cpLoss <= 100)
        return 'inaccuracy';
    if (cpLoss <= 300)
        return 'mistake';
    return 'blunder';
}
/**
 * Terminate Stockfish worker
 */
export function terminateStockfish() {
    if (worker) {
        worker.terminate();
        worker = null;
    }
}
