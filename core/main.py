
import time
import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from vision.vision_bot import VisionBot
from core.atc_world_model import ATCWorldModel
from core.reasoning_engine import ATCReasoningEngine
from core.action_module import send_command
from utils.training_logger import TrainingLogger


def run_agent():

    vision = VisionBot()
    # Load schedule callsigns for smarter aircraft identification
    schedule_path = r"d:\Tower.3D.Pro.v7927862\Tower.3D.Pro.v7927862\Extensions\Airfields\KJFK\kjfk_schedule.txt"
    vision.load_schedule_callsigns(schedule_path)
    world_model = ATCWorldModel()
    reasoning = ATCReasoningEngine()
    logger = TrainingLogger(r"d:\Tower.3D.Pro.v7927862\Tower3D_AI_Bot")
    last_command = None
    last_action_time = 0

    print("Agent running... press Ctrl+C to stop")

    templates = {}
    try:
        while True:
            # 1. SEE the game
            screenshot = vision.capture_region('command_panel')
            available_commands = vision.get_available_commands(templates=templates)
            aircraft = vision.get_active_aircraft()
            radar_blips = vision.detect_radar_blips()
            if len(available_commands) == 0:
                print("Can't see game clearly, waiting...")
                time.sleep(2)
                continue
            game_state = {
                'available_commands': available_commands,
                'aircraft': aircraft,
                'radar_blips': radar_blips,
                # Add more state fields as needed (e.g., strips, wind, etc.)
            }
            world_model.update(game_state)

            # 2. UPDATE understanding (optional: pass radar_blips for richer state)
            # state = world_model.to_vector(radar_blips)

            # 3. DECIDE what to do
            command = reasoning.decide(game_state)

            # 4. ACT in game
            if command:
                if (
                    command == last_command and
                    time.time() - last_action_time < 5
                ):
                    print("Cooldown: skipping repeated command.")
                else:
                    send_command(command)
                    last_command = command
                    last_action_time = time.time()

            # 5. LOG everything
            logger.log_event(
                screenshot, game_state, 'DECISION', command, outcome=None
            )

            # 6. Small delay so you don't spam the game
            time.sleep(1.2)

    except KeyboardInterrupt:
        print("Quitting agent...")
    except Exception as exc:
        print(f"Loop error: {exc}")
        send_command("HOLD POSITION")  # safety fallback
        time.sleep(2)


if __name__ == "__main__":
    run_agent()