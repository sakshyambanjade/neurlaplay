import { Chessboard } from 'react-chessboard';

type Props = {
  currentFen: string;
  gameInfo: {
    white: string;
    black: string;
    moveNumber: number;
    gameNum: number;
    totalGames: number;
  };
  quality: {
    illegalSuggestions: number;
    correctionsApplied: number;
    lastMove: string;
    lastModel: string;
    lastSide: string;
  };
  eta: {
    completedGames: number;
    totalGames: number;
    gamesPerHour: number;
  };
  etaText: string;
};

export function LiveBoard({ currentFen, gameInfo, quality, eta, etaText }: Props) {
  return (
    <div>
      <div
        style={{
          background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)',
          padding: 20,
          borderRadius: 12,
          marginBottom: 16,
          border: '2px solid #4C72B0'
        }}
      >
        <h3 style={{ margin: 0, fontSize: 20 }}>Live Game View</h3>
        {gameInfo.white ? (
          <div style={{ fontSize: 14, marginTop: 12, lineHeight: 1.8 }}>
            <div>White: {gameInfo.white}</div>
            <div>Black: {gameInfo.black}</div>
            <div>Move: {gameInfo.moveNumber}</div>
            <div>Game: {gameInfo.gameNum} / {gameInfo.totalGames}</div>
            <div>Illegal suggestions: {quality.illegalSuggestions}</div>
            <div>Corrections applied: {quality.correctionsApplied}</div>
            <div>
              Last move:{' '}
              {quality.lastSide ? `${quality.lastSide} ${quality.lastModel} ${quality.lastMove}` : '-'}
            </div>
            <div>Run progress: {eta.completedGames} / {eta.totalGames}</div>
            <div>
              Speed: {eta.gamesPerHour > 0 ? `${eta.gamesPerHour.toFixed(1)} games/hour` : 'warming up'}
            </div>
            <div>ETA: {etaText}</div>
          </div>
        ) : (
          <div style={{ color: '#888', fontSize: 14, marginTop: 12 }}>Waiting for games to start...</div>
        )}
      </div>

      <div
        style={{
          border: '4px solid #4C72B0',
          borderRadius: 16,
          overflow: 'hidden',
          boxShadow: '0 20px 60px rgba(76, 114, 176, 0.35)'
        }}
      >
        <Chessboard position={currentFen} boardWidth={568} />
      </div>
    </div>
  );
}
