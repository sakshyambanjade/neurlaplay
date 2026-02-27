from fuzzywuzzy import process
import re
import time

class ATCWorldModel:
    """
    Handles higher-level airport logic and data cleaning.
    """
    def __init__(self, resolution=(1366, 768)):
        self.res = resolution
        self.valid_commands = [
            "CLEARED TO", "CLEARED FOR", "GO AROUND", "ENTER FINAL", "TURN", "REPORT",
            "TAKE NEXT", "CONTACT", "PUSHBACK", "TAXI TO", "HOLD POSITION", "LINE UP AND WAIT",
            "CONTINUE TAXI", "FOLLOW", "DELETE AIRPLANE", "LOW APPROACH", "AVAILABLE EXIT",
            "LEFT", "RIGHT", "HEADING", "POSITION", "AIRSPEED", "RUNWAY", "SHORT OF TAXIWAY",
            "LINE UP AND", "CONTINUE", "ON LEFT", "ON RIGHT"
        ]
        
        # Exact ATC Zones for 1366x768 DBRITE Area
        self.zones = {
            "KJFK_04L": {"rect": (50, 50, 100, 20), "heading": 44},
            "KJFK_04R": {"rect": (150, 50, 100, 20), "heading": 44},
            "KJFK_22L": {"rect": (50, 100, 100, 20), "heading": 224},
            "KJFK_22R": {"rect": (150, 100, 100, 20), "heading": 224},
            "KJFK_13L": {"rect": (50, 150, 100, 20), "heading": 134},
            "KJFK_13R": {"rect": (150, 150, 100, 20), "heading": 134},
            "KJFK_31L": {"rect": (50, 200, 100, 20), "heading": 314},
            "KJFK_31R": {"rect": (150, 200, 100, 20), "heading": 314},
            "FINAL_APPROACH": {"rect": (350, 50, 56, 250), "type": "FINAL"}
        }
        self.current_wind = {"dir": 0, "speed": 0}

    def parse_wind(self, text):
        """Attempts to find wind info like 'WIND 230 AT 12' or '230/12'."""
        match = re.search(r'WIND (\d{3}) AT (\d{1,2})', text.upper())
        if not match:
            match = re.search(r'(\d{3})/(\d{1,2})', text)
        
        if match:
            self.current_wind["dir"] = int(match.group(1))
            self.current_wind["speed"] = int(match.group(2))
            return True
        return False

    def get_tailwind_component(self, runway_name):
        """Calculates component based on runway heading vs wind dir."""
        if runway_name not in self.zones: return 0
        r_hdg = self.zones[runway_name].get("heading", 0)
        w_dir = self.current_wind["dir"]
        w_spd = self.current_wind["speed"]
        
        # Difference in angles
        diff = math.radians(w_dir - r_hdg)
        # Cosine gives headwind (positive) or tailwind (negative)
        component = w_spd * math.cos(diff)
        return -component # Return positive value for TAILWIND

    def get_situation_summary(self, blips, full_ocr_text=""):
        # Update wind first
        self.parse_wind(full_ocr_text)
        
        occ = self.get_runway_occupancy(blips)
        arrivals = len([b for b in blips if b.get('color') == 'green'])
        
        summary = f"WIND: {self.current_wind['dir']}/{self.current_wind['speed']}kts. "
        
        # Check tailwinds for active (occupied) runways
        for r_name, status in occ.items():
            if status == "OCCUPIED":
                tailwind = self.get_tailwind_component(r_name)
                if tailwind > 5:
                    summary += f"!! TAILWIND {tailwind:.1f}kts on {r_name} !! "

        # Conflict Detection
        conflict = False
        on_final = any(350 < b.get("pos", (0,0))[0] < 406 for b in blips if b.get('color') == 'green')
        if on_final and any(v == "OCCUPIED" for v in occ.values()):
            conflict = True

        if conflict: summary += " !! RUNWAY CONFLICT RISK !!"
        summary += f" | {arrivals} Arrivals."
        return summary

    def clean_command(self, raw_ocr):
        if not raw_ocr or len(str(raw_ocr)) < 3: return "NONE"
        best, score = process.extractOne(str(raw_ocr), self.valid_commands)
        return str(best) if score > 70 else str(raw_ocr)
