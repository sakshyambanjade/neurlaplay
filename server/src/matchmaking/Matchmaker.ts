/**
 * Matchmaker - Autonomous bot pairing
 * Runs every 60 seconds and pairs eligible bots by Elo proximity
 * Prioritizes accepted challenges first, then does random Elo-based pairing
 */

import { Server } from 'socket.io';
import { registry } from '../game/MatchRegistry';
import { config } from '../config';
import { createMatch } from '../db/matches';
import {
  getAcceptedUnmatchedChallenges,
  attachMatchToChallenge
} from '../db/challenges';

const MATCHMAKING_INTERVAL_MS = config.MATCHMAKING_INTERVAL_MS;
const ELO_WINDOW = config.ELO_WINDOW;

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

    // 1) Handle accepted challenges first
    await this.handleAcceptedChallenges(eligible);

    // 2) Then do standard Elo-based pairing as fallback
    await this.handleRandomPairing(eligible);
  }

  /**
   * Consume accepted challenges (highest priority)
   */
  private async handleAcceptedChallenges(eligible: ActiveBot[]) {
    const challenges = await getAcceptedUnmatchedChallenges();
    if (!challenges.length) return;

    for (const challenge of challenges) {
      const a = eligible.find(b => b.id === challenge.challenger_bot_id);
      const b = eligible.find(b => b.id === challenge.challenged_bot_id);
      if (!a || !b) continue;

      // Safety: both must not already be in active matches
      if (registry.isBotInActiveMatch(a.id) || registry.isBotInActiveMatch(b.id)) {
        continue;
      }

      // Create match
      const matchId = generateMatchId();
      const whiteColor = Math.random() > 0.5 ? a : b;
      const blackColor = whiteColor.id === a.id ? b : a;

      console.log(
        `[Matchmaker] Challenge match: ${matchId} — ${whiteColor.name} vs ${blackColor.name}`
      );

      // Create DB record
      await createMatch({
        id: matchId,
        game_type: 'chess',
        white_bot_id: whiteColor.id,
        black_bot_id: blackColor.id,
        white_elo_before: whiteColor.elo,
        black_elo_before: blackColor.elo,
        move_timeout_seconds: config.DEFAULT_MOVE_TIMEOUT_SECONDS
      });

      // Create in-memory room
      const room = registry.createReady(matchId, config.DEFAULT_MOVE_TIMEOUT_SECONDS);

      // Store bot IDs in the room for tracking
      room.white = {
        botId: whiteColor.id,
        socketId: whiteColor.socketId,
        botName: whiteColor.name,
        model: '',
        endpointType: 'openai',
        endpointUrl: '',
        apiKey: '',
        isReady: true
      };

      room.black = {
        botId: blackColor.id,
        socketId: blackColor.socketId,
        botName: blackColor.name,
        model: '',
        endpointType: 'openai',
        endpointUrl: '',
        apiKey: '',
        isReady: true
      };

      // Update challenge with match ID
      await attachMatchToChallenge(challenge.id, matchId);

      // Notify both bots
      this.io.to(whiteColor.socketId).emit('matchFound', {
        matchId,
        color: 'white',
        opponentName: blackColor.name,
        opponentElo: blackColor.elo,
        timeoutSeconds: config.DEFAULT_MOVE_TIMEOUT_SECONDS
      });

      this.io.to(blackColor.socketId).emit('matchFound', {
        matchId,
        color: 'black',
        opponentName: whiteColor.name,
        opponentElo: whiteColor.elo,
        timeoutSeconds: config.DEFAULT_MOVE_TIMEOUT_SECONDS
      });
    }
  }

  /**
   * Standard Elo-based random pairing (fallback after challenges)
   */
  private async handleRandomPairing(eligible: ActiveBot[]) {
    const shuffled = [...eligible].sort(() => Math.random() - 0.5);
    const paired = new Set<string>();

    for (const botA of shuffled) {
      if (paired.has(botA.id)) continue;

      // Safety check: ensure bot is not already in an active match
      if (registry.isBotInActiveMatch(botA.id)) {
        console.log(`[Matchmaker] Skipping ${botA.name} - already in an active match`);
        continue;
      }

      // Find best opponent for botA
      const opponent = shuffled.find(botB => {
        if (botB.id === botA.id) return false;
        if (paired.has(botB.id)) return false;
        if (registry.isBotInActiveMatch(botB.id)) return false;
        if (Math.abs(botA.elo - botB.elo) > ELO_WINDOW) return false;
        if (botA.preference?.minElo && botB.elo < botA.preference.minElo) return false;
        if (botA.preference?.maxElo && botB.elo > botA.preference.maxElo) return false;
        return true;
      });

      if (!opponent) {
        console.log(`[Matchmaker] No suitable opponent found for ${botA.name} (${botA.elo})`);
        continue;
      }

      // Create match
      const matchId = generateMatchId();
      const whiteColor = Math.random() > 0.5 ? botA : opponent;
      const blackColor = whiteColor.id === botA.id ? opponent : botA;

      console.log(`[Matchmaker] Created: ${matchId} — ${whiteColor.name} (${whiteColor.elo}) vs ${blackColor.name} (${blackColor.elo})`);

      // Create DB record
      await createMatch({
        id: matchId,
        game_type: 'chess',
        white_bot_id: whiteColor.id,
        black_bot_id: blackColor.id,
        white_elo_before: whiteColor.elo,
        black_elo_before: blackColor.elo,
        move_timeout_seconds: config.DEFAULT_MOVE_TIMEOUT_SECONDS
      });

      // Create the match room using the factory helper
      const room = registry.createReady(matchId, config.DEFAULT_MOVE_TIMEOUT_SECONDS);

      // Store bot IDs in the room for tracking
      room.white = {
        botId: whiteColor.id,
        socketId: whiteColor.socketId,
        botName: whiteColor.name,
        model: '',
        endpointType: 'openai',
        endpointUrl: '',
        apiKey: '',
        isReady: true
      };

      room.black = {
        botId: blackColor.id,
        socketId: blackColor.socketId,
        botName: blackColor.name,
        model: '',
        endpointType: 'openai',
        endpointUrl: '',
        apiKey: '',
        isReady: true
      };

      // Notify both bots via Socket.io
      this.io.to(whiteColor.socketId).emit('matchFound', {
        matchId,
        color: 'white',
        opponentName: blackColor.name,
        opponentElo: blackColor.elo,
        timeoutSeconds: config.DEFAULT_MOVE_TIMEOUT_SECONDS
      });

      this.io.to(blackColor.socketId).emit('matchFound', {
        matchId,
        color: 'black',
        opponentName: whiteColor.name,
        opponentElo: whiteColor.elo,
        timeoutSeconds: config.DEFAULT_MOVE_TIMEOUT_SECONDS
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
