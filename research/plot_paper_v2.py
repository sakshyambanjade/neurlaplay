import pandas as pd
import numpy as np
import matplotlib.pyplot as plt
import matplotlib.gridspec as gridspec
import networkx as nx
import chess, os, sys
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "tension"))
from tension_graph import build_tension_graph, compute_tension
from scipy import stats

COLORS = {
    "tinyllama": "#4C72B0", "phi3": "#DD8452",
    "llama3.1":  "#55A868", "human": "#C44E52", "engine": "#8172B2"
}

def match_model(name: str) -> str:
    name = str(name).lower()
    for k in COLORS:
        if k in name: return k
    return "other"

def load(run_dir: str):
    ply  = pd.read_csv(os.path.join(run_dir, "tension_per_ply.csv"))
    game = pd.read_csv(os.path.join(run_dir, "tension_per_game.csv"))
    pos  = pd.read_csv(os.path.join(run_dir, "positions.csv"))

    # ── Load human baseline if present ──
    h_ply_path = os.path.join(run_dir, "human_tension_per_ply.csv")
    if os.path.exists(h_ply_path):
        h = pd.read_csv(h_ply_path)
        h["white_model"] = "human"
        ply = pd.concat([ply, h], ignore_index=True)

    ply["model"]  = ply["white_model"].apply(match_model)
    game["model"] = game["white_model"].apply(match_model)
    return ply, game, pos

# ── Fig 1: Tension over ply ───────────────────────────────────────────────────
def fig1(ply_df, ax):
    for model, color in COLORS.items():
        g = ply_df[ply_df["model"] == model].groupby("ply")["T"]
        if g.ngroups == 0: continue
        m, s = g.mean(), g.std()
        ax.plot(m.index, m.values, label=model, color=color, lw=2)
        ax.fill_between(m.index, (m-s).values, (m+s).values, alpha=0.12, color=color)
    ax.set(xlabel="Ply", ylabel="Strategic Tension T(G)",
           title="Fig 1: Strategic Tension Over Game Progression")
    ax.legend(); ax.grid(alpha=0.3)

# ── Fig 2: Phase accuracy (computed from positions + CPL) ────────────────────
def fig2(pos_df, ax):
    # Compute accuracy per phase per model from CPL if available
    # Fall back to piece-count proxy only if CPL missing
    if "cpl" in pos_df.columns and pos_df["cpl"].notna().sum() > 100:
        # accuracy = 1 - normalised CPL (capped at 0–100)
        pos_df = pos_df.copy()
        pos_df["accuracy"] = (100 - pos_df["cpl"].clip(0, 100)).clip(0, 100)
        pos_df["model"]    = pos_df["white_model"].apply(match_model)
        phases  = ["opening", "middlegame", "endgame"]
        models  = [m for m in COLORS if pos_df[pos_df["model"]==m].shape[0] > 0]
        x = np.arange(len(phases))
        w = 0.8 / max(len(models), 1)
        for i, model in enumerate(models):
            vals = [pos_df[(pos_df["model"]==model) & (pos_df["phase"]==p)]["accuracy"].mean()
                    for p in phases]
            ax.bar(x + i*w - (len(models)-1)*w/2, vals, w,
                   label=model, color=COLORS.get(model, "#888"))
        ax.set_xticks(x)
        ax.set_xticklabels(["Opening\n(Ply 1–20)", "Middlegame\n(21–40)", "Endgame\n(41+)"])
        ax.set_title("Fig 2: Accuracy by Game Phase (from CPL data)")
        ax.set_ylabel("Move Accuracy (%)"); ax.set_ylim(0, 100)
        ax.legend(); ax.grid(axis="y", alpha=0.3)
    else:
        ax.text(0.5, 0.5,
                "CPL data not yet available.\nAdd Stockfish eval to positions.csv.",
                ha="center", va="center", transform=ax.transAxes,
                fontsize=11, color="gray")
        ax.set_title("Fig 2: Accuracy by Game Phase (pending CPL)")

