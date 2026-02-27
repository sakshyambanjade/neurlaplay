import pyautogui
import time
import random

# Coordinates for the text input bar
# These are ESTIMATES based on a 1366x768 screen. 
# Usually the command bar is in the top header.
COMMAND_BAR_COORDS = (400, 30) 

def send_command(text):
    """
    Simulates a human clicking the command bar and typing a command.
    """
    print(f"Executing Decision: {text}")
    
    # 1. Store current mouse position to return it later (human-like behavior)
    old_x, old_y = pyautogui.position()
    
    # 2. Move to command bar and click
    # Using a slight tween to make it look less 'robotic'
    pyautogui.moveTo(COMMAND_BAR_COORDS[0], COMMAND_BAR_COORDS[1], duration=0.2)
    pyautogui.click()
    
    # 3. Clear existing text (Ctrl+A then Backspace)
    pyautogui.hotkey('ctrl', 'a')
    pyautogui.press('backspace')
    
    # 4. Type the command with realistic variable speed
    for char in text:
        pyautogui.write(char)
        time.sleep(random.uniform(0.01, 0.05)) # Tiny delay between keys
        
    # 5. Hit Enter
    pyautogui.press('enter')
    
    # 6. Move mouse back to where it was
    pyautogui.moveTo(old_x, old_y, duration=0.1)

if __name__ == "__main__":
    print("Action Module Test...")
    print("You have 5 seconds to switch to the game/notepad!")
    time.sleep(5)
    
    # Example command based on your images
    send_command("N765FT RUNWAY 28 CLEARED FOR LOW APPROACH")
