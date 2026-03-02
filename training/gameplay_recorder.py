"""
Gameplay Recorder - Passive Learning System
Just play Tower 3D normally, this records everything and learns from your actions
"""
import cv2
import numpy as np
import json
import pyautogui
from pynput import mouse, keyboard
from datetime import datetime
from pathlib import Path
import time
import threading
from queue import Queue

class GameplayRecorder:
    """Records your gameplay to automatically learn UI elements and decision patterns"""
    
    def __init__(self, output_dir="training_data/gameplay_recordings"):
        self.output_dir = Path(output_dir)
        self.output_dir.mkdir(parents=True, exist_ok=True)
        
        # Session info
        self.session_id = datetime.now().strftime("%Y%m%d_%H%M%S")
        self.session_dir = self.output_dir / self.session_id
        self.session_dir.mkdir(exist_ok=True)
        
        # Recording state
        self.recording = False
        self.screenshot_queue = Queue()
        self.events = []
        
        # Click tracking
        self.last_screenshot = None
        self.last_screenshot_time = None
        
        # Stats
        self.click_count = 0
        self.screenshot_count = 0
        self.start_time = None
        
        print(f"✓ Gameplay Recorder initialized")
        print(f"  Session: {self.session_id}")
        print(f"  Output: {self.session_dir}")
    
    def on_click(self, x, y, button, pressed):
        """Record mouse clicks"""
        if not self.recording or not pressed:
            return
        
        timestamp = time.time()
        
        # Capture screenshot BEFORE and AFTER click
        screenshot_before = pyautogui.screenshot()
        screenshot_before = cv2.cvtColor(np.array(screenshot_before), cv2.COLOR_RGB2BGR)
        
        # Record click event
        event = {
            "type": "click",
            "timestamp": timestamp,
            "x": x,
            "y": y,
            "button": str(button),
            "screenshot_before": f"click_{self.click_count}_before.png",
            "screenshot_after": f"click_{self.click_count}_after.png"
        }
        
        # Save before screenshot
        cv2.imwrite(
            str(self.session_dir / event["screenshot_before"]),
            screenshot_before
        )
        
        # Wait a bit for UI to update, then capture after
        time.sleep(0.5)
        screenshot_after = pyautogui.screenshot()
        screenshot_after = cv2.cvtColor(np.array(screenshot_after), cv2.COLOR_RGB2BGR)
        
        cv2.imwrite(
            str(self.session_dir / event["screenshot_after"]),
            screenshot_after
        )
        
        self.events.append(event)
        self.click_count += 1
        
        print(f"  Click #{self.click_count}: ({x}, {y})")
    
    def on_key(self, key):
        """Record keyboard input"""
        if not self.recording:
            return
        
        try:
            key_name = key.char if hasattr(key, 'char') else str(key)
        except:
            key_name = str(key)
        
        event = {
            "type": "keypress",
            "timestamp": time.time(),
            "key": key_name
        }
        
        self.events.append(event)
    
    def capture_periodic_screenshots(self):
        """Capture screenshots every 5 seconds during gameplay"""
        while self.recording:
            screenshot = pyautogui.screenshot()
            screenshot = cv2.cvtColor(np.array(screenshot), cv2.COLOR_RGB2BGR)
            
            filename = f"periodic_{self.screenshot_count:04d}.png"
            cv2.imwrite(str(self.session_dir / filename), screenshot)
            
            event = {
                "type": "screenshot",
                "timestamp": time.time(),
                "filename": filename
            }
            self.events.append(event)
            self.screenshot_count += 1
            
            time.sleep(5)  # Every 5 seconds
    
    def start_recording(self):
        """Start recording gameplay"""
        self.recording = True
        self.start_time = time.time()
        
        print(f"\n{'='*70}")
        print(f"🔴 RECORDING STARTED")
        print(f"{'='*70}")
        print(f"\nJust play Tower 3D normally!")
        print(f"The AI is watching and learning from you.\n")
        print(f"Recording:")
        print(f"  ✓ Every click you make")
        print(f"  ✓ What changed after each click")
        print(f"  ✓ Periodic screenshots (every 5 sec)")
        print(f"  ✓ Keyboard input\n")
        print(f"Press Ctrl+C in terminal when done (or ESC key)\n")
        
        # Start listeners
        self.mouse_listener = mouse.Listener(on_click=self.on_click)
        self.keyboard_listener = keyboard.Listener(on_press=self.on_key)
        
        self.mouse_listener.start()
        self.keyboard_listener.start()
        
        # Start periodic screenshot thread
        self.screenshot_thread = threading.Thread(target=self.capture_periodic_screenshots)
        self.screenshot_thread.daemon = True
        self.screenshot_thread.start()
    
    def stop_recording(self):
        """Stop recording and save session data"""
        self.recording = False
        
        # Stop listeners
        if hasattr(self, 'mouse_listener'):
            self.mouse_listener.stop()
        if hasattr(self, 'keyboard_listener'):
            self.keyboard_listener.stop()
        
        # Calculate session stats
        duration = time.time() - self.start_time if self.start_time else 0
        
        # Save session metadata
        session_data = {
            "session_id": self.session_id,
            "start_time": datetime.fromtimestamp(self.start_time).isoformat() if self.start_time else None,
            "duration_seconds": duration,
            "duration_minutes": duration / 60,
            "total_clicks": self.click_count,
            "total_screenshots": self.screenshot_count,
            "total_events": len(self.events),
            "events": self.events
        }
        
        # Save to JSON
        metadata_file = self.session_dir / "session_metadata.json"
        with open(metadata_file, 'w') as f:
            json.dump(session_data, f, indent=2)
        
        print(f"\n{'='*70}")
        print(f"⏹ RECORDING STOPPED")
        print(f"{'='*70}")
        print(f"\nSession Summary:")
        print(f"  Duration: {duration/60:.1f} minutes")
        print(f"  Clicks recorded: {self.click_count}")
        print(f"  Screenshots: {self.screenshot_count}")
        print(f"  Total events: {len(self.events)}")
        print(f"\nData saved to: {self.session_dir}")
        print(f"Metadata: {metadata_file}\n")
        
        return session_data
    
    def record_session(self, duration_minutes=None):
        """Record a gameplay session"""
        try:
            self.start_recording()
            
            if duration_minutes:
                print(f"Recording for {duration_minutes} minutes...")
                time.sleep(duration_minutes * 60)
                self.stop_recording()
            else:
                print("Recording until you press Ctrl+C...")
                while self.recording:
                    time.sleep(1)
        
        except KeyboardInterrupt:
            print("\n\n⊠ Recording interrupted by user")
            self.stop_recording()
        
        return self.session_dir


