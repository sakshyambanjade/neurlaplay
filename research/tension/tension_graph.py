import chess
import numpy as np
import networkx as nx

PIECE_VALUES = {
    chess.PAWN: 1, chess.KNIGHT: 3, chess.BISHOP: 3,
    chess.ROOK: 5, chess.QUEEN: 9, chess.KING: 2
}

def build_tension_graph(fen: str) -> nx.Graph:
    board = chess.Board(fen)
    G = nx.Graph()

    # Add piece nodes with raw values (not normalized)
    for sq, piece in board.piece_map().items():
        G.add_node(sq, node_type="piece",
                   color=piece.color,
                   piece_type=piece.piece_type,
                   value=PIECE_VALUES[piece.piece_type])

    for sq, piece in board.piece_map().items():
        pv = PIECE_VALUES[piece.piece_type]
        for target in board.attacks(sq):
            target_piece = board.piece_at(target)
            if target_piece:
                tv = PIECE_VALUES[target_piece.piece_type]
                w = float(pv + tv)                  # raw piece value sum
                etype = ("defense" if target_piece.color == piece.color else "attack")
            else:
                w = float(pv)                        # control weight
                etype = "control"
                if target not in G.nodes:
                    G.add_node(target, node_type="square", value=0)
            if G.has_edge(sq, target):
                G[sq][target]["weight"] += w
            else:
                G.add_edge(sq, target, weight=w, edge_type=etype)

    return G

def compute_tension(fen: str) -> dict:
    board = chess.Board(fen)
    pieces = board.piece_map()
    if not pieces:
        return {"T": 0.0, "T_per_piece": 0.0, "nodes": 0, "edges": 0}

    G = build_tension_graph(fen)
    n = G.number_of_nodes()
    if n == 0:
        return {"T": 0.0, "T_per_piece": 0.0, "nodes": 0, "edges": 0}

    A = nx.to_numpy_array(G, weight="weight")
    # Use eigvalsh (symmetric real matrix) — returns sorted ascending
    eigvals = np.linalg.eigvalsh(A)
    T = float(eigvals[-1])              # dominant (max) eigenvalue

    piece_count = len(pieces)
    return {
        "T":           round(max(T, 0.0), 4),
        "T_per_piece": round(max(T, 0.0) / piece_count, 4),
        "nodes":       n,
        "edges":       G.number_of_edges()
    }

# ── Sanity gates ──────────────────────────────────────────────────────────────

# Updated ranges for raw piece value sums (not normalized)
SANITY_STARTING_MIN = 25.0
SANITY_STARTING_MAX = 40.0
TACTICAL_FEN = "r1bqkb1r/pppp1ppp/2n2n2/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 4 4"
QUIET_FEN    = "8/8/8/8/8/8/PPPPPPPP/RNBQKBNR w KQ - 0 1"  # only white pieces

def run_sanity_checks():
    import sys
    errors = []

    # Check 1: starting position T in expected range
    start_t = compute_tension(chess.STARTING_FEN)["T"]
    if not (SANITY_STARTING_MIN <= start_t <= SANITY_STARTING_MAX):
        errors.append(
            f"Starting position T={start_t:.2f} outside [{SANITY_STARTING_MIN}, {SANITY_STARTING_MAX}]"
        )
    else:
        print(f"✅ Starting position T={start_t:.2f} (target {SANITY_STARTING_MIN}–{SANITY_STARTING_MAX})")

    # Check 2: tactical > quiet
    tactical_t = compute_tension(TACTICAL_FEN)["T"]
    quiet_t    = compute_tension(QUIET_FEN)["T"]
    if tactical_t <= quiet_t:
        errors.append(
            f"Tactical T={tactical_t:.2f} should be > Quiet T={quiet_t:.2f}"
        )
    else:
        print(f"✅ Tactical T={tactical_t:.2f} > Quiet T={quiet_t:.2f}")

    # Check 3: T is never NaN or negative for starting pos
    if np.isnan(start_t) or start_t < 0:
        errors.append(f"T is NaN or negative for starting position")
    else:
        print(f"✅ T is valid (non-NaN, non-negative)")

    if errors:
        print("\n❌ SANITY CHECKS FAILED:")
        for e in errors:
            print(f"  - {e}")
        sys.exit(1)
    else:
        print("\n🎉 All sanity checks passed!")

if __name__ == "__main__":
    run_sanity_checks()
    tactical = "r1bqkb1r/pppp1ppp/2n2n2/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 4 4"
    print(f"Tactical position tension: {compute_tension(tactical)}")
