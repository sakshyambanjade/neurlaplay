"""
Lightweight VisionBot using pytesseract instead of EasyOCR
No PyTorch required - much smaller disk footprint
"""
import pytesseract
import pyautogui
import cv2
import os
import yaml
import numpy as np
import time

class VisionBot:
    def __init__(self):
        # Use pytesseract - no GPU/PyTorch needed
        # Requires Tesseract-OCR installed separately
        # Download from: https://github.com/UB-Mannheim/tesseract/wiki
        
        # Try to find Tesseract executable
        possible_paths = [
            r'C:\Program Files\Tesseract-OCR\tesseract.exe',
            r'C:\Program Files (x86)\Tesseract-OCR\tesseract.exe',
            r'D:\Tesseract-OCR\tesseract.exe',
            r'E:\Tesseract-OCR\tesseract.exe'
        ]
        
        tesseract_path = None
        for path in possible_paths:
            if os.path.exists(path):
                tesseract_path = path
                break
        
        if tesseract_path:
            pytesseract.pytesseract.tesseract_cmd = tesseract_path
            print(f"✓ Tesseract found: {tesseract_path}")
        else:
            print("⚠ Tesseract not found in standard locations")
            print("  Download from: https://github.com/UB-Mannheim/tesseract/wiki")
            print("  Install to: C:\\Program Files\\Tesseract-OCR")
            
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
            return self._default_regions()

    def _default_regions(self):
        return {
            'flight_strip_panel': (100, 100, 600, 800),
            'radar_screen': (700, 100, 1200, 700),
            'message_log': (100, 850, 800, 1000),
            'command_bar': (100, 1010, 800, 1050)
        }

    def capture_region(self, region_name):
        """Capture a screenshot of a specific region"""
        if region_name not in self.REGIONS:
            print(f"Warning: Unknown region '{region_name}'")
            return None
        
        x, y, w, h = self.REGIONS[region_name]
        screenshot = pyautogui.screenshot(region=(x, y, w-x, h-y))
        return cv2.cvtColor(np.array(screenshot), cv2.COLOR_RGB2BGR)

    def read_text_from_region(self, region_name, preprocess=True):
        """
        Read text from a screen region using pytesseract
        
        Args:
            region_name: Name of region from config
            preprocess: Apply image preprocessing for better OCR
            
        Returns:
            List of detected text strings
        """
        image = self.capture_region(region_name)
        if image is None:
            return []
        
        if preprocess:
            # Preprocess for better OCR
            gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
            # Increase contrast
            gray = cv2.convertScaleAbs(gray, alpha=1.5, beta=10)
            # Denoise
            gray = cv2.fastNlMeansDenoising(gray, h=10)
            # Threshold
            _, binary = cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
            image = binary
        
        try:
            # Use pytesseract
            text = pytesseract.image_to_string(image, config='--psm 6')
            lines = [line.strip() for line in text.split('\n') if line.strip()]
            return lines
        except Exception as e:
            print(f"OCR error: {e}")
            return []

    def read_flight_strips(self):
        """Read flight strip information"""
        try:
            lines = self.read_text_from_region('flight_strip_panel')
            
            flight_data = []
            for line in lines:
                # Look for callsigns (e.g., AAL123, UAL456)
                if len(line) >= 4 and any(char.isdigit() for char in line):
                    flight_data.append(line)
            
            return flight_data
        except Exception as e:
            print(f"Error reading flight strips: {e}")
            return []

    def detect_radar_blips(self):
        """Detect aircraft on radar (color-based detection)"""
        try:
            radar_image = self.capture_region('radar_screen')
            if radar_image is None:
                return []
            
            # Convert to HSV for color detection
            hsv = cv2.cvtColor(radar_image, cv2.COLOR_BGR2HSV)
            
            # Detect yellow/green blips (typical radar colors)
            lower_yellow = np.array([20, 100, 100])
            upper_yellow = np.array([30, 255, 255])
            lower_green = np.array([40, 50, 50])
            upper_green = np.array([80, 255, 255])
            
            mask1 = cv2.inRange(hsv, lower_yellow, upper_yellow)
            mask2 = cv2.inRange(hsv, lower_green, upper_green)
            mask = cv2.bitwise_or(mask1, mask2)
            
            # Find contours
            contours, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
            
            blips = []
            for contour in contours:
                area = cv2.contourArea(contour)
                if area > 20:  # Filter small noise
                    M = cv2.moments(contour)
                    if M['m00'] > 0:
                        cx = int(M['m10'] / M['m00'])
                        cy = int(M['m01'] / M['m00'])
                        blips.append((cx, cy, area))
            
            return blips
        except Exception as e:
            print(f"Error detecting radar blips: {e}")
            return []

    def read_message_log(self):
        """Read the message/communication log"""
        try:
            return self.read_text_from_region('message_log')
        except Exception as e:
            print(f"Error reading message log: {e}")
            return []

    def get_screen_state(self):
        """Get complete screen state"""
        return {
            'flight_strips': self.read_flight_strips(),
            'radar_blips': self.detect_radar_blips(),
            'messages': self.read_message_log(),
            'timestamp': time.time()
        }

    def get_available_commands(self):
        """
        Return list of known ATC commands
        (For compatibility with original vision_bot)
        """
        return self.KNOWN_COMMANDS