def main():
    """Main recording interface"""
    print("\n" + "="*70)
    print("PASSIVE GAMEPLAY RECORDER")
    print("="*70)
    print("\n✨ Just play Tower 3D normally - the AI watches and learns! ✨\n")
    print("What gets recorded:")
    print("  • Every button/element you click (with before/after screenshots)")
    print("  • Periodic game state screenshots (every 5 seconds)")
    print("  • Keyboard input")
    print("  • Timing and sequences\n")
    print("Later, the AI will analyze this to learn:")
    print("  • Where buttons are (from your clicks)")
    print("  • What buttons do (from before/after comparison)")
    print("  • When to take actions (from your timing)")
    print("  • Decision patterns (from sequences)\n")
    
    # Ask for session duration
    print("How long do you want to play?")
    print("  1. Let me decide (manual stop)")
    print("  2. 30 minutes")
    print("  3. 60 minutes")
    print("  4. 90 minutes")
    
    choice = input("\nChoice (1-4): ").strip()
    
    duration_map = {
        "1": None,
        "2": 30,
        "3": 60,
        "4": 90
    }
    
    duration = duration_map.get(choice)
    
    print("\n\nReady to start recording!")
    print("Make sure Tower 3D is ready to play...")
    input("Press Enter to start recording...")
    
    # Start recording
    recorder = GameplayRecorder()
    session_dir = recorder.record_session(duration_minutes=duration)
    
    print(f"\n✓ Session complete!")
    print(f"\nNext step: Analyze this session to extract button knowledge")
    print(f"Run: python training/analyze_gameplay.py {session_dir.name}")


if __name__ == "__main__":
    main()
