import json
import glob
from collections import Counter

def load_rlhf_logs(log_dir):
    logs = []
    for file in glob.glob(f"{log_dir}/rlhf_*.jsonl"):
        with open(file, 'r', encoding='utf-8') as f:
            for line in f:
                logs.append(json.loads(line))
    return logs

def benchmark_decision_accuracy(logs):
    total = len(logs)
    corrected = sum(1 for log in logs if log.get('human_command') and log['human_command'] != log['bot_command'])
    accepted = total - corrected
    print(f"Total decisions: {total}")
    if total == 0:
        print("No decisions to benchmark.")
        return
    print(f"Accepted by human: {accepted} ({accepted/total*100:.1f}%)")
    print(f"Corrected by human: {corrected} ({corrected/total*100:.1f}%)")
    # Most common corrections
    corrections = Counter(log['human_command'] for log in logs if log.get('human_command'))
    print("Most common corrections:")
    for cmd, count in corrections.most_common(5):
        print(f"  {cmd}: {count}")

def benchmark_latency(log_dir):
    # Example: parse decision_latency from agent_core.py profile logs (if saved)
    # Extend as needed for your logging format
    pass

if __name__ == "__main__":
    log_dir = "training_data"
    logs = load_rlhf_logs(log_dir)
    benchmark_decision_accuracy(logs)
    # Add more benchmarking as needed
