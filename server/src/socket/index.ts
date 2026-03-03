import { Server } from 'socket.io';
import { registerMatchHandlers } from './matchHandlers';
import { registerGameHandlers } from './gameHandlers';
import { registerSpectatorHandlers } from './spectatorHandlers';

/**
 * Initialize Socket.io and register all event handlers
 */
export function initSocket(io: Server) {
  io.on('connection', (socket) => {
    console.log(`[Socket] Client connected: ${socket.id}`);

    // Register match setup handlers
    registerMatchHandlers(io, socket);

    // Register game handlers
    registerGameHandlers(io, socket);

    // Register spectator handlers
    registerSpectatorHandlers(io, socket);

    // Ping/pong for connection health
    socket.on('ping', () => {
      socket.emit('pong');
    });

    socket.on('disconnect', (reason) => {
      console.log(`[Socket] Client disconnected: ${socket.id} - ${reason}`);
    });
  });
}
