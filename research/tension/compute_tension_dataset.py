import pandas as pd
import sys
from pathlib import Path
from tension_graph import compute_tension

def compute_all(positions_csv, per_ply_out, per_game_out):
    df = pd.read_csv(positions_csv)
    print(f"Computing tension for {len(df)} positions...")

    results = []
    for i, row in df.iterrows():
        t = compute_tension(row["fen"])
        results.append({
            "game_id":     row["game_id"],
            "ply":         row["ply"],
            "phase":       row["phase"],
            "white_model": row["white_model"],
            "black_model": row["black_model"],
            "result":      row["result"],
            "piece_count": row["piece_count"],
            "T":           t["T"],
            "T_per_piece": t["T_per_piece"],
            "nodes":       t["nodes"],
            "edges":       t["edges"]
        })
        if i % 500 == 0:
            print(f"  {i}/{len(df)} done...")

    df_t = pd.DataFrame(results)
    df_t.to_csv(per_ply_out, index=False)
    print(f"[OK] Per-ply tension -> {per_ply_out}")

    # Per-game aggregation
    g = df_t.groupby("game_id").agg(
        peak_T=("T", "max"),
        cum_T=("T", "sum"),
        avg_T=("T", "mean"),
        avg_T_per_piece=("T_per_piece", "mean"),
        white_model=("white_model", "first"),
        black_model=("black_model", "first"),
        result=("result", "first"),
        total_plies=("ply", "count"),
        opening_T=("T", lambda x: x[df_t.loc[x.index,"phase"]=="opening"].mean()),
        midgame_T=("T", lambda x: x[df_t.loc[x.index,"phase"]=="midgame"].mean()),
        endgame_T=("T", lambda x: x[df_t.loc[x.index,"phase"]=="endgame"].mean()),
    ).reset_index()
    g.to_csv(per_game_out, index=False)
    print(f"[OK] Per-game tension -> {per_game_out}")
    return df_t, g

if __name__ == "__main__":
    import sys, os
    sys.path.insert(0, os.path.dirname(__file__))
    positions = sys.argv[1] if len(sys.argv) > 1 else "research/data/positions.csv"
    per_ply   = sys.argv[2] if len(sys.argv) > 2 else "research/data/tension_per_ply.csv"
    per_game  = sys.argv[3] if len(sys.argv) > 3 else "research/data/tension_per_game.csv"
    compute_all(positions, per_ply, per_game)
