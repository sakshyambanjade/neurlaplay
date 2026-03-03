import { useEffect, useRef, useCallback } from 'react';
import io, { Socket } from 'socket.io-client';
import { useState } from 'react';

/**
 * useSocket - Setup and manage Socket.io connection
 */
let sharedSocket: Socket | null = null;
let socketInitialized = false;

export function useSocket() {
  const [socket, setSocket] = useState<Socket | null>(sharedSocket);

  useEffect(() => {
    if (!sharedSocket && !socketInitialized) {
      socketInitialized = true;
      const serverUrl = (import.meta as any).env?.VITE_SERVER_URL || 'http://localhost:3001';
      console.log('[Socket] Initializing singleton socket to:', serverUrl);
      
      sharedSocket = io(serverUrl, {
        reconnection: true,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000,
        reconnectionAttempts: Infinity, // Infinite reconnection attempts
        reconnectionDelayMax: 10000,
        transports: ['websocket', 'polling']
      });

      // Log socket events
      sharedSocket.on('connect', () => {
        console.log('[Socket] ✅ CONNECTED:', sharedSocket?.id);
      });

      sharedSocket.on('disconnect', (reason) => {
        console.log('[Socket] ❌ DISCONNECTED - Reason:', reason);
        console.trace('[Socket] Disconnect stack trace'); // Show where disconnect was triggered from
      });

      sharedSocket.on('connect_error', (error) => {
        console.error('[Socket] Connection error:', error);
      });

      sharedSocket.on('error', (error) => {
        console.error('[Socket] Error event:', error);
      });
    }

    setSocket(sharedSocket);

    return () => {
      // Intentionally keep shared socket alive across route/component changes
      console.log('[Socket] Component unmounting but keeping socket alive');
    };
  }, []);

  return socket;
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
