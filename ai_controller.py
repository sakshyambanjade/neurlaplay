import cv2
import numpy as np
import mss
import time
import pytesseract
import re
import os
import threading
from pynput import keyboard, mouse

from radar_tracking import find_aircraft_blips
from strip_reader import read_strips
from training_logger import TrainingLogger
from reasoning_engine import ATCReasoningEngine
from atc_world_model import ATCWorldModel
try:
    from speech_module import ATCAudioObserver
except ImportError:
    ATCAudioObserver = None

# SETTINGS
TESSERACT_PATH = r'C:\Program Files\Tesseract-OCR\tesseract.exe'
pytesseract.pytesseract.tesseract_cmd = TESSERACT_PATH

class TowerNeuroATC:
    def __init__(self):
        self.logger = TrainingLogger(r"d:\Tower.3D.Pro.v7927862\Tower3D_AI_Bot")
        self.brain = ATCReasoningEngine()
        self.world = ATCWorldModel()
        self.audio = ATCAudioObserver() if ATCAudioObserver else None
        if self.audio is not None: 
            self.audio.start()
        self.sct = mss.mss()
        self.monitor = self.sct.monitors[1] if len(self.sct.monitors) > 1 else self.sct.monitors[0]
        self.layout = {
            "command": {"top": 0, "left": 0, "width": 800, "height": 180},
            "dbrite": {"top": 0, "left": 960, "width": 406, "height": 350},
            "strips": {"top": 360, "left": 960, "width": 406, "height": 408},
            "dialog": {"top": 180, "left": 0, "width": 400, "height": 300} # Common area for pilot text
        }

    def run_live_decision_loop(self):
        print("Starting real-time ATC decision loop...")
        while True:
            # 1. Capture command panel
            top_panel_monitor = {
                "top": self.monitor["top"],
                "left": self.monitor["left"],
                "width": self.monitor["width"],
                "height": int(self.monitor["height"] * 0.15)
            }
            sct_img = self.sct.grab(top_panel_monitor)
            img = np.array(sct_img)
            img = cv2.cvtColor(img, cv2.COLOR_BGRA2BGR)
            # 2. Extract available commands (vision)
            from vision_bot import read_text_from_image
            panel_text = read_text_from_image(img)
            # Simple split for demo
            available_commands = [cmd for cmd in self.world.valid_commands if cmd in panel_text]
            # 3. Analyze situation (reasoning)
            state_data = {
                "available_commands": available_commands,
                "situation": panel_text
            }
            decision = self.brain.analyze_situation(state_data)
            # 4. Issue command (action)
            from action_module import send_command
            if decision and decision != "NO DECISION":
                send_command(decision)
            time.sleep(2)
        
        self.last_dialog_text = ""
        self.current_full_frame = None
        self.is_running = True
        self.discovered_runways = set()
        self.event_sequence = [] # Tracks [Trigger -> Observation -> Action]

    def get_current_state(self):
        if self.current_full_frame is None: return None
        full_bgr = self.current_full_frame 
        
        # Crop DBRITE for radar analysis
        dbrite_img = full_bgr[self.layout["dbrite"]["top"]:self.layout["dbrite"]["top"]+self.layout["dbrite"]["height"], 
                             self.layout["dbrite"]["left"]:self.layout["dbrite"]["left"]+self.layout["dbrite"]["width"]]
        
        # Crop Command Bar for OCR
        cmd_img = full_bgr[self.layout["command"]["top"]:self.layout["command"]["top"]+self.layout["command"]["height"], 
                           self.layout["command"]["left"]:self.layout["command"]["left"]+self.layout["command"]["width"]]
        
        gray_cmd = cv2.cvtColor(cmd_img, cv2.COLOR_BGR2GRAY)
        _, thresh_cmd = cv2.threshold(gray_cmd, 150, 255, cv2.THRESH_BINARY)
        raw_text = pytesseract.image_to_string(thresh_cmd).strip().upper()
        
        blips, _, _ = find_aircraft_blips(dbrite_img)
        callsign_match = re.search(r'[A-Z]{2,4}\d{1,4}', raw_text)
        
        # Pilot Dialog (Speech Fallback via OCR)
        dialog_img = full_bgr[self.layout["dialog"]["top"]:self.layout["dialog"]["top"]+self.layout["dialog"]["height"], 
                              self.layout["dialog"]["left"]:self.layout["dialog"]["left"]+self.layout["dialog"]["width"]]
        gray_dialog = cv2.cvtColor(dialog_img, cv2.COLOR_BGR2GRAY)
        dialog_text = pytesseract.image_to_string(gray_dialog).strip()
        if len(dialog_text) > 5:
            self.last_dialog_text = dialog_text

        # Get Situation from World Model
        situation = self.world.get_situation_summary(blips)
        
        # Disambiguate Intent: Match selected callsign to recent audio history
        recent_requests = self.audio.get_recent_intents(window_seconds=20) if self.audio is not None else []
        matched_intent = self.world.match_intent(callsign_match.group(0) if callsign_match else "NONE", recent_requests)
        
        return {
            "frame": full_bgr,
            "callsign": callsign_match.group(0) if callsign_match else "NONE",
            "raw_text": raw_text,
            "blips": blips,
            "situation": situation,
            "pilot_request": matched_intent 
        }

    def on_press(self, key):
        if key == keyboard.Key.enter:
            state = self.get_current_state()
            if state:
                # Disambiguated Dataset Logging
                enriched_state = state.copy()
                # Clean the command bar text (fix OCR typos)
                enriched_state['raw_text'] = self.world.clean_command(state['raw_text'])
                
                print(f"Decision: {state['callsign']} | Trig: {state['pilot_request']}")
                reasoning = self.brain.analyze_situation(enriched_state)
                self.logger.log_event(state["frame"], enriched_state, "ATC_DECISION", reasoning)
                self.event_sequence = [] # Reset sequence after command

    def on_click(self, x, y, button, pressed):
        if pressed:
            state = self.get_current_state()
            if state:
                self.event_sequence.append(f"CLICK({x},{y})")
                self.logger.log_event(state["frame"], state, "ATC_UI_CLICK", f"({x}, {y})")

    def run(self, hud_mode=True):
        print("=== NEURO-ATC V3: SENSOR FUSION ACTIVE ===")
        print("Monitoring: Multi-Radar, Strips, Occupancy, and Human Intent.")
        
        k_listener = keyboard.Listener(on_press=self.on_press)
        m_listener = mouse.Listener(on_click=self.on_click)
        k_listener.start()
        m_listener.start()

        if hud_mode:
            cv2.namedWindow('ATC HUD', cv2.WINDOW_NORMAL)
            cv2.resizeWindow('ATC HUD', 300, 100)
            try: cv2.setWindowProperty('ATC HUD', cv2.WND_PROP_TOPMOST, 1)
            except: pass

        try:
            while self.is_running:
                sct_img = self.sct.grab(self.monitor)
                self.current_full_frame = cv2.cvtColor(np.array(sct_img), cv2.COLOR_BGRA2BGR)
                
                if hud_mode:
                    hud = np.zeros((100, 300, 3), dtype=np.uint8)
                    hud[:] = (25, 25, 35) # ATC Navy Theme
                    
                    state = self.get_current_state()
                    callsign = state["callsign"] if state else "WAITING..."
                    sit_short = (state['situation'].split('\n')[0]) if state else "Scanning..."
                    
                    cv2.putText(hud, f"ATC-CORE: {callsign}", (10, 25), 1, 1.0, (0, 255, 0), 2)
                    cv2.putText(hud, f"{sit_short}", (10, 50), 1, 0.8, (200, 200, 200), 1)
                    
                    # Safe sequence rendering
                    seq_text = "->".join(str(s) for s in self.event_sequence[-2:])
                    cv2.putText(hud, f"Seq: {seq_text}", (10, 80), 1, 0.7, (150, 150, 150), 1)
                    cv2.imshow('ATC HUD', hud)
                
                if cv2.waitKey(200) & 0xFF == ord('q'):
                    self.is_running = False
                    break
                
                del sct_img
                time.sleep(0.05)

        except Exception as e:
            print(f"Runtime Error: {e}")
        finally:
            self.is_running = False
            k_listener.stop()
            m_listener.stop()
            cv2.destroyAllWindows()

if __name__ == "__main__":
    agent = TowerNeuroATC()
    agent.run(hud_mode=True)
