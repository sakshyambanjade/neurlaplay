import threading
import queue
import time
from vision_bot import VisionBot
from atc_world_model import ATCWorldModel
from reasoning_engine import ATCReasoningEngine
from action_module import send_command
from training_logger import TrainingLogger

class ATCAgentCore:
                def log_for_rlhf(self, game_state, bot_command, human_command=None, outcome=None):
                    import json
                    from datetime import datetime
                    log_entry = {
                        'timestamp': datetime.now().isoformat(),
                        'game_state': game_state,
                        'bot_command': bot_command,
                        'human_command': human_command,
                        'outcome': outcome
                    }
                    log_path = f"training_data/rlhf_{datetime.now().date()}.jsonl"
                    with open(log_path, 'a', encoding='utf-8') as f:
                        f.write(json.dumps(log_entry) + "\n")
            def profile(self, label):
                import time
                if not hasattr(self, '_profile_times'):
                    self._profile_times = {}
                now = time.time()
                last = self._profile_times.get(label, now)
                elapsed = now - last
                self._profile_times[label] = now
                print(f"[PROFILE] {label}: {elapsed:.3f}s elapsed")
        def llm_fallback(self, game_state):
            """
            Use LLM (Groq/meta-llama) for fallback reasoning in ambiguous cases.
            Returns a validated command or None.
            """
            # Use the reasoning engine's Groq integration
            llm_response = self.reasoning.query_groq_llm(game_state)
            # Try to extract a valid command from LLM response
            available_commands = game_state.get('available_commands', [])
            for cmd in available_commands:
                if cmd in llm_response:
                    return cmd
            return None
    def __init__(self, schedule_path, log_path):
        self.vision = VisionBot()
        self.vision.load_schedule_callsigns(schedule_path)
        self.world_model = ATCWorldModel()
        self.reasoning = ATCReasoningEngine()
        self.logger = TrainingLogger(log_path)
        from human_feedback_logger import HumanFeedbackLogger
        self.human_feedback_logger = HumanFeedbackLogger(log_path)
        self.frame_queue = queue.Queue(maxsize=20)
        self.state_queue = queue.Queue(maxsize=20)
        self.running = True
        self.last_command = None
        self.last_action_time = 0

    def capture_thread(self):
        while self.running:
            try:
                self.profile('capture_thread')
                cmd_img = self.vision.capture_region('command_panel')
                radar_blips = self.vision.detect_radar_blips()
                aircraft = self.vision.get_active_aircraft()
                available_commands = self.vision.get_available_commands()
                game_state = {
                    'available_commands': available_commands,
                    'aircraft': aircraft,
                    'radar_blips': radar_blips,
                    # Add more state fields as needed
                }
                try:
                    self.frame_queue.put((cmd_img, game_state), timeout=0.5)
                except queue.Full:
                    print("[WARN] Frame queue full, dropping frame.")
                time.sleep(0.5)  # Increase frame rate to ~2fps if hardware allows
            except Exception as e:
                print(f"[ERROR] Capture thread: {e}")

    def processing_thread(self):
        while self.running:
            try:
                self.profile('processing_thread')
                cmd_img, game_state = self.frame_queue.get(timeout=2)
                self.world_model.update(game_state)
                try:
                    self.state_queue.put((cmd_img, game_state), timeout=0.5)
                except queue.Full:
                    print("[WARN] State queue full, dropping state.")
            except queue.Empty:
                continue
            except Exception as e:
                print(f"[ERROR] Processing thread: {e}")

    def decision_thread(self):
                        # RLHF structured logging
                        self.log_for_rlhf(game_state, command, human_command if human_command else None)
        while self.running:
            try:
                self.profile('decision_thread')
                cmd_img, game_state = self.state_queue.get(timeout=2)
                command = self.reasoning.decide(game_state)
                # If rule-based logic fails, use LLM fallback
                if not command or not self.validate_command(command, game_state):
                    print("Rule engine uncertain, using LLM fallback...")
                    command = self.llm_fallback(game_state)
                # Safety/validation layer
                if command and self.validate_command(command, game_state):
                    if (
                        command == self.last_command and
                        time.time() - self.last_action_time < 5
                    ):
                        print("Cooldown: skipping repeated command.")
                    else:
                        send_command(command)
                        self.last_command = command
                        self.last_action_time = time.time()
                self.logger.log_event(cmd_img, game_state, 'DECISION', command, outcome=None)

                # Human-in-the-loop feedback (manual correction prompt)
                print(f"Bot command: {command}")
                human_command = input("If you would issue a different command, enter it (or press Enter to accept): ")
                if human_command and human_command != command:
                    reason = input("Reason for correction: ")
                    self.human_feedback_logger.log_correction(game_state, command, human_command, reason)

                # Benchmarking hook: log decision latency
                self.profile('decision_latency')
            except queue.Empty:
                continue
            except Exception as e:
                print(f"[ERROR] Decision thread: {e}")

    def validate_command(self, command, game_state):
        # Enhanced validation: ensure command is in available_commands, is a non-empty string, and matches expected format
        available = game_state.get('available_commands', [])
        if not command or not isinstance(command, str):
            print(f"[SAFETY] Invalid command type: {command}")
            return False
        if command not in available:
            print(f"[SAFETY] Command not in available_commands: {command}")
            return False
        # Example: check for required fields (expand as needed)
        # if 'callsign' in game_state and not game_state['callsign']:
        #     print(f"[SAFETY] Missing callsign for command: {command}")
        #     return False
        # Add more domain-specific checks here
        return True

    def run(self):
        threads = [
            threading.Thread(target=self.capture_thread),
            threading.Thread(target=self.processing_thread),
            threading.Thread(target=self.decision_thread)
        ]
        for t in threads:
            t.start()
        try:
            while self.running:
                time.sleep(1)
        except KeyboardInterrupt:
            self.running = False
            print("Agent stopped.")
        for t in threads:
            t.join()

if __name__ == "__main__":
    schedule_path = r"d:\Tower.3D.Pro.v7927862\Tower.3D.Pro.v7927862\Extensions\Airfields\KJFK\kjfk_schedule.txt"
    log_path = r"d:\Tower.3D.Pro.v7927862\Tower3D_AI_Bot"
    agent = ATCAgentCore(schedule_path, log_path)
    agent.run()