# ── Fig 3: Real high-tension position from YOUR games ────────────────────────
def fig3(pos_df, ax):
    if "fen" not in pos_df.columns or pos_df.empty:
        ax.text(0.5, 0.5, "FEN data not available", ha="center", va="center",
                transform=ax.transAxes, fontsize=11, color="gray")
        ax.set_title("Fig 3: High-Tension Network Position")
        return

    # Pick the FEN with highest piece count in middlegame (proxy for high tension)
    mid = pos_df[pos_df["phase"] == "middlegame"].copy()
    if mid.empty: mid = pos_df.copy()
    sample_fen = mid.loc[mid["piece_count"].idxmax(), "fen"]

    G = build_tension_graph(sample_fen)
    board = chess.Board(sample_fen)
    pos_map = {sq: (sq % 8, sq // 8) for sq in G.nodes}

    edge_colors = []
    for u, v, d in G.edges(data=True):
        et = d.get("edge_type", "control")
        edge_colors.append(
            "#DD8452" if et == "attack" else
            "#55A868" if et == "defense" else "#CCCCCC"
        )
    node_colors = []
    for n in G.nodes:
        if G.nodes[n].get("node_type") == "piece":
            node_colors.append("#4C72B0" if G.nodes[n].get("color") == chess.WHITE else "#C44E52")
        else:
            node_colors.append("#EEEEEE")

    nx.draw(G, pos=pos_map, ax=ax,
            node_color=node_colors, edge_color=edge_colors,
            node_size=120, width=1.0, alpha=0.85, with_labels=False)
    t = compute_tension(sample_fen)["T"]
    ax.set_title(f"Fig 3: Tension Network (T={t:.2f})\nBlue=White, Red=Black, Orange=Attack, Green=Defense",
                 fontsize=9)

# ── Fig 4: T/piece ratio over ply ────────────────────────────────────────────
def fig4(ply_df, ax):
    for model, color in COLORS.items():
        g = ply_df[(ply_df["model"]==model) & (ply_df["ply"] <= 150)].groupby("ply")["T_per_piece"].mean()
        if g.empty: continue
        ax.plot(g.index, g.values, label=model, color=color, lw=2)
    ax.set(xlabel="Ply", ylabel="T / Active Pieces",
           title="Fig 4: Tension per Piece (Cognitive Load Proxy)")
    ax.legend(); ax.grid(alpha=0.3)

# ── Fig 5: Tension vs CPL — fully computed r ──────────────────────────────────
def fig5(ply_df, ax):
    if "cpl" not in ply_df.columns or ply_df["cpl"].notna().sum() < 50:
        ax.text(0.5, 0.5,
                "CPL data not yet available.\nRun Stockfish eval first.",
                ha="center", va="center", transform=ax.transAxes,
                fontsize=11, color="gray")
        ax.set_title("Fig 5: Tension vs CPL (pending Stockfish eval)")
        return

    df = ply_df[ply_df["cpl"].notna()].sample(min(2000, len(ply_df)), random_state=42)
    r, p = stats.pearsonr(df["T"], df["cpl"])
    ax.scatter(df["T"], df["cpl"], alpha=0.2, s=8, color="#4C72B0")
    m, b = np.polyfit(df["T"], df["cpl"], 1)
    x = np.linspace(df["T"].min(), df["T"].max(), 100)
    ax.plot(x, m*x+b, "r--", lw=2, label=f"r={r:.2f}, p={p:.1e}")
    ax.set(xlabel="Tension T(G)", ylabel="Centipawn Loss (CPL)",
           title="Fig 5: Strategic Tension vs Move Quality")
    ax.legend(); ax.grid(alpha=0.3)

# ── Main ──────────────────────────────────────────────────────────────────────
def main():
    run_dir = sys.argv[1] if len(sys.argv) > 1 else "."
    ply_df, game_df, pos_df = load(run_dir)

    fig = plt.figure(figsize=(20, 16))
    gs  = gridspec.GridSpec(3, 2, figure=fig, hspace=0.45, wspace=0.35)

    fig1(ply_df, fig.add_subplot(gs[0, :]))
    fig2(pos_df, fig.add_subplot(gs[1, 0]))
    fig3(pos_df, fig.add_subplot(gs[1, 1]))
    fig4(ply_df, fig.add_subplot(gs[2, 0]))
    fig5(ply_df, fig.add_subplot(gs[2, 1]))

    fig.suptitle("Strategic Tension in LLM Chess Agents\n"
                 "Network-Theoretic Analysis of Planning Horizons",
                 fontsize=16, fontweight="bold")

    out_dir = os.path.join(run_dir if run_dir != "." else "research", "plots")
    os.makedirs(out_dir, exist_ok=True)
    out = os.path.join(out_dir, "paper_figures_v2.png")
    plt.savefig(out, dpi=300, bbox_inches="tight")
    print(f"✅ All 5 figures saved → {out}")
    plt.close()

if __name__ == "__main__":
    main()

    fig.suptitle("Strategic Tension in LLM Chess Agents\nNetwork-Theoretic Analysis of Planning Horizons",
                 fontsize=16, fontweight="bold", y=1.01)

    out = "research/plots/paper_figures_v2.png"
    plt.savefig(out, dpi=300, bbox_inches="tight")
    print(f"✅ All 5 figures saved → {out}")
    plt.close()

if __name__ == "__main__":
    main()
