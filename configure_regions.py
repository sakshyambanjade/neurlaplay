#!/usr/bin/env python3
"""
Visual Region Configuration Tool for Tower 3D
Click and drag to define where UI elements are located.
"""

import cv2
import pyautogui
import numpy as np
import yaml
from pathlib import Path

# Global variables for mouse interaction
drawing = False
start_point = None
current_region_name = None
regions = {}

region_order = [
    'flight_strip_panel',
    'radar_screen', 
    'message_log',
    'command_bar'
]

region_descriptions = {
    'flight_strip_panel': 'LEFT panel with departure/arrival strips',
    'radar_screen': 'CENTER radar display with aircraft',
    'message_log': 'BOTTOM communication/message log',
    'command_bar': 'BOTTOM text input where you type commands'
}

current_index = 0
screenshot = None

def mouse_callback(event, x, y, flags, param):
    """Handle mouse events for drawing rectangles."""
    global drawing, start_point, regions, screenshot, current_region_name
    
    if event == cv2.EVENT_LBUTTONDOWN:
        drawing = True
        start_point = (x, y)
    
    elif event == cv2.EVENT_MOUSEMOVE:
        if drawing:
            # Show preview rectangle
            temp_img = screenshot.copy()
            cv2.rectangle(temp_img, start_point, (x, y), (0, 255, 0), 2)
            cv2.imshow('Configure Regions', temp_img)
    
    elif event == cv2.EVENT_LBUTTONUP:
        drawing = False
        end_point = (x, y)
        
        # Store region
        x1, y1 = start_point
        x2, y2 = end_point
        
        # Ensure x1 < x2 and y1 < y2
        x1, x2 = min(x1, x2), max(x1, x2)
        y1, y2 = min(y1, y2), max(y1, y2)
        
        regions[current_region_name] = [x1, y1, x2, y2]
        
        print(f"\n✓ {current_region_name}: [{x1}, {y1}, {x2}, {y2}]")
        print(f"  Size: {x2-x1}x{y2-y1}")

