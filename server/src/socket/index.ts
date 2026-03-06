import { Server } from 'socket.io';

/**
 * Initialize Socket.io - Batch events only
 */
export function initSocket(io: Server) {
  io.on('connection', (socket) => {
    console.log(`[Socket] Client connected: ${socket.id}`);

    // Batch event: progress update
    socket.on('batch:progress', (data) => {
      io.emit('batch:progress', data);
    });

    // Batch event: game completed
    socket.on('batch:game_done', (data) => {
      io.emit('batch:game_done', data);
    });

    // Batch event: batch completed
    socket.on('batch:complete', (data) => {
      io.emit('batch:complete', data);
    });

    socket.on('disconnect', (reason) => {
      console.log(`[Socket] Client disconnected: ${socket.id} | Reason: ${reason}`);
    });
  });
}
