import React, { useState } from 'react';
import { useSocket } from '../hooks';
import { useGameStore } from '../store/gameStore';

/**
 * Lobby page - Match creation and player config
 */
export function LobbyPage() {
  const socket = useSocket();
  const matchId = useGameStore((s) => s.matchId);
  const userColor = useGameStore((s) => s.userColor);

  const [botName, setBotName] = useState('');
  const [model, setModel] = useState('gpt-4o');
  const [endpointUrl, setEndpointUrl] = useState('https://api.openai.com/v1/chat/completions');
  const [apiKey, setApiKey] = useState('');
  const [isReady, setIsReady] = useState(false);
  const [testingConnection, setTestingConnection] = useState(false);

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
        alert('✅ Connection successful!');
      } else {
        alert(`❌ Connection failed: ${response.status} ${response.statusText}`);
      }
    } catch (error) {
      alert(`❌ Connection error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setTestingConnection(false);
    }
  };

  const handleReady = () => {
    if (!botName || !apiKey) {
      alert('Please fill in all fields');
      return;
    }

    socket?.emit('setConfig', {
      matchId,
      botName,
      model,
      endpointType: 'openai',
      endpointUrl
    });

    socket?.emit('setReady', { matchId });
    setIsReady(true);
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-900">
      <div className="w-full max-w-md bg-gray-800 rounded-lg shadow-xl p-8">
        <h1 className="text-3xl font-bold text-white mb-2">⚔️ LLM Arena</h1>
        <p className="text-gray-400 mb-6">Configure your bot and join the match</p>

        <div className="space-y-4">
          {/* Bot Name */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Bot Name</label>
            <input
              type="text"
              value={botName}
              onChange={(e) => setBotName(e.target.value)}
              placeholder="e.g., GPT-4o-Pro"
              className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
              disabled={isReady}
            />
          </div>

          {/* Model */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Model</label>
            <select
              value={model}
              onChange={(e) => setModel(e.target.value)}
              className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded text-white focus:outline-none focus:border-blue-500"
              disabled={isReady}
            >
              <option value="gpt-4o">GPT-4o</option>
              <option value="gpt-4-turbo">GPT-4 Turbo</option>
              <option value="claude-3-5-sonnet-20241022">Claude 3.5 Sonnet</option>
              <option value="mixtral-8x7b-32768">Mixtral (Groq)</option>
            </select>
          </div>

          {/* Endpoint URL */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">API Endpoint</label>
            <input
              type="text"
              value={endpointUrl}
              onChange={(e) => setEndpointUrl(e.target.value)}
              placeholder="https://api.openai.com/v1/chat/completions"
              className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded text-white placeholder-gray-500 text-sm focus:outline-none focus:border-blue-500"
              disabled={isReady}
            />
          </div>

          {/* API Key */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">API Key</label>
            <input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="sk-..."
              className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
              disabled={isReady}
            />
            <p className="text-xs text-gray-400 mt-2">⚠️ Your key stays in your browser. Never sent to our server.</p>
          </div>

          {/* Test Connection Button */}
          {!isReady && (
            <button
              onClick={handleTestConnection}
              disabled={testingConnection || !apiKey}
              className="w-full px-4 py-2 bg-gray-700 border border-gray-600 text-gray-300 rounded hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {testingConnection ? 'Testing...' : '🔗 Test Connection'}
            </button>
          )}

          {/* Ready Button */}
          <button
            onClick={handleReady}
            disabled={isReady}
            className="w-full px-4 py-3 bg-blue-600 text-white font-semibold rounded hover:bg-blue-700 disabled:bg-green-600 disabled:cursor-not-allowed"
          >
            {isReady ? '✅ Ready!' : '🚀 Ready to Play'}
          </button>
        </div>

        <div className="mt-6 p-4 bg-gray-700 rounded text-sm text-gray-300">
          <p className="font-semibold mb-2">Match Info:</p>
          <p>Match ID: <code className="bg-gray-900 px-2 py-1 rounded">{matchId}</code></p>
          <p>Your Color: <code className="bg-gray-900 px-2 py-1 rounded uppercase">{userColor}</code></p>
        </div>
      </div>
    </div>
  );
}
