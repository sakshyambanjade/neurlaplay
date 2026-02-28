# training_logger.py
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
			"situation",
			"pilot_request",
			"user_action_type", 
			"user_action_content",
			"outcome"
		]
        
		if not os.path.exists(self.csv_file):
			with open(self.csv_file, 'w', newline='') as f:
				writer = csv.writer(f)
				writer.writerow(self.headers)

	def log_event(self, screenshot, state_data, action_type, action_content, outcome=None):
		timestamp = int(time.time() * 1000)
		# Log outcome and timestamp
		entry = {
			"timestamp": timestamp,
			"action": action_content,
			"outcome": outcome,
			"state": state_data,
		}
		# Optionally log to a JSONL file
		with open(os.path.join(self.log_dir, "agent_actions.jsonl"), 'a', encoding='utf-8') as f:
			f.write(json.dumps(entry) + '\n')
		timestamp = int(time.time() * 1000)
		filename = f"event_{timestamp}.jpg"
		filepath = os.path.join(self.img_dir, filename)
        
		cv2.imwrite(filepath, screenshot)
        
		green_count = len([b for b in state_data.get("blips", []) if b.get("color") == "green"])
		pink_count = len([b for b in state_data.get("blips", []) if b.get("color") == "pink"])
        
		# Clean text data to prevent CSV breakages
		def clean(txt):
			if not txt: return ""
			return str(txt).replace("\n", " | ").replace(",", ";").replace('"', "'")

		with open(self.csv_file, 'a', newline='', encoding='utf-8') as f:
			writer = csv.writer(f)
			writer.writerow([
				timestamp,
				filename,
				state_data.get("callsign", "NONE"),
				clean(state_data.get("raw_text", "")),
				green_count,
				pink_count,
				state_data.get("strip_callsigns", []),
				clean(state_data.get("situation", "")),
				clean(state_data.get("pilot_request", "")),
				action_type,
				clean(action_content),
				outcome if outcome is not None else ""
			])
        
		print(f"Captured Human Action: {action_type} -> {action_content}")

if __name__ == "__main__":
	logger = TrainingLogger(r"d:\Tower.3D.Pro.v7927862\Tower3D_AI_Bot")
	print("Imitation Learning Logger initialized.")
