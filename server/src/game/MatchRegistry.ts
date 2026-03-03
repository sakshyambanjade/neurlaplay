import { MatchRoom } from './MatchRoom';

/**
 * MatchRegistry - In-memory match storage
 * For MVP, matches live here. Later: move to Redis
 */
export class MatchRegistry {
  private matches: Map<string, MatchRoom> = new Map();

  /**
   * Create and store a new match
   */
  create(matchId: string, timeoutSeconds?: number): MatchRoom {
    const room = new MatchRoom(matchId, timeoutSeconds);
    this.matches.set(matchId, room);
    return room;
  }

  /**
   * Create a match and immediately start it (transition to in_progress)
   * Useful for matchmaker-created games
   */
  createReady(matchId: string, timeoutSeconds?: number): MatchRoom {
    const room = new MatchRoom(matchId, timeoutSeconds);
    room.start();
    this.matches.set(matchId, room);
    return room;
  }

  /**
   * Get a match by ID
   */
  get(matchId: string): MatchRoom | undefined {
    return this.matches.get(matchId);
  }

  /**
   * Check if a match exists
   */
  exists(matchId: string): boolean {
    return this.matches.has(matchId);
  }

  /**
   * Delete a match
   */
  delete(matchId: string): boolean {
    const room = this.matches.get(matchId);
    if (room) {
      room.clearTimeout();
      return this.matches.delete(matchId);
    }
    return false;
  }

  /**
   * Get all active matches
   */
  getAll(): MatchRoom[] {
    return Array.from(this.matches.values());
  }

  /**
   * Get match count
   */
  size(): number {
    return this.matches.size;
  }

  /**
   * Check if a bot is currently in an active match
   */
  isBotInActiveMatch(botId: string): boolean {
    for (const room of this.matches.values()) {
      if (room.status === 'in_progress') {
        if (room.white?.botId === botId || room.black?.botId === botId) {
          return true;
        }
      }
    }
    return false;
  }

  /**
   * Find all matches for a specific bot
   */
  getMatchesForBot(botId: string): MatchRoom[] {
    return Array.from(this.matches.values()).filter(
      room => room.white?.botId === botId || room.black?.botId === botId
    );
  }

  /**
   * Clear all matches (for testing)
   */
  clear(): void {
    for (const room of this.matches.values()) {
      room.clearTimeout();
    }
    this.matches.clear();
  }
}

// Singleton instance
export const registry = new MatchRegistry();
