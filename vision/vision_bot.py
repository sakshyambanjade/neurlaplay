import easyocr
import pyautogui
import cv2
import os
import yaml
import numpy as np
import time
import torch
 # Removed broken import
 # Removed unused import mss
 # Fix: If read_text_from_image is not available, comment out or provide fallback

class VisionBot:
    def __init__(self):
        # Auto-detect GPU availability
        use_gpu = torch.cuda.is_available()
        if use_gpu:
            print(f"✓ GPU detected: {torch.cuda.get_device_name(0)}")
            print(f"  CUDA version: {torch.version.cuda}")
            print(f"  GPU memory: {torch.cuda.get_device_properties(0).total_memory // (1024**3)} GB")
        else:
            print("⚠ No GPU detected - using CPU (slower)")
            print("  Install CUDA-enabled PyTorch for better performance")
        
        self.reader = easyocr.Reader(['en'], gpu=use_gpu)
        self.REGIONS = self._load_regions_from_config()
        self.KNOWN_COMMANDS = [
            "CLEARED TO LAND", "GO AROUND", "HOLD POSITION", "CLEARED FOR TAKEOFF",
            "TAXI TO GATE", "LINE UP AND WAIT", "PUSHBACK APPROVED",
            "CONTACT GROUND"
        ]
        self.schedule_callsigns = set()

    def _load_regions_from_config(self):
        config_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), "config.yaml")
        try:
            with open(config_path, 'r', encoding='utf-8') as f:
                config = yaml.safe_load(f)
            return config['vision']['screen_regions']
        except Exception as e:
            print(f"Error loading config: {e}")
            return {
                'command_panel': (1000, 600, 350, 120),
                'radar': (0, 0, 800, 600),
                'strips': (0, 600, 400, 168),
            }

    def load_schedule_callsigns(self, schedule_path):
        try:
            with open(schedule_path, 'r', encoding='utf-8') as f:
                for line in f:
                    cs = line.strip().split()[0]
                    if cs:
                        self.schedule_callsigns.add(cs.upper())
        except Exception as e:
            print(f"Error loading schedule: {e}")

    def match_callsign(self, text):
        for cs in self.schedule_callsigns:
            if cs in text.upper():
                return cs
        return None

    def preprocess_for_ocr(self, img):
        # Upscale and threshold for better OCR
        img = cv2.resize(img, None, fx=2, fy=2, interpolation=cv2.INTER_CUBIC)
        gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
        _, thresh = cv2.threshold(gray, 0, 255,
                     cv2.THRESH_BINARY + cv2.THRESH_OTSU)
        return cv2.cvtColor(thresh, cv2.COLOR_GRAY2BGR)

    def capture_region(self, region_name):
        x, y, w, h = self.REGIONS[region_name]
        screenshot = pyautogui.screenshot(region=(x, y, w, h))
        return cv2.cvtColor(np.array(screenshot), cv2.COLOR_RGB2BGR)

    def get_available_commands(self, templates=None):
        img = self.capture_region('command_panel')
        img = self.preprocess_for_ocr(img)
        results = self.reader.readtext(img)
        commands = [text.upper() for (_, text, conf) in results
                if conf > 0.5 and text.upper() in self.KNOWN_COMMANDS]
        return list(set(commands))

    def get_active_aircraft(self):
        img = self.capture_region('strips')
        img = self.preprocess_for_ocr(img)
        results = self.reader.readtext(img)
        aircraft = [text for (_, text, conf) in results if conf > 0.5]
        return aircraft

    def detect_radar_blips(self):
        img = self.capture_region('radar')
        hsv = cv2.cvtColor(img, cv2.COLOR_BGR2HSV)
        lower_green = np.array([45, 100, 100])
        upper_green = np.array([80, 255, 255])
        mask_green = cv2.inRange(hsv, lower_green, upper_green)
        lower_pink = np.array([140, 100, 100])
        upper_pink = np.array([170, 255, 255])
        mask_pink = cv2.inRange(hsv, lower_pink, upper_pink)
        contours_green, _ = cv2.findContours(mask_green, cv2.RETR_EXTERNAL,
                            cv2.CHAIN_APPROX_SIMPLE)
        contours_pink, _ = cv2.findContours(mask_pink, cv2.RETR_EXTERNAL,
                           cv2.CHAIN_APPROX_SIMPLE)
        blips = []
        for cnt in contours_green:
            area = cv2.contourArea(cnt)
            if 20 < area < 600:
                M = cv2.moments(cnt)
                if M["m00"] != 0:
                    cx = int(M["m10"] / M["m00"])
                    cy = int(M["m01"] / M["m00"])
                    blips.append({"color": "green", "pos": (cx, cy)})
        for cnt in contours_pink:
            area = cv2.contourArea(cnt)
            if 20 < area < 600:
                M = cv2.moments(cnt)
                if M["m00"] != 0:
                    cx = int(M["m10"] / M["m00"])
                    cy = int(M["m01"] / M["m00"])
                    blips.append({"color": "pink", "pos": (cx, cy)})
        return blips
        
        last_text = ""
        last_read_time = time.time()
        
        try:
            while True:
                # Capture just the top panel
                sct_img = sct.grab(top_panel_monitor)
                img = np.array(sct_img)
                img = cv2.cvtColor(img, cv2.COLOR_BGRA2BGR) # Convert BGRA to BGR
                
                # Try reading text every 2 seconds to save CPU initially
                current_time = time.time()
                if current_time - last_read_time > 2.0:
                    # TODO: Implement OCR reading here or use EasyOCR directly
                    # text = read_text_from_image(img)
                    text = None
                    if text and text != last_text and not text.startswith("Error"):
                        print(f"--- Detected Text --- \n{text}\n---------------------")
                        last_text = text
                    elif text and text.startswith("Error") and last_text != "error":
                        print(text)
                        last_text = "error"
                    last_read_time = current_time
                
                # Show the cropped region which the AI sees
                cv2.imshow('Command Panel Vision - AI EYES', img)
                
                # Delay for 30ms (~30fps)
                if cv2.waitKey(30) & 0xFF == ord('q'):
                    break
                    
        except KeyboardInterrupt:
            print("\nStopping vision bot.")
            
        finally:
            cv2.destroyAllWindows()

if __name__ == "__main__":
    main()