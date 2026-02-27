import cv2
import numpy as np
import mss
import os
import time
from training_logger import TrainingLogger
from radar_tracking import find_aircraft_blips
from strip_reader import read_strips

def run_diagnostics():
    print("=== TOWER!3D PRO AI: PRE-FLIGHT DIAGNOSTICS ===")
    
    # 1. Check Directory Structure
    bot_path = r"d:\Tower.3D.Pro.v7927862\Tower3D_AI_Bot"
    if os.path.exists(bot_path):
        print(f"[SUCCESS] Project directory found: {bot_path}")
    else:
        print(f"[ERROR] Project directory NOT found!")

    # 2. Check Vision & Layout
    with mss.mss() as sct:
        monitor = sct.monitors[1] if len(sct.monitors) > 1 else sct.monitors[0]
        print(f"[INFO] Primary Monitor Detect: {monitor['width']}x{monitor['height']}")
        
        # Test a full capture
        start = time.time()
        sct_img = sct.grab(monitor)
        end = time.time()
        print(f"[SUCCESS] Screen Capture Latency: {int((end-start)*1000)}ms")
        
        img = np.array(sct_img)
        img = cv2.cvtColor(img, cv2.COLOR_BGRA2BGR)
        
        # Check Layout Regions
        layout = {
            "command": {"top": 0, "left": 0, "width": 800, "height": 180},
            "dbrite": {"top": 0, "left": 960, "width": 406, "height": 350},
            "strips": {"top": 360, "left": 960, "width": 406, "height": 408}
        }
        
        for name, r in layout.items():
            crop = img[r['top']:r['top']+r['height'], r['left']:r['left']+r['width']]
            if crop.size > 0:
                print(f"[SUCCESS] Layout Region '{name}' is valid.")
                # Save small samples for user verification
                cv2.imwrite(f"{bot_path}\\test_{name}.jpg", crop)
            else:
                print(f"[ERROR] Layout Region '{name}' is OUT OF BOUNDS!")

    # 3. Check Modules
    try:
        from reasoning_engine import ATCReasoningEngine
        engine = ATCReasoningEngine()
        print(f"[SUCCESS] Reasoning Engine loaded. API Keys detected: {len(engine.keys)}")
    except Exception as e:
        print(f"[ERROR] Reasoning Engine failed to load: {e}")

    # 4. Check Logger
    try:
        logger = TrainingLogger(bot_path)
        print(f"[SUCCESS] Training Logger initialized at {logger.log_dir}")
    except Exception as e:
        print(f"[ERROR] Logger initialization failed: {e}")

    print("\n--- DIAGNOSTICS COMPLETE ---")
    print("If you see all SUCCESS, you are ready to play.")

if __name__ == "__main__":
    run_diagnostics()
