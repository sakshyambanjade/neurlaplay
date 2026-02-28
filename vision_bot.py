import easyocr
import pyautogui
import cv2
import numpy as np

class VisionBot:
        def load_schedule_callsigns(self, schedule_path):
            """
            Loads callsigns from a schedule file for smarter aircraft identification.
            """
            self.callsign_map = set()
            try:
                with open(schedule_path, 'r', encoding='utf-8') as f:
                    for line in f:
                        parts = line.strip().split(',')
                        if len(parts) >= 5:
                            self.callsign_map.add(parts[4].upper())
            except Exception as e:
                print(f"Error loading schedule: {e}")

        def match_callsign(self, text):
            """
            Returns True if text matches a known callsign from the schedule.
            """
            if hasattr(self, 'callsign_map'):
                return text.upper() in self.callsign_map
            return False

        def detect_radar_blips(self):
            """
            Detects aircraft blips on the radar panel using color and shape analysis.
            Returns a list of detected blip positions and (optionally) colors.
            """
            img = self.capture_region('radar')
            # Convert to HSV for color detection
            hsv = cv2.cvtColor(img, cv2.COLOR_BGR2HSV)
            # Example: Detect green blips (arrivals)
            lower_green = np.array([40, 40, 40])
            upper_green = np.array([80, 255, 255])
            mask = cv2.inRange(hsv, lower_green, upper_green)
            # Find contours (blips)
            contours, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
            blips = []
            for cnt in contours:
                x, y, w, h = cv2.boundingRect(cnt)
                if w > 5 and h > 5:  # Filter out noise
                    blips.append({'pos': (x + w//2, y + h//2), 'size': (w, h)})
            return blips
    def __init__(self):
        self.reader = easyocr.Reader(['en'], gpu=False)
        # Calibrated for 1366x768 resolution (update as needed)
        self.REGIONS = {
            'command_panel': (1000, 600, 350, 120),  # x, y, width, height
            'radar':         (0,    0,   800, 600),
            'strips':        (0,    600, 400, 168),
        }

    def template_match_commands(self, img, templates):
        # templates: dict of {command: template_image}
        found = []
        for cmd, template in templates.items():
            res = cv2.matchTemplate(img, template, cv2.TM_CCOEFF_NORMED)
            loc = np.where(res >= 0.8)
            if len(loc[0]) > 0:
                found.append(cmd)
        return found

    def capture_region(self, region_name):
        x, y, w, h = self.REGIONS[region_name]
        screenshot = pyautogui.screenshot(region=(x, y, w, h))
        return cv2.cvtColor(np.array(screenshot), cv2.COLOR_RGB2BGR)

    def get_available_commands(self, templates=None):
        img = self.capture_region('command_panel')
        commands = []
        # Fast template matching for known commands
        if templates:
            commands += self.template_match_commands(img, templates)
        # OCR fallback for dynamic text
        results = self.reader.readtext(img)
        commands += [text.upper() for (_, text, conf) in results if conf > 0.5]
        return list(set(commands))

    def get_active_aircraft(self):
        img = self.capture_region('strips')
        results = self.reader.readtext(img)
        aircraft = []
        for (_, text, conf) in results:
            if conf > 0.6 and self.match_callsign(text):
                aircraft.append(text)
        return aircraft

def main():
    print("Starting Tower!3D Pro Vision Bot...")
    with mss.mss() as sct:
        # Monitor 1 is usually the primary monitor
        if len(sct.monitors) > 1:
            monitor = sct.monitors[1]
        else:
            monitor = sct.monitors[0]
            
        print(f"Screen resolution: {monitor['width']}x{monitor['height']}")
        
        # We will capture the top 15% of the screen where the command panel is
        top_panel_monitor = {
            "top": monitor["top"],
            "left": monitor["left"],
            "width": monitor["width"],
            "height": int(monitor["height"] * 0.15)
        }

        print("Press 'q' in the preview window to stop or Ctrl+C in terminal.")
        
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
                     text = read_text_from_image(img)
                     if text and text != last_text and not text.startswith("Error"):
                         print(f"--- Detected Text --- \n{text}\n---------------------")
                         last_text = text
                     elif text.startswith("Error") and last_text != "error":
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
