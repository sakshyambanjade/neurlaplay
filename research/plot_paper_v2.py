import json
import os
import re
import sys

import matplotlib.gridspec as gridspec
import matplotlib.pyplot as plt
import networkx as nx
import numpy as np
import pandas as pd
from scipy import stats

import chess

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "tension"))
from tension_graph import build_tension_graph, compute_tension

COLORS = {
    "tinyllama": "#4C72B0",
    "phi3": "#DD8452",
    "mistral": "#55A868",
    "llama3.1": "#8172B2",
    "human": "#C44E52",
    "engine": "#937860",
}


def match_model(name: str) -> str:
    name = str(name).lower()
    for key in COLORS:
        if key in name:
            return key
    return "other"


def parse_game_index(game_id: str) -> int | None:
    m = re.search(r"(\d+)$", str(game_id))
    if not m:
        return None
    try:
        return int(m.group(1))
    except ValueError:
        return None


def extract_bound_count(profile: dict | None) -> float:
    if not isinstance(profile, dict):
        return np.nan
    if "boundCount" in profile:
        try:
            return float(profile["boundCount"])
        except (TypeError, ValueError):
            return np.nan
    return float(
        int(bool(profile.get("hasPiece")))
        + int(bool(profile.get("hasOrigin")))
        + int(bool(profile.get("hasDestination")))
        + int(bool(profile.get("hasLegalConstraint")))
    )


def load_datapoints(run_dir: str) -> pd.DataFrame:
    path = os.path.join(run_dir, "paper-datapoints.json")
    if not os.path.exists(path):
        return pd.DataFrame()

    with open(path, "r", encoding="utf-8") as f:
        raw = json.load(f)

    if not isinstance(raw, list):
        return pd.DataFrame()

    df = pd.DataFrame(raw)
    if df.empty:
        return df

    df["model_norm"] = df.get("model", "unknown").apply(match_model)
    df["bound_count"] = df.get("bindingProfile", pd.Series(dtype="object")).apply(extract_bound_count)
    df["illegal"] = df.get("illegalSuggestion", False).astype(bool)
    df["moveNumber"] = pd.to_numeric(df.get("moveNumber", np.nan), errors="coerce")
    df["ply"] = df["moveNumber"] - 1

    if "gameIndex" in df.columns:
        df["game_idx"] = pd.to_numeric(df["gameIndex"], errors="coerce")
    else:
        df["game_idx"] = df.get("gameId", "").apply(parse_game_index)

    return df


def load(run_dir: str):
    ply = pd.read_csv(os.path.join(run_dir, "tension_per_ply.csv"))
    game = pd.read_csv(os.path.join(run_dir, "tension_per_game.csv"))
    pos = pd.read_csv(os.path.join(run_dir, "positions.csv"))

    h_ply_path = os.path.join(run_dir, "human_tension_per_ply.csv")
    if os.path.exists(h_ply_path):
        h = pd.read_csv(h_ply_path)
        h["white_model"] = "human"
        ply = pd.concat([ply, h], ignore_index=True)

    ply["model"] = ply["white_model"].apply(match_model)
    game["model"] = game["white_model"].apply(match_model)
    datapoints = load_datapoints(run_dir)
    return ply, game, pos, datapoints


def fig1_tension_over_ply(ply_df, ax):
    for model, color in COLORS.items():
        g = ply_df[ply_df["model"] == model].groupby("ply")["T"]
        if g.ngroups == 0:
            continue
        mean = g.mean()
        std = g.std()
        ax.plot(mean.index, mean.values, label=model, color=color, lw=2)
        ax.fill_between(mean.index, (mean - std).values, (mean + std).values, alpha=0.12, color=color)
    ax.set(
        xlabel="Ply",
        ylabel="Strategic Tension T(G)",
        title="Tension Over Game Progression",
    )
    ax.legend()
    ax.grid(alpha=0.3)


