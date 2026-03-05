import React, { useState, useEffect } from 'react';
import { io } from 'socket.io-client';
import './GameLauncher.css';

interface TournamentStatus {
  status: 'idle' | 'running' | 'completed' | 'error';
  currentGame: number;
  totalGames: number;
  currentPairing: number;
  totalPairings: number;
  elapsed: string;
  estimated: string;
  results?: any;
  error?: string;
}

export const GameLauncher: React.FC = () => {
  const [tournamentStatus, setTournamentStatus] = useState<TournamentStatus>({
    status: 'idle',
    currentGame: 0,
    totalGames: 2,
    currentPairing: 0,
    totalPairings: 1,
    elapsed: '0:00',
    estimated: '10:00',
  });

  const [selectedType, setSelectedType] = useState<'tournament' | 'concurrent'>('tournament');
  const [isConnected, setIsConnected] = useState(false);
  const [apiKeys, setApiKeys] = useState<Record<string, boolean>>({});

  useEffect(() => {
    // Connect to Socket.IO for real-time updates
    const newSocket = io('http://localhost:3001');
    
    newSocket.on('connect', () => {
      console.log('Connected to tournament server');
      setIsConnected(true);
    });

    newSocket.on('tournament-status', (update) => {
      console.log('Tournament status update:', update);
      setTournamentStatus(prev => ({
        ...prev,
        ...update,
      }));
    });

    newSocket.on('disconnect', () => {
      console.log('Disconnected from tournament server');
      setIsConnected(false);
    });

    checkApiKeys();

    // Cleanup on unmount
    return () => {
      newSocket.close();
    };
  }, []);

  const checkApiKeys = async () => {
    try {
      const response = await fetch('http://localhost:3001/api/check-api-keys');
      const keys = await response.json();
      setApiKeys(keys);
    } catch (error) {
      console.error('Failed to check API keys:', error);
    }
  };

  const startTournament = async () => {
    if (!window.confirm(
      `Start Round-Robin Tournament?\n\n` +
      `• 2 Models (Groq Test)\n` +
      `• 1 Pairing\n` +
      `• 2 Total Games\n` +
      `• ~10 Minutes Duration\n` +
      `• 2s delay/move (rate limit friendly)\n\n` +
      `Click OK to begin...`
    )) {
      return;
    }

    try {
      const response = await fetch('http://localhost:3001/api/start-tournament', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'roundrobin' }),
      });

      if (!response.ok) {
        throw new Error('Failed to start tournament');
      }

      setTournamentStatus(prev => ({
        ...prev,
        status: 'running',
        currentGame: 0,
        currentPairing: 0,
      }));
    } catch (error) {
      setTournamentStatus(prev => ({
        ...prev,
        status: 'error',
        error: String(error),
      }));
    }
  };

  const startConcurrentExperiment = async () => {
    if (!window.confirm(
      `Start Concurrent Experiment?\n\n` +
      `• 6 Models (3 Matches Parallel)\n` +
      `• 50 Total Games\n` +
      `• ~45 Minutes Duration\n` +
      `• Table 3 for Paper\n\n` +
      `Click OK to begin...`
    )) {
      return;
    }

    try {
      const response = await fetch('http://localhost:3001/api/start-experiment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'concurrent_6models' }),
      });

      if (!response.ok) {
        throw new Error('Failed to start experiment');
      }

      setTournamentStatus(prev => ({
        ...prev,
        status: 'running',
        currentGame: 0,
      }));
    } catch (error) {
      setTournamentStatus(prev => ({
        ...prev,
        status: 'error',
        error: String(error),
      }));
    }
  };

  const downloadResults = async (format: 'json' | 'latex' | 'csv') => {
    try {
      const response = await fetch(`http://localhost:3001/api/tournament-results?format=${format}`);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `tournament-results.${format === 'latex' ? 'tex' : format}`;
      link.click();
    } catch (error) {
      console.error('Failed to download results:', error);
    }
  };

  const getApiKeyStatus = () => {
    const required = ['GROQ_API_KEY', 'OPENROUTER_API_KEY'];
    const optional = ['GOOGLE_API_KEY', 'MISTRAL_API_KEY', 'HUGGINGFACE_API_KEY', 'TOGETHER_API_KEY'];

    const hasRequired = required.every(key => apiKeys[key]);
    const availableOptional = optional.filter(key => apiKeys[key]).length;

    return {
      ready: hasRequired,
      requiredCount: required.filter(key => apiKeys[key]).length,
      optionalCount: availableOptional,
    };
  };

  const keyStatus = getApiKeyStatus();

  return (
    <div className="game-launcher">
      <header className="launcher-header">
        <h1>🏆 Game Tournament Launcher</h1>
        <p>Start round-robin tournaments or concurrent experiments with one click</p>
      </header>

      {/* API Key Status */}
      <section className="api-key-status">
        <h2>🔐 API Keys Status</h2>
        <div className={`status-indicator ${keyStatus.ready ? 'ready' : 'warning'}`}>
          <span className="status-dot"></span>
          {keyStatus.ready ? (
            <span>✅ Ready to run! {keyStatus.requiredCount} required + {keyStatus.optionalCount} optional keys configured</span>
          ) : (
            <span>⚠️ Missing API keys. Add to server/.env and restart backend</span>
          )}
        </div>
        <div className="keys-grid">
          {['GROQ_API_KEY', 'OPENROUTER_API_KEY', 'GOOGLE_API_KEY', 'MISTRAL_API_KEY'].map(key => (
            <div key={key} className={`key-indicator ${apiKeys[key] ? 'active' : 'inactive'}`}>
              <span className="key-name">{key.replace('_API_KEY', '')}</span>
              <span className={`key-status ${apiKeys[key] ? 'ok' : 'missing'}`}>
                {apiKeys[key] ? '✓' : '✗'}
              </span>
            </div>
          ))}
        </div>
      </section>

      {/* Game Type Selection */}
      <section className="game-type-selector">
        <h2>⚙️ Choose Game Type</h2>
        <div className="type-grid">
          {/* Round-Robin Tournament */}
          <div
            className={`type-card ${selectedType === 'tournament' ? 'selected' : ''}`}
            onClick={() => setSelectedType('tournament')}
          >
            <h3>🏆 Round-Robin Tournament</h3>
            <p className="description">Test with 2 Groq models</p>
            <ul className="specs">
              <li><strong>Models:</strong> 2 (Groq only)</li>
              <li><strong>Pairings:</strong> 1 unique</li>
              <li><strong>Games:</strong> 2 total (each pairing × 2)</li>
              <li><strong>Duration:</strong> ~10 minutes</li>
              <li><strong>Best for:</strong> Rate limit friendly testing</li>
            </ul>
            <div className="benefit">FAIREST - No selection bias</div>
          </div>

          {/* Concurrent Experiment */}
          <div
            className={`type-card ${selectedType === 'concurrent' ? 'selected' : ''}`}
            onClick={() => setSelectedType('concurrent')}
          >
            <h3>⚡ Concurrent Experiment</h3>
            <p className="description">3 matches run in parallel</p>
            <ul className="specs">
              <li><strong>Models:</strong> 6 (custom pairings)</li>
              <li><strong>Matches:</strong> 3 parallel</li>
              <li><strong>Games:</strong> 50 total</li>
              <li><strong>Duration:</strong> ~45 minutes</li>
              <li><strong>Best for:</strong> Speed, custom experiments</li>
            </ul>
            <div className="benefit">FASTEST - Parallelized execution</div>
          </div>
        </div>
      </section>

      {/* Game Launcher Buttons */}
      <section className="launcher-controls">
        <h2>🚀 Start Game</h2>
        <div className="button-group">
          <button
            className="btn btn-primary btn-large"
            onClick={startTournament}
            disabled={!keyStatus.ready || tournamentStatus.status === 'running'}
          >
            🏆 Start Round-Robin Tournament
            {tournamentStatus.status === 'running' && ' (Running...)'}
          </button>
          <button
            className="btn btn-secondary btn-large"
            onClick={startConcurrentExperiment}
            disabled={!keyStatus.ready || tournamentStatus.status === 'running'}
          >
            ⚡ Start Concurrent Experiment
            {tournamentStatus.status === 'running' && ' (Running...)'}
          </button>
        </div>
      </section>

      {/* Live Status Display */}
      <section className={`live-status ${tournamentStatus.status}`}>
        <h2>📊 Live Status</h2>

        {tournamentStatus.status === 'idle' && (
          <div className="status-content">
            <p className="hint">👆 Select a game type and click the button above to start</p>
          </div>
        )}

        {tournamentStatus.status === 'running' && (
          <div className="status-content running">
            <div className="progress-display">
              <div className="progress-item">
                <label>Current Game</label>
                <div className="progress-bar">
                  <div
                    className="progress-fill"
                    style={{
                      width: `${(tournamentStatus.currentGame / tournamentStatus.totalGames) * 100}%`,
                    }}
                  ></div>
                </div>
                <span className="progress-text">
                  Game {tournamentStatus.currentGame} / {tournamentStatus.totalGames}
                </span>
              </div>

              <div className="progress-item">
                <label>Current Pairing (Tournament)</label>
                <div className="progress-bar">
                  <div
                    className="progress-fill"
                    style={{
                      width: `${(tournamentStatus.currentPairing / tournamentStatus.totalPairings) * 100}%`,
                    }}
                  ></div>
                </div>
                <span className="progress-text">
                  Pairing {tournamentStatus.currentPairing} / {tournamentStatus.totalPairings}
                </span>
              </div>
            </div>

            <div className="time-display">
              <div className="time-item">
                <span className="time-label">⏱️ Elapsed</span>
                <span className="time-value">{tournamentStatus.elapsed}</span>
              </div>
              <div className="time-item">
                <span className="time-label">⏳ Estimated Remaining</span>
                <span className="time-value">{tournamentStatus.estimated}</span>
              </div>
            </div>

            <div className="status-note">
              ⏳ Games are running... Do not close this window. Results will auto-update.
            </div>
          </div>
        )}

        {tournamentStatus.status === 'completed' && (
          <div className="status-content completed">
            <h3>✅ Tournament Complete!</h3>
            <p>All games finished successfully.</p>
            <div className="download-buttons">
              <button className="btn btn-success" onClick={() => downloadResults('latex')}>
                📄 Download LaTeX Table
              </button>
              <button className="btn btn-info" onClick={() => downloadResults('json')}>
                📊 Download JSON Results
              </button>
              <button className="btn btn-info" onClick={() => downloadResults('csv')}>
                📈 Download CSV Data
              </button>
            </div>
            <p className="ready-to-publish">
              🎉 Your results are ready to paste into your paper!
            </p>
          </div>
        )}

        {tournamentStatus.status === 'error' && (
          <div className="status-content error">
            <h3>❌ Error Occurred</h3>
            <p>{tournamentStatus.error}</p>
          </div>
        )}
      </section>

      {/* Quick Reference */}
      <section className="quick-reference">
        <h2>📚 Quick Reference</h2>
        <div className="reference-grid">
          <div className="reference-card">
            <h4>Need API Keys?</h4>
            <ul>
              <li><a href="https://console.groq.com/keys" target="_blank" rel="noopener noreferrer">Groq</a> - Free, no card</li>
              <li><a href="https://openrouter.ai" target="_blank" rel="noopener noreferrer">OpenRouter</a> - Free tier</li>
              <li><a href="https://aistudio.google.com" target="_blank" rel="noopener noreferrer">Google</a> - Free tier</li>
              <li><a href="https://mistral.ai" target="_blank" rel="noopener noreferrer">Mistral</a> - Free tier</li>
            </ul>
          </div>
          <div className="reference-card">
            <h4>Tournament vs Experiment</h4>
            <ul>
              <li><strong>Tournament:</strong> All models play all others (fair)</li>
              <li><strong>Experiment:</strong> 3 custom pairings in parallel (fast)</li>
              <li>Either works for papers</li>
              <li>Choose based on your research question</li>
            </ul>
          </div>
          <div className="reference-card">
            <h4>Results Location</h4>
            <ul>
              <li><code>tournament-results/standings.json</code> - Rankings</li>
              <li><code>tournament-results/tournament-table.latex</code> - For paper</li>
              <li><code>tournament-results/all-games.json</code> - Raw data</li>
              <li>Downloaded files go to your download folder</li>
            </ul>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="launcher-footer">
        <p>
          🔗 Backend Status: {isConnected ? '✅ Connected' : '❌ Disconnected'} |
          📖 <a href="/docs/tournament-guide" target="_blank" rel="noopener noreferrer">Full Guide</a>
        </p>
      </footer>
    </div>
  );
};

export default GameLauncher;
