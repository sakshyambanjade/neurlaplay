import { useEffect, useRef, useCallback } from 'react';
import io, { Socket } from 'socket.io-client';

/**
 * useSocket - Setup and manage Socket.io connection
 */
export function useSocket() {
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    const serverUrl = (import.meta as any).env?.VITE_SERVER_URL || 'http://localhost:3001';
    const socket = io(serverUrl, {
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      reconnectionAttempts: 5
    });

    socketRef.current = socket;

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, []);

  return socketRef.current;
}

/**
 * useChess - Hook for chess board state management
 */
export function useChess(initialFen?: string) {
  const [fen, setFen] = useStateRef(initialFen || 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1');
  const [legalMoves, setLegalMoves] = useStateRef<string[]>([]);
  const [pgn, setPgn] = useStateRef('');
  const [moves, setMoves] = useStateRef<any[]>([]);

  return {
    fen,
    setFen,
    legalMoves,
    setLegalMoves,
    pgn,
    setPgn,
    moves,
    setMoves
  };
}

/**
 * useStockfish - Initialize and manage Stockfish analysis
 */
export function useStockfish() {
  const [isReady, setIsReady] = useStateRef(false);

  useEffect(() => {
    initStockfish();
    setIsReady(true);

    return () => {
      terminateStockfish();
    };
  }, []);

  const analyze = useCallback((fen: string, depth?: number) => {
    return analyzePosition(fen, depth);
  }, []);

  return { isReady, analyze };
}

// Helper for state + ref
function useStateRef<T>(initialValue: T) {
  const [state, setState] = React.useState<T>(initialValue);
  const ref = useRef<T>(initialValue);

  const setState_ = useCallback((value: T) => {
    ref.current = value;
    setState(value);
  }, []);

  return [state, setState_, ref] as const;
}

// Import stockfish module
import { initStockfish, terminateStockfish, analyzePosition } from '../lib/stockfish';
import React from 'react';
