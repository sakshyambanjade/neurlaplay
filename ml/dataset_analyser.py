import pandas as pd
import os
import matplotlib.pyplot as plt

def auto_retrain_if_ready(min_samples=200):
    from reasoning_engine import ATCReasoningEngine
    import csv
    csv_path = r"d:\Tower.3D.Pro.v7927862\Tower3D_AI_Bot\imitation_learning_data\human_actions.csv"
    if not os.path.exists(csv_path):
        print("No dataset found for retraining.")
        return False
    with open(csv_path, 'r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        dataset = list(reader)
    if len(dataset) < min_samples:
        print(f"Not enough data yet: {len(dataset)}/{min_samples}")
        return False
    # Prepare dummy state/action objects for ML
    class DummyState:
        def __init__(self, row):
            self.row = row
        def to_vector(self):
            # Example: use numeric fields
            return [int(self.row.get('radar_green_count', 0)), int(self.row.get('radar_pink_count', 0))]
    states = [DummyState(row) for row in dataset]
    actions = [row.get('user_action_content', '') for row in dataset]
    engine = ATCReasoningEngine()
    engine.train_ml(type('Dataset', (), {'states': states, 'actions': actions}))
    print(f"Retrained on {len(dataset)} samples ✓")
    return True

def analyze_session(csv_path):
    print(f"--- ATC Neuro-Dataset Analysis: {csv_path} ---")
    if not os.path.exists(csv_path):
        print("Error: Dataset not found.")
        return

    df = pd.read_csv(csv_path)
    total_actions = len(df)
    
    # 1. Action Breakdown
    action_types = df['event_type'].value_counts()
    print("\n[Action Breakdown]")
    print(action_types)

    # 2. Intent Matching Success
    matches = df['pilot_request'].apply(lambda x: 1 if "[DIRECT]" in str(x) or "[PARTIAL]" in str(x) else 0).sum()
    match_rate = (matches / total_actions) * 100 if total_actions > 0 else 0
    print(f"\n[Intent Matching Confidence]")
    print(f"Direct/Partial Matches: {matches} ({match_rate:.1f}%)")

    # 3. Decision Clustering
    print("\n[Command Frequency]")
    commands = df[df['event_type'] == 'ATC_DECISION']['raw_text'].value_counts().head(5)
    print(commands)

    # 4. Conflicts Logged
    conflicts = df['situation'].apply(lambda x: 1 if "CONFLICT" in str(x) else 0).sum()
    print(f"\n[Safety Metrics]")
    print(f"Dangerous Situations Logged: {conflicts}")

    print("\n--- End of Analysis ---")

if __name__ == "__main__":
    path = r"d:\Tower.3D.Pro.v7927862\Tower3D_AI_Bot\imitation_learning_data\human_actions.csv"
    analyze_session(path)