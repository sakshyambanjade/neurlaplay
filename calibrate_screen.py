#!/usr/bin/env python3
"""
Screen Region Calibrator for Tower 3D
Helps identify where flight strips, radar, and command bar are located.
"""

import pyautogui
import cv2
import numpy as np
from pathlib import Path
import time

def capture_full_screen():
    """Capture the entire screen."""
    screenshot = pyautogui.screenshot()
    return cv2.cvtColor(np.array(screenshot), cv2.COLOR_RGB2BGR)

def save_annotated_screenshot(img, regions, filename="screen_regions.png"):
    """Save screenshot with regions marked."""
    annotated = img.copy()
    
    colors = {
        'flight_strip_panel': (0, 255, 0),    # Green
        'radar_screen': (255, 0, 0),          # Blue
        'message_log': (0, 255, 255),         # Yellow
        'command_bar': (255, 0, 255),         # Magenta
    }
    
    for region_name, coords in regions.items():
        x1, y1, x2, y2 = coords
        color = colors.get(region_name, (255, 255, 255))
        
        # Draw rectangle
        cv2.rectangle(annotated, (x1, y1), (x2, y2), color, 3)
        
        # Add label
        label = region_name.replace('_', ' ').title()
        cv2.putText(annotated, label, (x1, y1-10), 
                    cv2.FONT_HERSHEY_SIMPLEX, 0.7, color, 2)
    
    cv2.imwrite(filename, annotated)
    print(f"\n✓ Saved annotated screenshot to: {filename}")

def interactive_calibration():
    """Interactive calibration - click to define regions."""
    print("\n" + "="*80)
    print("TOWER 3D SCREEN CALIBRATION")
    print("="*80)
    print("\nThis will help identify where Tower 3D UI elements are on your screen.")
    print("\nINSTRUCTIONS:")
    print("1. Start Tower 3D Pro and load a session")
    print("2. Position the window so all UI elements are visible")
    print("3. Press Enter when ready...")
    
    input()
    
    print("\nCapturing screen in 3 seconds...")
    print("(Switch to Tower 3D window now!)")
    time.sleep(3)
    
    # Capture screen
    screenshot = capture_full_screen()
    height, width = screenshot.shape[:2]
    
    print(f"\n✓ Screen captured: {width}x{height}")
    
    # Get mouse position for reference
    x, y = pyautogui.position()
    print(f"Current mouse position: ({x}, {y})")
    
    print("\n" + "="*80)
    print("CALIBRATION GUIDE")
    print("="*80)
    
    print("\nMove your mouse to each area and note the coordinates:")
    print("(Position shows in real-time below)")
    print("\nPress Ctrl+C when done noting coordinates\n")
    
    try:
        while True:
            x, y = pyautogui.position()
            print(f"\rMouse: ({x:4d}, {y:4d})    ", end='', flush=True)
            time.sleep(0.1)
    except KeyboardInterrupt:
        print("\n")
    
    # Sample regions (you'll need to adjust these)
    print("\n" + "="*80)
    print("SUGGESTED REGIONS (adjust based on your screen)")
    print("="*80)
    
    # For typical 1920x1080 Tower 3D layout
    regions = {
        'flight_strip_panel': [50, 100, 400, 900],      # Left side
        'radar_screen': [450, 100, 1400, 900],          # Center
        'message_log': [50, 920, 1400, 1000],           # Bottom
        'command_bar': [50, 1010, 800, 1060],           # Bottom command input
    }
    
    print("\nEdit config.yaml with these coordinates:")
    print("\nvision:")
    print("  screen_regions:")
    for name, coords in regions.items():
        x1, y1, x2, y2 = coords
        print(f"    {name}: [{x1}, {y1}, {x2}, {y2}]")
    
    # Save screenshot with regions marked
    save_annotated_screenshot(screenshot, regions)
    
    # Save individual region captures for inspection
    captures_dir = Path("screen_captures")
    captures_dir.mkdir(exist_ok=True)
    
    print(f"\n✓ Saving individual region captures to {captures_dir}/")
    
    for name, coords in regions.items():
        x1, y1, x2, y2 = coords
        
        # Ensure coordinates are within screen bounds
        x1 = max(0, min(x1, width))
        x2 = max(0, min(x2, width))
        y1 = max(0, min(y1, height))
        y2 = max(0, min(y2, height))
        
        if x2 > x1 and y2 > y1:
            region_img = screenshot[y1:y2, x1:x2]
            cv2.imwrite(str(captures_dir / f"{name}.png"), region_img)
            print(f"  - {name}.png ({x2-x1}x{y2-y1})")
    
    print("\n" + "="*80)
    print("NEXT STEPS")
    print("="*80)
    print("\n1. Open screen_regions.png to see marked regions")
    print("2. Check screen_captures/ folder to see each region close-up")
    print("3. Adjust coordinates in config.yaml if needed")
    print("4. Test vision with: python intelligent_atc_bot.py --mode demo")

def auto_detect_regions():
    """Try to automatically detect Tower 3D UI regions."""
    print("\n" + "="*80)
    print("AUTO-DETECTING TOWER 3D UI REGIONS")
    print("="*80)
    
    print("\nCapturing screen in 3 seconds...")
    time.sleep(3)
    
    screenshot = capture_full_screen()
    height, width = screenshot.shape[:2]
    
    print(f"✓ Screen captured: {width}x{height}")
    
    # Convert to grayscale
    gray = cv2.cvtColor(screenshot, cv2.COLOR_BGR2GRAY)
    
    # Try to find UI elements by edge detection
    edges = cv2.Canny(gray, 50, 150)
    
    # Find contours
    contours, _ = cv2.findContours(edges, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    
    print(f"\nFound {len(contours)} potential UI regions")
    
    # Filter contours by size
    large_regions = []
    for contour in contours:
        x, y, w, h = cv2.boundingRect(contour)
        area = w * h
        
        # Look for large regions (likely UI panels)
        if area > 50000 and w > 200 and h > 200:
            large_regions.append((x, y, w, h))
    
    print(f"Found {len(large_regions)} large UI regions")
    
    # Save detected regions
    detected = screenshot.copy()
    for i, (x, y, w, h) in enumerate(large_regions):
        cv2.rectangle(detected, (x, y), (x+w, y+h), (0, 255, 0), 2)
        cv2.putText(detected, f"Region {i+1}", (x, y-10),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 255, 0), 2)
    
    cv2.imwrite("detected_regions.png", detected)
    print(f"\n✓ Saved to: detected_regions.png")
    
    # Return suggested regions based on typical Tower 3D layout
    return {
        'flight_strip_panel': [50, 100, 400, 900],
        'radar_screen': [450, 100, 1400, 900],
        'message_log': [50, 920, 1400, 1000],
        'command_bar': [50, 1010, 800, 1060],
    }

def main():
    """Main calibration tool."""
    import argparse
    
    parser = argparse.ArgumentParser(description="Calibrate Tower 3D screen regions")
    parser.add_argument(
        "--mode",
        choices=["interactive", "auto"],
        default="interactive",
        help="interactive: Manual positioning | auto: Auto-detect"
    )
    
    args = parser.parse_args()
    
    print("\n⚠ Make sure Tower 3D Pro is running and visible!")
    print("⚠ Close any overlapping windows")
    
    if args.mode == "interactive":
        interactive_calibration()
    else:
        regions = auto_detect_regions()
        print("\nSuggested regions:")
        for name, coords in regions.items():
            print(f"  {name}: {coords}")

if __name__ == "__main__":
    main()
