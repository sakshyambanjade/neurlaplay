/**
 * Socket.io hook for spectating games
 */

import { useEffect, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';

export interface GameState {
  matchId: string;
  status: 'waiting' | 'ready' | 'in_progress' | 'completed';
  fen: string;
  currentTurn: 'white' | 'black';
  legalMoves: string[];
  pgn: string;
  moves: any[];
  isGameOver: boolean;
  moveCount: number;
  whiteBotName?: string;
  blackBotName?: string;
  whiteModel?: string;
  blackModel?: string;
  startedAt?: string;
}

export interface Move {
  moveNumber: number;
  playerColor: 'white' | 'black';
  uci: string;
  san: string;
  reasoning: string;
  fen: string;
}

export interface GameOverEvent {
  result: '1-0' | '0-1' | '1/2-1/2';
  winner?: 'white' | 'black';
  termination: string;
  finalFen: string;
  pgn: string;
  totalMoves: number;
  eloChanges?: {
    white: number;
    black: number;
  };
}

interface UseSocketEvents {
  onGameState?: (state: GameState) => void;
  onMoveMade?: (move: Move) => void;
  onTurnStart?: (turn: { color: 'white' | 'black'; fen: string; legalMoves: string[]; timeoutSeconds: number }) => void;
  onGameOver?: (event: GameOverEvent) => void;
  onError?: (error: { code: string; message: string }) => void;
}

/**
 * Hook to spectate a game via Socket.io
 */
export function useSocket(matchId: string, events: UseSocketEvents = {}) {
  const socketRef = useRef<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    // Create socket connection
    const serverUrl = import.meta.env.VITE_SERVER_URL || 'http://localhost:3001';
    const socket = io(serverUrl, {
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      reconnectionAttempts: 5
    });

    socketRef.current = socket;

    // Connection handlers
    socket.on('connect', () => {
      console.log('[Socket] Connected');
      setIsConnected(true);

      // Request to spectate the match
      socket.emit('spectate', { matchId });
    });

    socket.on('disconnect', () => {
      console.log('[Socket] Disconnected');
      setIsConnected(false);
    });

    // Game state handlers
    socket.on('gameState', (state: GameState) => {
      events.onGameState?.(state);
    });

    socket.on('moveMade', (move: Move) => {
      events.onMoveMade?.(move);
    });

    socket.on('turnStart', (turn) => {
      events.onTurnStart?.(turn);
    });

    socket.on('gameOver', (result: GameOverEvent) => {
      events.onGameOver?.(result);
    });

    socket.on('error', (error) => {
      console.error('[Socket] Error:', error);
      events.onError?.(error);
    });

    // Cleanup
    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
      }
    };
  }, [matchId]);

  return {
    socket: socketRef.current,
    isConnected
  };
}
