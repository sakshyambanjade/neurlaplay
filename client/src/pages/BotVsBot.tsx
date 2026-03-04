import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Zap, Play } from 'lucide-react';

/**
 * Bot vs Bot - Start LLM battles directly from the client
 */
export function BotVsBot() {
  const navigate = useNavigate();
  const [whiteBotName, setWhiteBotName] = useState('WhiteBot');
  const [whiteModel, setWhiteModel] = useState('llama-3.3-70b-versatile');
  const [whiteEndpoint, setWhiteEndpoint] = useState('https://api.groq.com/openai/v1/chat/completions');
  const [whiteApiKey, setWhiteApiKey] = useState('');

  const [blackBotName, setBlackBotName] = useState('BlackBot');
  const [blackModel, setBlackModel] = useState('llama-3.3-70b-versatile');
  const [blackEndpoint, setBlackEndpoint] = useState('https://api.groq.com/openai/v1/chat/completions');
  const [blackApiKey, setBlackApiKey] = useState('');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [moveDelay, setMoveDelay] = useState(3000);

  const handleStartMatch = async () => {
    if (!whiteApiKey || !blackApiKey) {
      setError('Please provide API keys for both bots');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Create match on server
      const createResponse = await fetch('http://localhost:3001/api/matches', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
      });

      if (!createResponse.ok) {
        throw new Error('Failed to create match');
      }

      const { matchId } = await createResponse.json();

      // Start the bot match
      const startResponse = await fetch('http://localhost:3001/api/bot-match', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          matchId,
          whiteBotName,
          whiteModel,
          whiteEndpointUrl: whiteEndpoint,
          whiteApiKey,
          blackBotName,
          blackModel,
          blackEndpointUrl: blackEndpoint,
          blackApiKey,
          moveDelayMs: moveDelay
        })
      });

      if (!startResponse.ok) {
        const errorData = await startResponse.json();
        throw new Error(errorData.message || 'Failed to start bot match');
      }

      // Redirect to spectator view
      navigate(`/game/${matchId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bot-vs-bot-container">
      <div className="bot-vs-bot-card">
        <h1>⚡ Bot vs Bot Arena</h1>
        <p className="subtitle">Watch two LLMs battle it out on the chess board</p>

        <div className="bot-configs">
          {/* White Bot */}
          <div className="bot-config white-bot">
            <h2>⚪ White Bot</h2>
            
            <div className="form-group">
              <label>Bot Name</label>
              <input
                type="text"
                value={whiteBotName}
                onChange={(e) => setWhiteBotName(e.target.value)}
                placeholder="e.g., WhiteBot"
              />
            </div>

            <div className="form-group">
              <label>Model</label>
              <select value={whiteModel} onChange={(e) => setWhiteModel(e.target.value)}>
                <option value="llama-3.3-70b-versatile">Llama 3.3 70B (Groq)</option>
                <option value="mixtral-8x7b-32768">Mixtral 8x7B (Groq)</option>
                <option value="gpt-4">GPT-4 (OpenAI)</option>
                <option value="gpt-3.5-turbo">GPT-3.5 Turbo (OpenAI)</option>
                <option value="claude-3-opus-20240229">Claude 3 Opus (Anthropic)</option>
              </select>
            </div>

            <div className="form-group">
              <label>API Endpoint</label>
              <input
                type="text"
                value={whiteEndpoint}
                onChange={(e) => setWhiteEndpoint(e.target.value)}
                placeholder="https://api.groq.com/openai/v1/chat/completions"
              />
            </div>

            <div className="form-group">
              <label>API Key</label>
              <input
                type="password"
                value={whiteApiKey}
                onChange={(e) => setWhiteApiKey(e.target.value)}
                placeholder="Your API key"
              />
            </div>
          </div>

          {/* VS Separator */}
          <div className="vs-separator">
            <span>VS</span>
          </div>

          {/* Black Bot */}
          <div className="bot-config black-bot">
            <h2>⚫ Black Bot</h2>
            
            <div className="form-group">
              <label>Bot Name</label>
              <input
                type="text"
                value={blackBotName}
                onChange={(e) => setBlackBotName(e.target.value)}
                placeholder="e.g., BlackBot"
              />
            </div>

            <div className="form-group">
              <label>Model</label>
              <select value={blackModel} onChange={(e) => setBlackModel(e.target.value)}>
                <option value="llama-3.3-70b-versatile">Llama 3.3 70B (Groq)</option>
                <option value="mixtral-8x7b-32768">Mixtral 8x7B (Groq)</option>
                <option value="gpt-4">GPT-4 (OpenAI)</option>
                <option value="gpt-3.5-turbo">GPT-3.5 Turbo (OpenAI)</option>
                <option value="claude-3-opus-20240229">Claude 3 Opus (Anthropic)</option>
              </select>
            </div>

            <div className="form-group">
              <label>API Endpoint</label>
              <input
                type="text"
                value={blackEndpoint}
                onChange={(e) => setBlackEndpoint(e.target.value)}
                placeholder="https://api.groq.com/openai/v1/chat/completions"
              />
            </div>

            <div className="form-group">
              <label>API Key</label>
              <input
                type="password"
                value={blackApiKey}
                onChange={(e) => setBlackApiKey(e.target.value)}
                placeholder="Your API key"
              />
            </div>
          </div>
        </div>

        {/* Move Delay */}
        <div className="move-delay-section">
          <label>Move Delay (ms)</label>
          <div className="delay-input">
            <input
              type="range"
              min="500"
              max="10000"
              step="500"
              value={moveDelay}
              onChange={(e) => setMoveDelay(parseInt(e.target.value))}
            />
            <span className="delay-value">{moveDelay}ms</span>
          </div>
          <p className="delay-help">Time between moves for dramatic effect</p>
        </div>

        {/* Error Message */}
        {error && (
          <div className="error-message">
            <strong>Error:</strong> {error}
          </div>
        )}

        {/* Start Button */}
        <button
          className="start-button"
          onClick={handleStartMatch}
          disabled={loading}
        >
          {loading ? (
            <>
              <span className="spinner"></span>
              Starting Match...
            </>
          ) : (
            <>
              <Play size={20} />
              Start Match
            </>
          )}
        </button>
      </div>

      <style>{`
        .bot-vs-bot-container {
          min-height: 100vh;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          padding: 40px 20px;
          display: flex;
          justify-content: center;
          align-items: center;
        }

        .bot-vs-bot-card {
          background: white;
          border-radius: 16px;
          padding: 40px;
          max-width: 1000px;
          box-shadow: 0 20px 60px rgba(0,0,0,0.3);
        }

        .bot-vs-bot-card h1 {
          text-align: center;
          font-size: 32px;
          margin: 0 0 10px 0;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }

        .subtitle {
          text-align: center;
          color: #666;
          margin: 0 0 30px 0;
          font-size: 16px;
        }

        .bot-configs {
          display: grid;
          grid-template-columns: 1fr auto 1fr;
          gap: 30px;
          margin-bottom: 30px;
          align-items: start;
        }

        .bot-config {
          background: #f8f9fa;
          padding: 20px;
          border-radius: 12px;
          border-left: 4px solid;
        }

        .bot-config.white-bot {
          border-left-color: #000;
        }

        .bot-config.black-bot {
          border-left-color: #333;
        }

        .bot-config h2 {
          margin: 0 0 20px 0;
          font-size: 18px;
        }

        .form-group {
          margin-bottom: 15px;
        }

        .form-group label {
          display: block;
          font-size: 12px;
          font-weight: 600;
          color: #555;
          margin-bottom: 6px;
          text-transform: uppercase;
        }

        .form-group input,
        .form-group select {
          width: 100%;
          padding: 8px 12px;
          border: 1px solid #ddd;
          border-radius: 6px;
          font-size: 13px;
          font-family: inherit;
          transition: all 0.2s;
        }

        .form-group input:focus,
        .form-group select:focus {
          outline: none;
          border-color: #667eea;
          box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
        }

        .vs-separator {
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 24px;
          font-weight: bold;
          color: #667eea;
        }

        .move-delay-section {
          background: #f8f9fa;
          padding: 20px;
          border-radius: 12px;
          margin-bottom: 20px;
        }

        .move-delay-section label {
          display: block;
          font-size: 12px;
          font-weight: 600;
          color: #555;
          margin-bottom: 15px;
          text-transform: uppercase;
        }

        .delay-input {
          display: flex;
          gap: 15px;
          align-items: center;
        }

        .delay-input input {
          flex: 1;
        }

        .delay-value {
          background: white;
          padding: 8px 16px;
          border-radius: 6px;
          font-weight: 600;
          color: #667eea;
          min-width: 80px;
          text-align: center;
          border: 2px solid #667eea;
        }

        .delay-help {
          margin: 10px 0 0 0;
          font-size: 12px;
          color: #999;
        }

        .error-message {
          background: #fee;
          color: #c33;
          padding: 15px;
          border-radius: 8px;
          margin-bottom: 20px;
          border-left: 4px solid #c33;
          font-size: 14px;
        }

        .start-button {
          width: 100%;
          padding: 14px;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
          border: none;
          border-radius: 8px;
          font-size: 16px;
          font-weight: 600;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
          cursor: pointer;
          transition: all 0.3s;
          text-transform: uppercase;
          letter-spacing: 1px;
        }

        .start-button:hover:not(:disabled) {
          transform: translateY(-2px);
          box-shadow: 0 10px 25px rgba(102, 126, 234, 0.4);
        }

        .start-button:disabled {
          opacity: 0.7;
          cursor: not-allowed;
        }

        .spinner {
          width: 16px;
          height: 16px;
          border: 2px solid rgba(255,255,255,0.3);
          border-top-color: white;
          border-radius: 50%;
          animation: spin 0.8s linear infinite;
        }

        @keyframes spin {
          to { transform: rotate(360deg); }
        }

        @media (max-width: 768px) {
          .bot-configs {
            grid-template-columns: 1fr;
          }

          .vs-separator {
            display: none;
          }

          .bot-vs-bot-card {
            padding: 20px;
          }
        }
      `}</style>
    </div>
  );
}

export default BotVsBot;
