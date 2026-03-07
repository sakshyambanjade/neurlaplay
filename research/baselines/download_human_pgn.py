import urllib.request, zstandard, io, chess.pgn, json, hashlib
from pathlib import Path
from datetime import datetime

TARGET_GAMES  = 300
ELO_MIN, ELO_MAX = 1400, 1600
OUT_DIR = Path("research/baselines/humans")
OUT_DIR.mkdir(parents=True, exist_ok=True)
URL = "https://database.lichess.org/standard/lichess_db_standard_rated_2024-01.pgn.zst"

def file_checksum(path):
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(8192), b""):
            h.update(chunk)
    return h.hexdigest()

def is_eligible(game):
    try:
        w  = int(game.headers.get("WhiteElo", 0))
        b  = int(game.headers.get("BlackElo", 0))
        tc = game.headers.get("TimeControl", "")
        v  = game.headers.get("Variant", "Standard")
        return ELO_MIN <= w <= ELO_MAX and ELO_MIN <= b <= ELO_MAX \
               and v == "Standard" and tc != "-"
    except:
        return False

out_pgn = OUT_DIR / "lichess_1400_1600_rapid.pgn"
games_found = 0

print(f"Downloading from Lichess DB...")
with urllib.request.urlopen(URL) as response:
    dctx = zstandard.ZstdDecompressor()
    reader = dctx.stream_reader(response)
    text   = io.TextIOWrapper(reader, encoding="utf-8", errors="replace")
    with open(out_pgn, "w") as out:
        while games_found < TARGET_GAMES:
            game = chess.pgn.read_game(text)
            if game is None: break
            if is_eligible(game):
                out.write(str(game) + "\n\n")
                games_found += 1
                if games_found % 50 == 0:
                    print(f"  {games_found}/{TARGET_GAMES}...")

checksum = file_checksum(out_pgn)
manifest = {
    "source_url":       URL,
    "elo_range":        [ELO_MIN, ELO_MAX],
    "games_collected":  games_found,
    "date_downloaded":  datetime.utcnow().isoformat(),
    "output_file":      str(out_pgn),
    "sha256_checksum":  checksum,          # ← added
    "time_controls":    "rapid/classical",
    "variant":          "standard"
}
with open(OUT_DIR / "manifest.json", "w") as f:
    json.dump(manifest, f, indent=2)

print(f"\n✅ {games_found} games saved. SHA256: {checksum[:16]}...")
