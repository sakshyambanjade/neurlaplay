declare module 'stockfish' {
  type StockfishEngine = {
    postMessage: (command: string) => void;
    onmessage?: (event: unknown) => void;
  };

  const factory: () => StockfishEngine;
  export default factory;
}
