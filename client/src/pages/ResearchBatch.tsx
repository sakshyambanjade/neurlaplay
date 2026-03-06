import { useState } from 'react';

const API_BASE = 'http://localhost:3001';

export function ResearchBatch() {
  const [status, setStatus] = useState('Idle');
  const [result, setResult] = useState<string>('No run yet.');

  const startQuickBatch = async () => {
    setStatus('Running quick batch...');
    setResult('');
    try {
      const response = await fetch(`${API_BASE}/api/research/quick`, { method: 'POST' });
      const data = (await response.json()) as { ok: boolean; outputFile?: string; summary?: unknown; error?: string };
      if (!response.ok || !data.ok) {
        throw new Error(data.error ?? 'Batch failed');
      }
      setStatus('Done');
      setResult(`Output: ${data.outputFile ?? 'unknown'}\nSummary: ${JSON.stringify(data.summary, null, 2)}`);
    } catch (error) {
      setStatus('Failed');
      setResult(error instanceof Error ? error.message : String(error));
    }
  };

  return (
    <main style={{ maxWidth: 900, margin: '40px auto', fontFamily: 'Segoe UI, sans-serif', lineHeight: 1.5 }}>
      <h1>NeurlaPlay Research Batch</h1>
      <p>Minimal control panel for local Ollama quick batch testing.</p>
      <button onClick={startQuickBatch} style={{ padding: '10px 16px', cursor: 'pointer' }}>
        Run Quick Ollama Batch
      </button>
      <p><strong>Status:</strong> {status}</p>
      <pre style={{ background: '#f4f4f4', padding: 12, whiteSpace: 'pre-wrap' }}>{result}</pre>
    </main>
  );
}