def fig2_binding_curve(datapoints_df, ax):
    if datapoints_df.empty:
        ax.text(0.5, 0.5, "paper-datapoints.json not found", ha="center", va="center", transform=ax.transAxes)
        ax.set_title("Binding Curve Over Move Number")
        return

    illegal = datapoints_df[(datapoints_df["illegal"]) & (datapoints_df["bound_count"].notna())]
    if illegal.empty:
        ax.text(0.5, 0.5, "No illegal attempts with bindingProfile found", ha="center", va="center", transform=ax.transAxes)
        ax.set_title("Binding Curve Over Move Number")
        return

    curve = illegal.groupby("moveNumber")["bound_count"].mean().sort_index()
    rolling = curve.rolling(window=8, min_periods=1).mean()

    ax.plot(curve.index, curve.values, color="#4C72B0", alpha=0.4, lw=1.5, label="mean boundCount")
    ax.plot(rolling.index, rolling.values, color="#DD8452", lw=2.5, label="rolling mean (w=8)")
    ax.set(
        xlabel="Move Number",
        ylabel="boundCount (0-4)",
        title="Binding Curve Over Game Length",
    )
    ax.set_ylim(0, 4.1)
    ax.legend()
    ax.grid(alpha=0.3)


def fig3_binding_profile_by_model(datapoints_df, ax):
    if datapoints_df.empty:
        ax.text(0.5, 0.5, "paper-datapoints.json not found", ha="center", va="center", transform=ax.transAxes)
        ax.set_title("Cross-Model Binding Components")
        return

    illegal = datapoints_df[(datapoints_df["illegal"]) & (datapoints_df["bindingProfile"].notna())].copy()
    if illegal.empty:
        ax.text(0.5, 0.5, "No illegal attempts with bindingProfile found", ha="center", va="center", transform=ax.transAxes)
        ax.set_title("Cross-Model Binding Components")
        return

    for comp in ["hasPiece", "hasOrigin", "hasDestination", "hasLegalConstraint"]:
        illegal[comp] = illegal["bindingProfile"].apply(lambda p: float(bool(p.get(comp))) if isinstance(p, dict) else 0.0)

    by_model = (
        illegal.groupby("model_norm")[["hasPiece", "hasOrigin", "hasDestination", "hasLegalConstraint", "bound_count"]]
        .mean()
        .sort_values("bound_count")
    )

    if by_model.empty:
        ax.text(0.5, 0.5, "No model-level binding data", ha="center", va="center", transform=ax.transAxes)
        ax.set_title("Cross-Model Binding Components")
        return

    x = np.arange(len(by_model.index))
    width = 0.18
    comps = [
        ("hasPiece", "Piece"),
        ("hasOrigin", "Origin"),
        ("hasDestination", "Destination"),
        ("hasLegalConstraint", "LegalConstraint"),
    ]

    for i, (col, label) in enumerate(comps):
        ax.bar(x + (i - 1.5) * width, by_model[col].values, width=width, label=label, alpha=0.85)

    ax.set_xticks(x)
    ax.set_xticklabels(by_model.index)
    ax.set_ylim(0, 1.0)
    ax.set_ylabel("Presence Rate")
    ax.set_title("Cross-Model Binding Component Presence")
    ax.legend(fontsize=8)
    ax.grid(axis="y", alpha=0.3)


def fig4_tension_vs_binding(ply_df, datapoints_df, ax):
    if datapoints_df.empty:
        ax.text(0.5, 0.5, "paper-datapoints.json not found", ha="center", va="center", transform=ax.transAxes)
        ax.set_title("Tension vs Binding Completeness")
        return

    illegal = datapoints_df[(datapoints_df["illegal"]) & (datapoints_df["bound_count"].notna())].copy()
    if illegal.empty:
        ax.text(0.5, 0.5, "No illegal attempts with bindingProfile found", ha="center", va="center", transform=ax.transAxes)
        ax.set_title("Tension vs Binding Completeness")
        return

    tension = ply_df.copy()
    tension["game_idx"] = pd.to_numeric(tension.get("game_id", np.nan), errors="coerce")
    tension["ply"] = pd.to_numeric(tension.get("ply", np.nan), errors="coerce")

    merged = illegal.merge(
        tension[["game_idx", "ply", "T"]],
        how="inner",
        on=["game_idx", "ply"],
    )

    if merged.empty:
        ax.text(
            0.5,
            0.5,
            "No overlap between datapoints and tension_per_ply\n(ensure both are from same run)",
            ha="center",
            va="center",
            transform=ax.transAxes,
        )
        ax.set_title("Tension vs Binding Completeness")
        return

    sample = merged.sample(min(2500, len(merged)), random_state=42)
    ax.scatter(sample["T"], sample["bound_count"], alpha=0.2, s=10, color="#4C72B0")

    if sample["T"].nunique() > 1 and sample["bound_count"].nunique() > 1:
        r, p = stats.pearsonr(sample["T"], sample["bound_count"])
        m, b = np.polyfit(sample["T"], sample["bound_count"], 1)
        x = np.linspace(sample["T"].min(), sample["T"].max(), 100)
        ax.plot(x, m * x + b, "r--", lw=2, label=f"r={r:.2f}, p={p:.1e}")
        ax.legend()

    ax.set(
        xlabel="Tension T(G)",
        ylabel="boundCount (0-4)",
        title="Position Tension vs Binding Completeness",
    )
    ax.set_ylim(0, 4.1)
    ax.grid(alpha=0.3)


