import json
import os
import time
import cv2
import csv

class TrainingLogger:
    def __init__(self, base_path):
        self.base_path = base_path
        self.log_dir = os.path.join(base_path, "imitation_learning_data")
        self.img_dir = os.path.join(self.log_dir, "snapshots")
        
        os.makedirs(self.img_dir, exist_ok=True)
        
        self.csv_file = os.path.join(self.log_dir, "human_actions.csv")
        self.headers = [
            "timestamp", 
            "screenshot", 
            "active_callsign", 
            "raw_ocr", 
            "radar_green_count", 
            "radar_pink_count", 
            "strip_callsigns", 
            "user_action_type", # e.g., 'KEYBOARD_ENTER' or 'MOUSE_CLICK'
            "user_action_content" # The actual command typed or click coords
        ]
        
        if not os.path.exists(self.csv_file):
            with open(self.csv_file, 'w', newline='') as f:
                writer = csv.writer(f)
                writer.writerow(self.headers)

    def log_event(self, screenshot, state_data, action_type, action_content):
        """
        Logs a specific event triggered by a human action.
        """
        timestamp = int(time.time() * 1000) # millisecond precision
        filename = f"event_{timestamp}.jpg"
        filepath = os.path.join(self.img_dir, filename)
        
        # Save the game state image at the moment of the action
        cv2.imwrite(filepath, screenshot)
        
        # Format radar blips for CSV
        green_count = len([b for b in state_data.get("blips", []) if b.get("color") == "green"])
        pink_count = len([b for b in state_data.get("blips", []) if b.get("color") == "pink"])
        
        # Log data
        with open(self.csv_file, 'a', newline='') as f:
            writer = csv.writer(f)
            writer.writerow([
                timestamp,
                filename,
                state_data.get("callsign", "NONE"),
                state_data.get("raw_text", ""),
                green_count,
                pink_count,
                state_data.get("strip_callsigns", []),
                action_type,
                action_content
            ])
        
        print(f"Captured Human Action: {action_type} -> {action_content}")

if __name__ == "__main__":
    logger = TrainingLogger(r"d:\Tower.3D.Pro.v7927862\Tower3D_AI_Bot")
    print("Imitation Learning Logger initialized.")
