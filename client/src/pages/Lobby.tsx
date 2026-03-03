import { useState, useEffect } from 'react';
import { useSocket } from '../hooks';
import { useGameStore } from '../store/gameStore';
import { CheckCircle, AlertCircle, Zap, Copy, Shield } from 'lucide-react';
import Accordion from 'react-bootstrap/Accordion';

/**
 * Lobby page - Match creation and player config
 */
export function LobbyPage() {
  const socket = useSocket();
  const matchId = useGameStore((s) => s.matchId);
  const playerSessionId = useGameStore((s) => s.playerSessionId);
  const userColor = useGameStore((s) => s.userColor);

  const [botName, setBotName] = useState('');
  const [model, setModel] = useState('mixtral-8x7b-32768');
  const [endpointUrl, setEndpointUrl] = useState('https://api.groq.com/openai/v1/chat/completions');
  const [apiKey, setApiKey] = useState('');
  const [isReady, setIsReady] = useState(false);
  const [testingConnection, setTestingConnection] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [copied, setCopied] = useState(false);
  const [opponentJoined, setOpponentJoined] = useState(false);
  const [opponentConfigured, setOpponentConfigured] = useState(false);
  const [opponentReady, setOpponentReady] = useState(false);
  const [opponentName, setOpponentName] = useState('');

  // Auto-update endpoint URL based on model selected
  useEffect(() => {
    if (model.includes('gpt')) {
      setEndpointUrl('https://api.openai.com/v1/chat/completions');
    } else if (model.includes('claude')) {
      setEndpointUrl('https://api.anthropic.com/v1/messages');
    } else if (model.includes('mixtral')) {
      setEndpointUrl('https://api.groq.com/openai/v1/chat/completions');
    }
  }, [model]);

  const handleTestConnection = async () => {
    setTestingConnection(true);
    try {
      const response = await fetch(endpointUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model,
          messages: [{ role: 'user', content: 'test' }],
          max_tokens: 1
        })
      });

      if (response.ok) {
        setConnectionStatus('success');
      } else {
        setConnectionStatus('error');
      }
    } catch (error) {
      setConnectionStatus('error');
    } finally {
      setTestingConnection(false);
    }
  };

  const handleReady = () => {
    if (!botName || !apiKey) {
      alert('Please fill in all fields');
      return;
    }

    console.log('[Client] === I\'M READY FLOW ===');
    console.log('[Client] Match ID:', matchId);
    console.log('[Client] Player Session ID:', playerSessionId);
    console.log('[Client] User Color:', userColor);
    console.log('[Client] Bot Name:', botName);
    console.log('[Client] Model:', model);
    console.log('[Client] Endpoint:', endpointUrl);
    console.log('[Client] Socket connected:', socket?.connected);

    console.log('[Client] Emitting setConfig...');
    socket?.emit('setConfig', {
      matchId,
      playerSessionId,
      botName,
      model,
      endpointType: 'openai',
      endpointUrl,
      apiKey
    });
    console.log('[Client] setConfig emitted');

    console.log('[Client] Emitting setReady...');
    socket?.emit('setReady', { matchId, playerSessionId });
    console.log('[Client] setReady emitted');
    
    setIsReady(true);
    console.log('[Client] Local state updated: isReady = true');
  };

  const handleCopyMatchId = () => {
    if (matchId) {
      navigator.clipboard.writeText(matchId);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  // Listen for opponent events
  useEffect(() => {
    if (!socket) return;

    socket.on('playerJoined', () => {
      setOpponentJoined(true);
    });

    socket.on('opponentConfigured', (data: any) => {
      setOpponentConfigured(true);
      setOpponentName(data.botName || 'Opponent');
    });

    socket.on('playerReady', () => {
      setOpponentReady(true);
    });

    return () => {
      socket.off('playerJoined');
      socket.off('opponentConfigured');
      socket.off('playerReady');
    };
  }, [socket]);

  return (
    <div className="py-5" style={{ minHeight: '100vh' }}>
      <div className="container-lg px-4">
        {/* Page Header */}
        <div className="text-center mb-5">
          <div className="d-inline-flex align-items-center justify-content-center p-4 rounded-4 mb-4" style={{ background: 'linear-gradient(135deg, rgba(168, 85, 247, 0.2), rgba(236, 72, 153, 0.2))', border: '1px solid rgba(168, 85, 247, 0.3)' }}>
            <span style={{ fontSize: '3rem' }}>🤖</span>
          </div>
          <h1 className="display-4 fw-bold text-white mb-3">
            Configure Your Bot
          </h1>
          <p className="text-muted fs-5 mx-auto" style={{ maxWidth: '700px' }}>
            Set up your AI model, test the connection, and join the competitive arena
          </p>
        </div>

        <div className="row g-4">
          {/* Left Column - Config Form */}
          <div className="col-lg-8">
            {/* Configuration Accordion */}
            <Accordion defaultActiveKey="0">
              {/* Bot Configuration */}
              <Accordion.Item eventKey="0" className="mb-3" style={{ backgroundColor: 'rgba(30, 41, 59, 0.5)', border: '1px solid rgba(168, 85, 247, 0.3)', borderRadius: '1rem' }}>
                <Accordion.Header>
                  <span style={{ fontSize: '1.5rem', marginRight: '12px' }}>⚙️</span>
                  <span className="fw-bold">Bot Configuration</span>
                  <span className="ms-2 small text-muted">Name, model, and API settings</span>
                </Accordion.Header>
                <Accordion.Body style={{ padding: '1.5rem' }}>
                  <div style={{ background: 'linear-gradient(135deg, rgba(88, 28, 135, 0.3), rgba(30, 41, 59, 0.5))', backdropFilter: 'blur(10px)', border: '1px solid rgba(168, 85, 247, 0.3)', borderRadius: '1rem', padding: '1.5rem' }}>
                    {/* Bot Name */}
                    <div className="mb-4">
                      <label className="form-label fw-bold d-flex align-items-center gap-2" style={{ color: '#d1d5db' }}>
                        <span>🏷️</span>
                        Bot Name
                      </label>
                      <input
                        type="text"
                        className="form-control"
                        value={botName}
                        onChange={(e) => setBotName(e.target.value)}
                        placeholder="e.g., GPT-4o-Champion"
                        style={{ backgroundColor: 'rgba(30, 41, 59, 0.5)', border: '1px solid rgba(168, 85, 247, 0.3)', borderRadius: '0.75rem', color: '#fff', padding: '0.75rem 1rem' }}
                        disabled={isReady}
                      />
                    </div>

                    {/* Model Selection */}
                    <div className="mb-0">
                      <label className="form-label fw-bold d-flex align-items-center gap-2" style={{ color: '#d1d5db' }}>
                        <span>🧠</span>
                        AI Model
                      </label>
                      <select
                        className="form-select"
                        value={model}
                        onChange={(e) => setModel(e.target.value)}
                        style={{ backgroundColor: 'rgba(30, 41, 59, 0.5)', border: '1px solid rgba(168, 85, 247, 0.3)', borderRadius: '0.75rem', color: '#fff', padding: '0.75rem 1rem' }}
                        disabled={isReady}
                      >
                        <optgroup label="🚀 Groq (Free & Fast)">
                          <option value="mixtral-8x7b-32768">Mixtral 8x7B</option>
                          <option value="llama-2-70b-chat">Llama 2 70B</option>
                        </optgroup>
                        <optgroup label="📘 OpenAI">
                          <option value="gpt-4o">GPT-4o</option>
                          <option value="gpt-4-turbo">GPT-4 Turbo</option>
                        </optgroup>
                        <optgroup label="🧠 Anthropic">
                          <option value="claude-3-5-sonnet-20241022">Claude 3.5 Sonnet</option>
                        </optgroup>
                      </select>
                      <small className="form-text text-muted mt-2 d-block">Select which LLM to use for analysis</small>
                    </div>
                  </div>
                </Accordion.Body>
              </Accordion.Item>

              {/* API Configuration */}
              <Accordion.Item eventKey="1" className="mb-3" style={{ backgroundColor: 'rgba(30, 41, 59, 0.5)', border: '1px solid rgba(59, 130, 246, 0.3)', borderRadius: '1rem' }}>
                <Accordion.Header>
                  <span style={{ fontSize: '1.5rem', marginRight: '12px' }}>🔌</span>
                  <span className="fw-bold">API Configuration</span>
                  <span className="ms-2 small text-muted">Endpoint and authentication</span>
                </Accordion.Header>
                <Accordion.Body style={{ padding: '1.5rem' }}>
                  <div style={{ background: 'linear-gradient(135deg, rgba(30, 58, 138, 0.3), rgba(30, 41, 59, 0.5))', backdropFilter: 'blur(10px)', border: '1px solid rgba(59, 130, 246, 0.3)', borderRadius: '1rem', padding: '1.5rem' }}>
                    {/* Endpoint URL */}
                    <div className="mb-4">
                      <label className="form-label fw-bold d-flex align-items-center gap-2" style={{ color: '#d1d5db' }}>
                        <span>🌐</span>
                        API Endpoint
                      </label>
                      <input
                        type="text"
                        className="form-control font-monospace small"
                        value={endpointUrl}
                        onChange={(e) => setEndpointUrl(e.target.value)}
                        placeholder="https://api.openai.com/v1/chat/completions"
                        style={{ backgroundColor: 'rgba(30, 41, 59, 0.5)', border: '1px solid rgba(59, 130, 246, 0.3)', borderRadius: '0.75rem', color: '#fff', padding: '0.75rem 1rem' }}
                        disabled={isReady}
                      />
                    </div>

                    {/* API Key */}
                    <div className="mb-0">
                      <label className="form-label fw-bold d-flex align-items-center gap-2" style={{ color: '#d1d5db' }}>
                        <span>🔑</span>
                        API Key
                      </label>
                      <input
                        type="password"
                        className="form-control font-monospace small"
                        value={apiKey}
                        onChange={(e) => setApiKey(e.target.value)}
                        placeholder="sk-..."
                        style={{ backgroundColor: 'rgba(30, 41, 59, 0.5)', border: '1px solid rgba(59, 130, 246, 0.3)', borderRadius: '0.75rem', color: '#fff', padding: '0.75rem 1rem' }}
                        disabled={isReady}
                      />
                      <div className="d-flex align-items-start gap-2 mt-2 p-3 rounded" style={{ backgroundColor: 'rgba(59, 130, 246, 0.1)', border: '1px solid rgba(59, 130, 246, 0.3)' }}>
                        <Shield size={16} className="flex-shrink-0 mt-1" style={{ color: '#60a5fa' }} />
                        <small style={{ color: '#bfdbfe' }}>Your API key is encrypted and never leaves your browser.</small>
                      </div>

                      {/* Groq Help Section */}
                      {model.includes('mixtral') || model.includes('llama') ? (
                        <div className="d-flex align-items-start gap-2 mt-3 p-3 rounded" style={{ backgroundColor: 'rgba(34, 197, 94, 0.1)', border: '1px solid rgba(34, 197, 94, 0.3)' }}>
                          <span style={{ fontSize: '1.3rem', flexShrink: 0 }}>🎉</span>
                          <div>
                            <p className="mb-2 fw-bold" style={{ color: '#bbf7d0' }}>Get Free Groq API Key</p>
                            <ol className="mb-0 ps-3" style={{ color: '#bbf7d0', fontSize: '0.85rem' }}>
                              <li>Visit <a href="https://console.groq.com" target="_blank" rel="noopener noreferrer" style={{ color: '#4ade80' }}>console.groq.com</a></li>
                              <li>Sign up (free account)</li>
                              <li>Create an API key</li>
                              <li>Paste it above and click "Test Connection"</li>
                            </ol>
                          </div>
                        </div>
                      ) : null}
                    </div>
                  </div>
                </Accordion.Body>
              </Accordion.Item>

              {/* Testing & Launch */}
              <Accordion.Item eventKey="2" className="mb-3" style={{ backgroundColor: 'rgba(30, 41, 59, 0.5)', border: '1px solid rgba(34, 197, 94, 0.3)', borderRadius: '1rem' }}>
                <Accordion.Header>
                  <span style={{ fontSize: '1.5rem', marginRight: '12px' }}>🚀</span>
                  <span className="fw-bold">Testing & Launch</span>
                  <span className="ms-2 small text-muted">Verify connection and join the arena</span>
                </Accordion.Header>
                <Accordion.Body style={{ padding: '1.5rem' }}>
                  <div style={{ background: 'linear-gradient(135deg, rgba(20, 83, 45, 0.3), rgba(30, 41, 59, 0.5))', backdropFilter: 'blur(10px)', border: '1px solid rgba(34, 197, 94, 0.3)', borderRadius: '1rem', padding: '1.5rem' }}>
                    {/* Test Connection */}
                    {!isReady && (
                      <div className="mb-4">
                        <label className="form-label fw-bold" style={{ color: '#d1d5db' }}>
                          Test API Connection
                        </label>
                        <button
                          onClick={handleTestConnection}
                          disabled={testingConnection || !apiKey}
                          className="btn w-100 d-flex align-items-center justify-content-center gap-2 fw-semibold"
                          style={{
                            padding: '0.75rem',
                            borderRadius: '0.75rem',
                            border: connectionStatus === 'success' ? '1px solid #22c55e' : connectionStatus === 'error' ? '1px solid #ef4444' : '1px solid #475569',
                            backgroundColor: connectionStatus === 'success' ? 'rgba(34, 197, 94, 0.3)' : connectionStatus === 'error' ? 'rgba(239, 68, 68, 0.3)' : 'rgba(51, 65, 85, 0.5)',
                            color: connectionStatus === 'success' ? '#bbf7d0' : connectionStatus === 'error' ? '#fecaca' : '#d1d5db'
                          }}
                        >
                          {testingConnection && <Zap size={18} />}
                          {connectionStatus === 'success' && <CheckCircle size={18} />}
                          {connectionStatus === 'error' && <AlertCircle size={18} />}
                          <span>{testingConnection ? 'Testing...' : connectionStatus === 'success' ? '✓ Connected' : connectionStatus === 'error' ? '✗ Failed' : 'Test Connection'}</span>
                        </button>
                        {connectionStatus === 'success' && (
                          <div className="mt-2 p-3 rounded" style={{ backgroundColor: 'rgba(34, 197, 94, 0.1)', border: '1px solid rgba(34, 197, 94, 0.3)' }}>
                            <small style={{ color: '#bbf7d0' }}>✓ API connection successful! Ready to compete.</small>
                          </div>
                        )}
                        {connectionStatus === 'error' && (
                          <div className="mt-2 p-3 rounded" style={{ backgroundColor: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)' }}>
                            <small style={{ color: '#fecaca' }}>✗ Connection failed. Please check your API key and endpoint.</small>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Ready Button */}
                    <div>
                      <label className="form-label fw-bold" style={{ color: '#d1d5db' }}>
                        Launch Bot
                      </label>
                      <button
                        onClick={handleReady}
                        disabled={isReady}
                        className="btn w-100 d-flex align-items-center justify-content-center gap-2 fw-bold"
                        style={{
                          padding: '0.875rem',
                          fontSize: '1.125rem',
                          borderRadius: '0.75rem',
                          border: 'none',
                          background: isReady ? '#16a34a' : 'linear-gradient(to right, #9333ea, #a855f7)',
                          color: '#fff',
                          boxShadow: isReady ? 'none' : '0 10px 25px -5px rgba(147, 51, 234, 0.5)'
                        }}
                      >
                        <CheckCircle size={20} />
                        <span>{isReady ? '✓ Ready to Play!' : '🎮 Ready to Play'}</span>
                      </button>
                      {isReady && (
                        <div className="mt-2 p-3 rounded" style={{ backgroundColor: 'rgba(34, 197, 94, 0.1)', border: '1px solid rgba(34, 197, 94, 0.3)' }}>
                          <small style={{ color: '#bbf7d0' }}>✓ Bot is ready! Waiting for opponent...</small>
                        </div>
                      )}
                    </div>
                  </div>
                </Accordion.Body>
              </Accordion.Item>
            </Accordion>
          </div>

          {/* Right Column - Match Info */}
          <div className="col-lg-4">
            {/* Header Card */}
            <div className="text-center mb-4 p-4 rounded-3" style={{ background: 'linear-gradient(135deg, rgba(30, 41, 59, 0.3), rgba(30, 41, 59, 0.5))', backdropFilter: 'blur(10px)', border: '1px solid rgba(71, 85, 105, 0.3)' }}>
              <h2 className="h3 fw-bold mb-2" style={{ background: 'linear-gradient(to right, #fff, #d1d5db)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>Match Details</h2>
              <p className="text-muted mb-0">Your arena credentials</p>
            </div>

            {/* Match ID Card */}
            <div className="card mb-4" style={{ backgroundColor: 'rgba(30, 58, 138, 0.2)', border: '1px solid rgba(59, 130, 246, 0.3)', borderRadius: '1rem', backdropFilter: 'blur(10px)' }}>
              <div className="card-body" style={{ padding: '1.5rem' }}>
                <div className="d-flex align-items-center gap-3 mb-3">
                  <div className="d-flex align-items-center justify-content-center rounded-3" style={{ width: '2.5rem', height: '2.5rem', backgroundColor: 'rgba(59, 130, 246, 0.2)', border: '1px solid rgba(59, 130, 246, 0.3)' }}>
                    <span style={{ fontSize: '1.25rem' }}>🎮</span>
                  </div>
                  <div>
                    <h3 className="h5 fw-bold mb-0 text-white">Match ID</h3>
                    <small className="text-muted">Your game identifier</small>
                  </div>
                </div>
                
                <div className="p-3 mb-3 rounded-3" style={{ backgroundColor: 'rgba(15, 23, 42, 0.6)', border: '1px solid rgba(71, 85, 105, 0.5)' }}>
                  <code className="font-monospace fw-bold" style={{ color: '#60a5fa', fontSize: '1.125rem', wordBreak: 'break-all' }}>{matchId || 'Waiting...'}</code>
                </div>
                
                <button
                  onClick={handleCopyMatchId}
                  disabled={!matchId}
                  className="btn w-100 d-flex align-items-center justify-content-center gap-2 fw-semibold"
                  style={{ padding: '0.75rem', borderRadius: '0.75rem', backgroundColor: 'rgba(59, 130, 246, 0.2)', border: '1px solid rgba(59, 130, 246, 0.5)', color: '#bfdbfe' }}
                >
                  <Copy size={18} />
                  <span>{copied ? '✓ Copied!' : 'Copy Match ID'}</span>
                </button>
              </div>
            </div>

            {/* Your Color Card */}
            <div className="card mb-4" style={{ backgroundColor: 'rgba(131, 24, 67, 0.2)', border: '1px solid rgba(236, 72, 153, 0.3)', borderRadius: '1rem', backdropFilter: 'blur(10px)' }}>
              <div className="card-body" style={{ padding: '1.5rem' }}>
                <div className="d-flex align-items-center gap-3 mb-3">
                  <div className="d-flex align-items-center justify-content-center rounded-3" style={{
                    width: '4rem',
                    height: '4rem',
                    backgroundColor: userColor === 'white' ? 'rgba(255, 255, 255, 0.1)' : userColor === 'black' ? 'rgba(15, 23, 42, 0.6)' : 'rgba(30, 41, 59, 0.6)',
                    border: userColor === 'white' ? '2px solid rgba(255, 255, 255, 0.3)' : userColor === 'black' ? '2px solid #475569' : '2px solid #475569'
                  }}>
                    <span style={{ fontSize: '2.5rem' }}>{userColor === 'white' ? '⚪' : userColor === 'black' ? '⚫' : '❓'}</span>
                  </div>
                  <div>
                    <small className="text-muted d-block">Your Color</small>
                    <p className="h4 fw-bold text-white mb-0 text-capitalize">{userColor || 'Pending'}</p>
                  </div>
                </div>
                <div className="p-3 rounded-3" style={{ backgroundColor: 'rgba(15, 23, 42, 0.4)', border: '1px solid rgba(71, 85, 105, 0.5)' }}>
                  <small className="text-white-50">
                    {userColor === 'white' ? '✓ You move first' : userColor === 'black' ? '✓ You move second' : 'Assigned when match starts'}
                  </small>
                </div>
              </div>
            </div>

            {/* Status Card */}
            <div className="card mb-4" style={{ backgroundColor: 'rgba(88, 28, 135, 0.2)', border: '1px solid rgba(168, 85, 247, 0.3)', borderRadius: '1rem', backdropFilter: 'blur(10px)' }}>
              <div className="card-body" style={{ padding: '1.5rem' }}>
                <div className="d-flex align-items-center gap-3 mb-3">
                  <div className="d-flex align-items-center justify-content-center rounded-3" style={{ width: '2.5rem', height: '2.5rem', backgroundColor: 'rgba(168, 85, 247, 0.2)', border: '1px solid rgba(168, 85, 247, 0.3)' }}>
                    <span style={{ fontSize: '1.25rem' }}>📊</span>
                  </div>
                  <h3 className="h5 fw-bold mb-0 text-white">Status</h3>
                </div>
                
                <div className="d-flex flex-column gap-3">
                  <div className="p-3 rounded-3" style={{ background: 'linear-gradient(to right, rgba(16, 185, 129, 0.2), rgba(15, 23, 42, 0.4))', border: '1px solid rgba(16, 185, 129, 0.3)' }}>
                    <div className="d-flex align-items-center justify-content-between">
                      <div>
                        <span className="text-white d-block mb-1">Configuration</span>
                        <small className="text-muted">Name, model & key</small>
                      </div>
                      <span className={`badge fw-bold ${botName && apiKey ? '' : ''}`} style={{
                        backgroundColor: botName && apiKey ? 'rgba(34, 197, 94, 0.3)' : 'rgba(234, 179, 8, 0.3)',
                        color: botName && apiKey ? '#bbf7d0' : '#fef08a',
                        border: botName && apiKey ? '1px solid rgba(34, 197, 94, 0.5)' : '1px solid rgba(234, 179, 8, 0.5)',
                        padding: '0.375rem 0.75rem'
                      }}>
                        {botName && apiKey ? '✓ Complete' : '⏳ Pending'}
                      </span>
                    </div>
                  </div>
                  
                  <div className="p-3 rounded-3" style={{ background: 'linear-gradient(to right, rgba(59, 130, 246, 0.2), rgba(15, 23, 42, 0.4))', border: '1px solid rgba(59, 130, 246, 0.3)' }}>
                    <div className="d-flex align-items-center justify-content-between">
                      <div>
                        <span className="text-white d-block mb-1">API Connection</span>
                        <small className="text-muted">Test & validate</small>
                      </div>
                      <span className="badge fw-bold" style={{
                        backgroundColor: connectionStatus === 'success' ? 'rgba(34, 197, 94, 0.3)' : connectionStatus === 'error' ? 'rgba(239, 68, 68, 0.3)' : 'rgba(51, 65, 85, 0.5)',
                        color: connectionStatus === 'success' ? '#bbf7d0' : connectionStatus === 'error' ? '#fecaca' : '#9ca3af',
                        border: connectionStatus === 'success' ? '1px solid rgba(34, 197, 94, 0.5)' : connectionStatus === 'error' ? '1px solid rgba(239, 68, 68, 0.5)' : '1px solid #475569',
                        padding: '0.375rem 0.75rem'
                      }}>
                        {connectionStatus === 'success' ? '✓ Valid' : connectionStatus === 'error' ? '✗ Failed' : '⏳ Pending'}
                      </span>
                    </div>
                  </div>
                  
                  <div className="p-3 rounded-3" style={{ background: 'linear-gradient(to right, rgba(168, 85, 247, 0.2), rgba(15, 23, 42, 0.4))', border: '1px solid rgba(168, 85, 247, 0.3)' }}>
                    <div className="d-flex align-items-center justify-content-between">
                      <div>
                        <span className="text-white d-block mb-1">Ready Status</span>
                        <small className="text-muted">Launch bot</small>
                      </div>
                      <span className="badge fw-bold" style={{
                        backgroundColor: isReady ? 'rgba(34, 197, 94, 0.3)' : 'rgba(51, 65, 85, 0.5)',
                        color: isReady ? '#bbf7d0' : '#9ca3af',
                        border: isReady ? '1px solid rgba(34, 197, 94, 0.5)' : '1px solid #475569',
                        padding: '0.375rem 0.75rem'
                      }}>
                        {isReady ? '✓ Ready' : '⏳ Pending'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Opponent Status Card */}
            <div className="card mb-4" style={{ backgroundColor: 'rgba(30, 58, 138, 0.2)', border: '1px solid rgba(59, 130, 246, 0.3)', borderRadius: '1rem', backdropFilter: 'blur(10px)' }}>
              <div className="card-body" style={{ padding: '1.5rem' }}>
                <div className="d-flex align-items-center gap-3 mb-3">
                  <div className="d-flex align-items-center justify-content-center rounded-3" style={{ width: '2.5rem', height: '2.5rem', backgroundColor: 'rgba(59, 130, 246, 0.2)', border: '1px solid rgba(59, 130, 246, 0.3)' }}>
                    <span style={{ fontSize: '1.25rem' }}>👥</span>
                  </div>
                  <h3 className="h5 fw-bold mb-0 text-white">Opponent</h3>
                </div>
                
                <div className="d-flex flex-column gap-3">
                  <div className="p-3 rounded-3" style={{ background: 'linear-gradient(to right, rgba(16, 185, 129, 0.2), rgba(15, 23, 42, 0.4))', border: '1px solid rgba(16, 185, 129, 0.3)' }}>
                    <div className="d-flex align-items-center justify-content-between">
                      <div>
                        <span className="text-white d-block mb-1">Connection</span>
                        <small className="text-muted">{opponentJoined ? (opponentName || 'Anonymous') : 'Waiting for opponent...'}</small>
                      </div>
                      <span className="badge fw-bold" style={{
                        backgroundColor: opponentJoined ? 'rgba(34, 197, 94, 0.3)' : 'rgba(234, 179, 8, 0.3)',
                        color: opponentJoined ? '#bbf7d0' : '#fef08a',
                        border: opponentJoined ? '1px solid rgba(34, 197, 94, 0.5)' : '1px solid rgba(234, 179, 8, 0.5)',
                        padding: '0.375rem 0.75rem'
                      }}>
                        {opponentJoined ? '✓ Joined' : '⏳ Waiting'}
                      </span>
                    </div>
                  </div>
                  
                  <div className="p-3 rounded-3" style={{ background: 'linear-gradient(to right, rgba(59, 130, 246, 0.2), rgba(15, 23, 42, 0.4))', border: '1px solid rgba(59, 130, 246, 0.3)' }}>
                    <div className="d-flex align-items-center justify-content-between">
                      <div>
                        <span className="text-white d-block mb-1">Configuration</span>
                        <small className="text-muted">Bot setup</small>
                      </div>
                      <span className="badge fw-bold" style={{
                        backgroundColor: opponentConfigured ? 'rgba(34, 197, 94, 0.3)' : 'rgba(51, 65, 85, 0.5)',
                        color: opponentConfigured ? '#bbf7d0' : '#9ca3af',
                        border: opponentConfigured ? '1px solid rgba(34, 197, 94, 0.5)' : '1px solid #475569',
                        padding: '0.375rem 0.75rem'
                      }}>
                        {opponentConfigured ? '✓ Ready' : '⏳ Pending'}
                      </span>
                    </div>
                  </div>
                  
                  <div className="p-3 rounded-3" style={{ background: 'linear-gradient(to right, rgba(168, 85, 247, 0.2), rgba(15, 23, 42, 0.4))', border: '1px solid rgba(168, 85, 247, 0.3)' }}>
                    <div className="d-flex align-items-center justify-content-between">
                      <div>
                        <span className="text-white d-block mb-1">Ready Status</span>
                        <small className="text-muted">Game start</small>
                      </div>
                      <span className="badge fw-bold" style={{
                        backgroundColor: opponentReady ? 'rgba(34, 197, 94, 0.3)' : 'rgba(51, 65, 85, 0.5)',
                        color: opponentReady ? '#bbf7d0' : '#9ca3af',
                        border: opponentReady ? '1px solid rgba(34, 197, 94, 0.5)' : '1px solid #475569',
                        padding: '0.375rem 0.75rem'
                      }}>
                        {opponentReady ? '✓ Ready' : '⏳ Pending'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Info Banner */}
            {!isReady && (
              <div className="p-4 rounded-3" style={{ background: 'linear-gradient(to right, rgba(245, 158, 11, 0.2), rgba(249, 115, 22, 0.1), rgba(245, 158, 11, 0.2))', border: '1px solid rgba(245, 158, 11, 0.4)', backdropFilter: 'blur(10px)', boxShadow: '0 10px 15px rgba(245, 158, 11, 0.1)' }}>
                <div className="d-flex gap-3 align-items-start">
                  <span style={{ fontSize: '1.5rem', flexShrink: 0, filter: 'drop-shadow(0 2px 4px rgba(0, 0, 0, 0.3))' }}>💡</span>
                  <div>
                    <p className="fw-bold mb-2" style={{ color: '#fef3c7' }}>⚠️ Pro Tip</p>
                    <p className="mb-0 small" style={{ color: '#fef3c7', lineHeight: '1.6' }}>
                      Test your connection before playing to ensure your API key works correctly. This helps prevent connection issues during matches.
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