def fig5_tension_per_piece(ply_df, ax):
    for model, color in COLORS.items():
        g = ply_df[(ply_df["model"] == model) & (ply_df["ply"] <= 150)].groupby("ply")["T_per_piece"].mean()
        if g.empty:
            continue
        ax.plot(g.index, g.values, label=model, color=color, lw=2)
    ax.set(
        xlabel="Ply",
        ylabel="T / Active Pieces",
        title="Tension per Piece (Cognitive Load Proxy)",
    )
    ax.legend(fontsize=8)
    ax.grid(alpha=0.3)


def fig6_tension_network(pos_df, ax):
    if "fen" not in pos_df.columns or pos_df.empty:
        ax.text(0.5, 0.5, "FEN data not available", ha="center", va="center", transform=ax.transAxes)
        ax.set_title("Example High-Tension Position")
        return

    mid = pos_df[pos_df["phase"] == "middlegame"].copy()
    if mid.empty:
        mid = pos_df.copy()
    sample_fen = mid.loc[mid["piece_count"].idxmax(), "fen"]

    graph = build_tension_graph(sample_fen)
    pos_map = {sq: (sq % 8, sq // 8) for sq in graph.nodes}

    edge_colors = []
    for _, _, data in graph.edges(data=True):
        edge_type = data.get("edge_type", "control")
        if edge_type == "attack":
            edge_colors.append("#DD8452")
        elif edge_type == "defense":
            edge_colors.append("#55A868")
        else:
            edge_colors.append("#CCCCCC")

    node_colors = []
    for node in graph.nodes:
        node_type = graph.nodes[node].get("node_type")
        if node_type == "piece":
            node_colors.append("#4C72B0" if graph.nodes[node].get("color") == chess.WHITE else "#C44E52")
        else:
            node_colors.append("#EEEEEE")

    nx.draw(
        graph,
        pos=pos_map,
        ax=ax,
        node_color=node_colors,
        edge_color=edge_colors,
        node_size=120,
        width=1.0,
        alpha=0.85,
        with_labels=False,
    )
    t = compute_tension(sample_fen)["T"]
    ax.set_title(f"Example Tension Network (T={t:.2f})", fontsize=10)


def main():
    run_dir = sys.argv[1] if len(sys.argv) > 1 else "."
    ply_df, game_df, pos_df, datapoints_df = load(run_dir)

    fig = plt.figure(figsize=(22, 16))
    gs = gridspec.GridSpec(2, 3, figure=fig, hspace=0.38, wspace=0.30)

    fig1_tension_over_ply(ply_df, fig.add_subplot(gs[0, 0]))
    fig2_binding_curve(datapoints_df, fig.add_subplot(gs[0, 1]))
    fig3_binding_profile_by_model(datapoints_df, fig.add_subplot(gs[0, 2]))
    fig4_tension_vs_binding(ply_df, datapoints_df, fig.add_subplot(gs[1, 0]))
    fig5_tension_per_piece(ply_df, fig.add_subplot(gs[1, 1]))
    fig6_tension_network(pos_df, fig.add_subplot(gs[1, 2]))

    fig.suptitle(
        "Strategic Tension and Neural-Binding Failure in LLM Chess Agents",
        fontsize=16,
        fontweight="bold",
    )

    out_dir = os.path.join(run_dir if run_dir != "." else "research", "plots")
    os.makedirs(out_dir, exist_ok=True)
    out_path = os.path.join(out_dir, "paper_figures_v2.png")
    plt.savefig(out_path, dpi=300, bbox_inches="tight")
    print(f"Saved figures -> {out_path}")
    plt.close()


if __name__ == "__main__":
    main()
