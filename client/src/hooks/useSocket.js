/**
 * Socket.io hook for spectating games
 */
import { useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';
/**
 * Hook to spectate a game via Socket.io
 */
export function useSocket(matchId, events = {}) {
    const socketRef = useRef(null);
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
        socket.on('gameState', (state) => {
            events.onGameState?.(state);
        });
        socket.on('moveMade', (move) => {
            events.onMoveMade?.(move);
        });
        socket.on('turnStart', (turn) => {
            events.onTurnStart?.(turn);
        });
        socket.on('gameOver', (result) => {
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
