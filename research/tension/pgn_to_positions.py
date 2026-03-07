import chess.pgn
import chess
import pandas as pd
import json
import sys
from pathlib import Path

def get_phase(ply, piece_count):
    if ply <= 20:      return "opening"
    elif piece_count >= 10: return "middlegame"
    else:              return "endgame"

def pgn_to_positions(pgn_path, output_path):
    rows = []
    with open(pgn_path) as f:
        game_id = 0
        while True:
            game = chess.pgn.read_game(f)
            if game is None:
                break
            game_id += 1
            board = game.board()
            ply = 0
            white_model = game.headers.get("White", "unknown")
            black_model = game.headers.get("Black", "unknown")
            result     = game.headers.get("Result", "*")

            for move in game.mainline_moves():
                fen         = board.fen()
                piece_count = len(board.piece_map())
                phase       = get_phase(ply, piece_count)
                rows.append({
                    "game_id":     game_id,
                    "ply":         ply,
                    "fen":         fen,
                    "side":        "white" if board.turn == chess.WHITE else "black",
                    "move_uci":    move.uci(),
                    "piece_count": piece_count,
                    "phase":       phase,
                    "white_model": white_model,
                    "black_model": black_model,
                    "result":      result
                })
                board.push(move)
                ply += 1

    df = pd.DataFrame(rows)
    df.to_csv(output_path, index=False)
    print(f"✅ {len(df)} positions from {game_id} games → {output_path}")
    return df

if __name__ == "__main__":
    pgn   = sys.argv[1] if len(sys.argv) > 1 else "research/all-games.pgn"
    out   = sys.argv[2] if len(sys.argv) > 2 else "research/data/positions.csv"
    pgn_to_positions(pgn, out)
