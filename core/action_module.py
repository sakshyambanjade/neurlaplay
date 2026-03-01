import pyautogui
import time
import random


# Coordinates for the text input bar
# Calibrate these using scripts/calibrate.py for your screen!
COMMAND_BAR_COORDS = (400, 30)  # Update after calibration

def send_command(text, retries=3):
    """
    Simulates a human clicking the command bar and typing a command.
    Adds retry logic and error detection.
    """
    import time, random
    for attempt in range(retries):
        try:
            print(f"Executing Decision: {text} (Attempt {attempt+1})")
            if isinstance(text, (list, tuple)):
                text = " ".join(str(t) for t in text)
            old_x, old_y = pyautogui.position()
            pyautogui.moveTo(COMMAND_BAR_COORDS[0], COMMAND_BAR_COORDS[1], duration=0.2)
            pyautogui.click()
            pyautogui.hotkey('ctrl', 'a')
            pyautogui.press('backspace')
            pyautogui.write(text, interval=0.08)
            pyautogui.press('enter')
            pyautogui.moveTo(old_x, old_y, duration=0.1)
            # Replace verification with stub
            if verify_command_sent(text):
                return True
        except Exception as e:
            print(f"Command failed attempt {attempt+1}: {e}")
            time.sleep(1)
    # Safety fallback
    print("Safety fallback: HOLD POSITION")
    return False

    # Removed verify_command_sent_log (was broken and caused recursion)

def verify_command_sent(command):
    """
    Stub for command verification. Replace with actual screen check.
    """
    # TODO: Implement OCR or screen check to verify command was accepted
    return True

if __name__ == "__main__":
    print("Action Module Test...")
    print("You have 5 seconds to switch to the game/notepad!")
    time.sleep(5)
    
    # Example command based on your images
    send_command("N765FT RUNWAY 28 CLEARED FOR LOW APPROACH")