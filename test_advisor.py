#!/usr/bin/env python3
"""
Quick test of advisor mode loading
"""

import sys
import pickle
from pathlib import Path

# Test 1: Check if models directory exists
models_dir = Path("models")
print(f"Models directory: {models_dir}")
print(f"Exists: {models_dir.exists()}")

if models_dir.exists():
    files = list(models_dir.glob("*.pkl"))
    print(f"Found {len(files)} model files:")
    for f in files:
        print(f"  - {f.name}")

# Test 2: Try to load the advisor model
session_id = "20260301_204002"
model_path = models_dir / f"decision_advisor_{session_id}.pkl"

print(f"\nTesting model load from: {model_path}")
print(f"File exists: {model_path.exists()}")

if model_path.exists():
    try:
        with open(model_path, 'rb') as f:
            advisor = pickle.load(f)
        
        print(f"\n✓ Model loaded successfully!")
        print(f"  - Decision rate: {advisor['decision_rate']:.1f} decisions/minute")
        print(f"  - Known sequences: {len(advisor['sequences'])} button combinations")
        print(f"  - Button info: {len(advisor['button_info'])} buttons")
        print(f"\nSample sequences:")
        
        for i, (btn, next_dict) in enumerate(list(advisor['sequences'].items())[:3]):
            print(f"\n  From {btn}:")
            for next_btn, info in sorted(next_dict.items(), 
                                        key=lambda x: x[1]['count'], 
                                        reverse=True)[:3]:
                print(f"    → {next_btn}: {info['count']} times (avg {info['avg_timing']:.1f}s)")
        
    except Exception as e:
        print(f"❌ Failed to load: {e}")
        import traceback
        traceback.print_exc()
else:
    print(f"\n❌ Model file not found!")
    print("Run training first:")
    print(f"  python training/train_decision_advisor.py {session_id}")
