import json
from datetime import datetime

class HumanFeedbackLogger:
    def __init__(self, log_dir):
        self.log_dir = log_dir

    def log_correction(self, game_state, bot_command, human_command, reason=None):
        log_entry = {
            'timestamp': datetime.now().isoformat(),
            'game_state': game_state,
            'bot_command': bot_command,
            'human_command': human_command,
            'reason': reason
        }
        log_path = f"{self.log_dir}/human_feedback_{datetime.now().date()}.jsonl"
        with open(log_path, 'a', encoding='utf-8') as f:
            f.write(json.dumps(log_entry) + "\n")

# Example usage:
if __name__ == "__main__":
    logger = HumanFeedbackLogger(r"d:\Tower.3D.Pro.v7927862\Tower3D_AI_Bot\training_data")
    # Simulate a correction
    game_state = {'aircraft': ['UAL123'], 'radar_blips': [], 'available_commands': ['TAXI TO GATE']}
    bot_command = "TAXI TO GATE"
    human_command = "HOLD POSITION"
    reason = "Bot missed conflict on taxiway."
    logger.log_correction(game_state, bot_command, human_command, reason)
