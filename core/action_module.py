import pyautogui
import time
import random

# Coordinates for the text input bar
# These are ESTIMATES based on a 1366x768 screen. 
# Usually the command bar is in the top header.
COMMAND_BAR_COORDS = (400, 30) 

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
            # Ensure command panel focus
            pyautogui.moveTo(COMMAND_BAR_COORDS[0], COMMAND_BAR_COORDS[1], duration=0.2)
            pyautogui.click()
            pyautogui.hotkey('ctrl', 'a')
            pyautogui.press('backspace')
            pyautogui.write(text, interval=0.08)  # Simulate human typing
            pyautogui.press('enter')
            pyautogui.moveTo(old_x, old_y, duration=0.1)
            # Verify command acceptance via log
            if verify_command_sent_log(text):
                return True
        except Exception as e:
            print(f"Command failed attempt {attempt+1}: {e}")
            time.sleep(1)
    # Safety fallback
    send_command("HOLD POSITION", retries=1)
    return False

def verify_command_sent_log(command):
    # Check output_log.txt for command confirmation
    log_path = r"d:\Tower.3D.Pro.v7927862\Tower.3D.Pro.v7927862\output_log.txt"
    try:
        with open(log_path, 'r', encoding='utf-8') as f:
            lines = f.readlines()[-20:]
        for line in lines:
            if command in line and ("CLEARED" in line or "SUCCESS" in line):
                return True
    except Exception:
        pass
    return False

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