def configure_regions_interactive():
    """Interactive region configuration with visual feedback."""
    global screenshot, current_region_name, current_index, regions
    
    print("\n" + "="*80)
    print("TOWER 3D VISUAL REGION CONFIGURATION")
    print("="*80)
    
    # Load existing config
    config_path = Path(__file__).parent / "config.yaml"
    if config_path.exists():
        with open(config_path) as f:
            config = yaml.safe_load(f)
            if 'vision' in config and 'screen_regions' in config['vision']:
                regions = config['vision']['screen_regions'].copy()
                print("\n✓ Loaded existing regions from config.yaml")
    
    print("\nINSTRUCTIONS:")
    print("1. Switch to Tower 3D and load a session with aircraft")
    print("2. Press ENTER to capture the screen")
    print("3. Click and drag to define each region")
    print("4. Press SPACE to confirm and move to next region")
    print("5. Press 's' to save regions to config.yaml")
    print("6. Press 'q' to quit without saving")
    
    input("\nPress ENTER to start...")
    
    # Capture screen
    print("\nCapturing in 3 seconds... (Switch to Tower 3D!)")
    import time
    time.sleep(3)
    
    screenshot_pil = pyautogui.screenshot()
    screenshot = cv2.cvtColor(np.array(screenshot_pil), cv2.COLOR_RGB2BGR)
    height, width = screenshot.shape[:2]
    
    print(f"✓ Screen captured: {width}x{height}")
    
    # Create window
    cv2.namedWindow('Configure Regions', cv2.WINDOW_NORMAL)
    cv2.resizeWindow('Configure Regions', 1200, 800)
    cv2.setMouseCallback('Configure Regions', mouse_callback)
    
    print("\n" + "="*80)
    print("DEFINE REGIONS")
    print("="*80)
    
    # Guide user through each region
    for idx, region_name in enumerate(region_order):
        current_index = idx
        current_region_name = region_name
        
        print(f"\n[{idx+1}/4] Define: {region_name.upper()}")
        print(f"    → {region_descriptions[region_name]}")
        print("\n    Click and drag on the image to mark this region")
        print("    Press SPACE when done, or 'r' to redraw")
        
        while True:
            # Show current image with all defined regions
            display = screenshot.copy()
            
            # Draw previously defined regions in blue
            for name, coords in regions.items():
                if name != current_region_name and coords:
                    x1, y1, x2, y2 = coords
                    cv2.rectangle(display, (x1, y1), (x2, y2), (255, 0, 0), 2)
                    cv2.putText(display, name, (x1, y1-10),
                               cv2.FONT_HERSHEY_SIMPLEX, 0.5, (255, 0, 0), 1)
            
            # Draw current region in green
            if current_region_name in regions and regions[current_region_name]:
                x1, y1, x2, y2 = regions[current_region_name]
                cv2.rectangle(display, (x1, y1), (x2, y2), (0, 255, 0), 3)
                cv2.putText(display, current_region_name + " (current)", (x1, y1-10),
                           cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 255, 0), 2)
            
            # Add instructions overlay
            instructions = [
                f"Defining: {current_region_name.upper()} ({idx+1}/4)",
                region_descriptions[region_name],
                "",
                "SPACE = Next region | R = Redraw | S = Save | Q = Quit"
            ]
            
            y_offset = 30
            for line in instructions:
                cv2.putText(display, line, (10, y_offset),
                           cv2.FONT_HERSHEY_SIMPLEX, 0.6, (255, 255, 255), 2)
                cv2.putText(display, line, (10, y_offset),
                           cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 0, 0), 1)
                y_offset += 25
            
            cv2.imshow('Configure Regions', display)
            
            key = cv2.waitKey(100) & 0xFF
            
            if key == ord(' '):  # Space - next region
                if current_region_name in regions and regions[current_region_name]:
                    break
                else:
                    print("    ⚠ Please draw the region first!")
            
            elif key == ord('r'):  # Redraw
                if current_region_name in regions:
                    del regions[current_region_name]
                print(f"    ↺ Redraw {current_region_name}")
            
            elif key == ord('s'):  # Save
                save_to_config()
                return
            
            elif key == ord('q'):  # Quit
                print("\n✗ Cancelled without saving")
                cv2.destroyAllWindows()
                return
    
    # All regions defined
    print("\n" + "="*80)
    print("✓ ALL REGIONS DEFINED")
    print("="*80)
    
    # Show final result
    display = screenshot.copy()
    colors = [(0, 255, 0), (255, 0, 0), (0, 255, 255), (255, 0, 255)]
    
    for idx, (name, coords) in enumerate(regions.items()):
        x1, y1, x2, y2 = coords
        color = colors[idx % len(colors)]
        cv2.rectangle(display, (x1, y1), (x2, y2), color, 2)
        cv2.putText(display, name, (x1, y1-10),
                   cv2.FONT_HERSHEY_SIMPLEX, 0.5, color, 2)
    
    cv2.imshow('Configure Regions', display)
    
    print("\nRegions defined:")
    for name, coords in regions.items():
        x1, y1, x2, y2 = coords
        print(f"  {name}: [{x1}, {y1}, {x2}, {y2}]  (size: {x2-x1}x{y2-y1})")
    
    print("\nPress 's' to SAVE to config.yaml, or 'q' to quit without saving")
    
    while True:
        key = cv2.waitKey(100) & 0xFF
        if key == ord('s'):
            save_to_config()
            break
        elif key == ord('q'):
            print("\n✗ Cancelled without saving")
            break
    
    cv2.destroyAllWindows()

def save_to_config():
    """Save regions to config.yaml."""
    global regions
    
    config_path = Path(__file__).parent / "config.yaml"
    
    # Load existing config or create new
    if config_path.exists():
        with open(config_path) as f:
            config = yaml.safe_load(f) or {}
    else:
        config = {}
    
    # Update vision regions
    if 'vision' not in config:
        config['vision'] = {}
    
    config['vision']['screen_regions'] = regions
    
    # Save
    with open(config_path, 'w') as f:
        yaml.dump(config, f, default_flow_style=False, sort_keys=False)
    
    print(f"\n✓ Saved to {config_path}")
    print("\nNext step: Test vision with:")
    print("  python intelligent_atc_bot.py --mode demo")

def main():
    """Run the configuration tool."""
    try:
        configure_regions_interactive()
    except KeyboardInterrupt:
        print("\n\n✗ Cancelled")
    except Exception as e:
        print(f"\n✗ Error: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    main()
