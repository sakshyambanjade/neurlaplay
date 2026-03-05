import { Express } from 'express';
import { GameLogger } from '../game/GameLogger';

export function setupGameDataRoutes(app: Express): void {
  const gameLogger = new GameLogger('./game-data');

  /**
   * GET /api/games - Get all past games
   */
  app.get('/api/games', (req, res) => {
    try {
      const games = gameLogger.getAllGames();
      res.json({ success: true, games });
    } catch (err) {
      console.error('Error fetching games:', err);
      res.status(500).json({ 
        success: false, 
        error: 'Failed to fetch games' 
      });
    }
  });

  /**
   * GET /api/games/:matchId - Get specific game
   */
  app.get('/api/games/:matchId', (req, res) => {
    try {
      const { matchId } = req.params;
      const game = gameLogger.getGame(matchId);

      if (!game) {
        return res.status(404).json({ 
          success: false, 
          error: 'Game not found' 
        });
      }

      res.json({ success: true, game });
    } catch (err) {
      console.error('Error fetching game:', err);
      res.status(500).json({ 
        success: false, 
        error: 'Failed to fetch game' 
      });
    }
  });

  /**
   * GET /api/games/:matchId/moves - Get move history
   */
  app.get('/api/games/:matchId/moves', (req, res) => {
    try {
      const { matchId } = req.params;
      const moves = gameLogger.getMoveHistory(matchId);
      res.json({ success: true, moves });
    } catch (err) {
      console.error('Error fetching moves:', err);
      res.status(500).json({ 
        success: false, 
        error: 'Failed to fetch moves' 
      });
    }
  });

  /**
   * GET /api/games/:matchId/pgn - Download game as PGN
   */
  app.get('/api/games/:matchId/pgn', (req, res) => {
    try {
      const { matchId } = req.params;
      const pgn = gameLogger.exportGameAsPGN(matchId);
      
      res.setHeader('Content-Type', 'text/plain');
      res.setHeader('Content-Disposition', `attachment; filename="${matchId}.pgn"`);
      res.send(pgn);
    } catch (err) {
      console.error('Error exporting PGN:', err);
      res.status(500).json({ 
        success: false, 
        error: 'Failed to export PGN' 
      });
    }
  });

  /**
   * GET /api/games/:matchId/json - Download game as JSON
   */
  app.get('/api/games/:matchId/json', (req, res) => {
    try {
      const { matchId } = req.params;
      const game = gameLogger.getGame(matchId);

      if (!game) {
        return res.status(404).json({ 
          success: false, 
          error: 'Game not found' 
        });
      }

      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename="${matchId}.json"`);
      res.send(JSON.stringify(game, null, 2));
    } catch (err) {
      console.error('Error exporting JSON:', err);
      res.status(500).json({ 
        success: false, 
        error: 'Failed to export JSON' 
      });
    }
  });

  /**
   * GET /api/games/stats - Get game statistics
   */
  app.get('/api/games/stats', (req, res) => {
    try {
      const stats = gameLogger.getGameStats();
      res.json({ success: true, stats });
    } catch (err) {
      console.error('Error computing stats:', err);
      res.status(500).json({ 
        success: false, 
        error: 'Failed to compute statistics' 
      });
    }
  });

  // Export for use in other files
  return gameLogger as any;
}

export { GameLogger };
