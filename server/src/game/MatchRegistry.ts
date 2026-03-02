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
