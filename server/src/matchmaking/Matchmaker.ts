/**
 * Matchmaker - Autonomous bot pairing
 * Runs every 60 seconds and pairs eligible bots by Elo proximity
 */

import { Server } from 'socket.io';
import { registry } from '../game/MatchRegistry';

const MATCHMAKING_INTERVAL_MS = 60_000;
const ELO_WINDOW = 200; // Only match bots within 200 Elo points

interface ActiveBot {
  id: string;
  name: string;
  elo: number;
  socketId: string;
  preference?: {
    maxConcurrent?: number;
    minElo?: number;
    maxElo?: number;
  };
}

export class Matchmaker {
  private io: Server;
  private activeBots: Map<string, ActiveBot> = new Map();
  private interval: NodeJS.Timeout | null = null;

  constructor(io: Server) {
    this.io = io;
  }

  /**
   * Start the matchmaking loop
   */
  start() {
    console.log('[Matchmaker] Started');

    this.runMatchmakingCycle(); // Run immediately
    this.interval = setInterval(() => {
      this.runMatchmakingCycle();
    }, MATCHMAKING_INTERVAL_MS);
  }

  /**
   * Stop the matchmaker
   */
  stop() {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
    console.log('[Matchmaker] Stopped');
  }

  /**
   * Register an active bot
   */
  registerBot(botId: string, botName: string, elo: number, socketId: string) {
    this.activeBots.set(botId, { id: botId, name: botName, elo, socketId });
  }

  /**
   * Unregister a bot
   */
  unregisterBot(botId: string) {
    this.activeBots.delete(botId);
  }

  /**
   * Get active bot count
   */
  getActiveBotCount(): number {
    return this.activeBots.size;
  }

  /**
   * Run a single matchmaking cycle
   */
  private async runMatchmakingCycle() {
    const eligible = Array.from(this.activeBots.values());

    if (eligible.length < 2) {
      return;
    }

    // Check how many active matches we have
    const activeMatches = registry.getAll().filter(m => m.status === 'in_progress');

    console.log(`[Matchmaker] Cycle: ${eligible.length} active bots, ${activeMatches.length} active matches`);

    // Shuffle to avoid always pairing the same bots
    const shuffled = [...eligible].sort(() => Math.random() - 0.5);
    const paired = new Set<string>();

    for (const botA of shuffled) {
      if (paired.has(botA.id)) continue;

      // Find best opponent for botA
      const opponent = shuffled.find(botB => {
        if (botB.id === botA.id) return false;
        if (paired.has(botB.id)) return false;
        if (Math.abs(botA.elo - botB.elo) > ELO_WINDOW) return false;
        if (botA.preference?.minElo && botB.elo < botA.preference.minElo) return false;
        if (botA.preference?.maxElo && botB.elo > botA.preference.maxElo) return false;
        return true;
      });

      if (!opponent) continue;

      // Create match
      const matchId = generateMatchId();
      const whiteColor = Math.random() > 0.5 ? botA : opponent;
      const blackColor = whiteColor.id === botA.id ? opponent : botA;

      console.log(`[Matchmaker] Created: ${matchId} — ${whiteColor.name} (${whiteColor.elo}) vs ${blackColor.name} (${blackColor.elo})`);

      // Create the match room
      const room = registry.create(matchId, 30);
      room.status = 'ready';
      room.startedAt = new Date();

      // Notify both bots via Socket.io
      this.io.to(whiteColor.socketId).emit('matchFound', {
        matchId,
        color: 'white',
        opponentName: blackColor.name,
        opponentElo: blackColor.elo,
        timeoutSeconds: 30
      });

      this.io.to(blackColor.socketId).emit('matchFound', {
        matchId,
        color: 'black',
        opponentName: whiteColor.name,
        opponentElo: whiteColor.elo,
        timeoutSeconds: 30
      });

      paired.add(botA.id);
      paired.add(opponent.id);
    }
  }
}

/**
 * Generate an 8-character alphanumeric match ID
 */
function generateMatchId(): string {
  return Math.random().toString(36).substring(2, 10).toUpperCase();
}
