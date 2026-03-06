import { useState } from 'react';
import ResearchBatch from './pages/ResearchBatch';
import TournamentMode from './pages/TournamentMode';
import './index.css';

type PageMode = 'batch' | 'tournament';

/**
 * Main App Component - Research Chess with Batch & Tournament Modes
 */
export function App() {
  const [mode, setMode] = useState<PageMode>('tournament');

  return (
    <div>
      {/* Navigation */}
      <nav className="bg-gray-900 text-white sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-8 py-4 flex items-center justify-between">
          <h1 className="text-2xl font-bold">♟️ Chess Research Lab</h1>
          <div className="flex gap-4">
            <button
              onClick={() => setMode('tournament')}
              className={`px-4 py-2 rounded font-semibold transition ${
                mode === 'tournament'
                  ? 'bg-blue-500 text-white'
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
            >
              🏆 Tournament
            </button>
            <button
              onClick={() => setMode('batch')}
              className={`px-4 py-2 rounded font-semibold transition ${
                mode === 'batch'
                  ? 'bg-green-500 text-white'
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
            >
              ⚙️ Batch
            </button>
          </div>
        </div>
      </nav>

      {/* Page Content */}
      {mode === 'batch' && <ResearchBatch />}
      {mode === 'tournament' && <TournamentMode />}
    </div>
  );
}

export default App;
