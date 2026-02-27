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
            "CLEARED TO LAND", "CLEARED FOR TAKEOFF", "PUSHBACK APPROVED",
            "CONTACT GROUND", "CONTACT TOWER", "TAXI TO RUNWAY",
            "HOLD SHORT", "LINE UP AND WAIT"
        ]
        
        # Exact ATC Zones for 1366x768 DBRITE Area
        self.zones = {
            "RUNWAY_09R": {"rect": (0, 160, 400, 30), "type": "RUNWAY"},
            "RUNWAY_09L": {"rect": (0, 120, 400, 30), "type": "RUNWAY"},
            "TAXIWAY_ALPHA": {"rect": (50, 200, 300, 40), "type": "TAXIWAY"},
            "FINAL_APPROACH": {"rect": (350, 50, 56, 250), "type": "FINAL"}
        }

    def extract_callsign(self, text):
        if not isinstance(text, str): return None
        match = re.search(r'([A-Z]{2,4}\d{1,4})', text.upper())
        return match.group(1) if match else None

    def match_intent(self, visible_callsign, heard_requests):
        """Disambiguates multiple voices by matching to current UI selection."""
        if not visible_callsign or visible_callsign == "NONE":
            return "NO_SELECTION"
            
        relevant = []
        for req in heard_requests:
            audio_cs = self.extract_callsign(req)
            if audio_cs == visible_callsign:
                relevant.append(f"[DIRECT] {req}")
            elif visible_callsign in req:
                relevant.append(f"[PARTIAL] {req}")
        
        if not relevant and heard_requests:
            return f"[LAST_HEARD] {heard_requests[-1]}"
            
        return " | ".join(relevant) if relevant else "SILENCE"

    def get_runway_occupancy(self, blips):
        occ = {k: "CLEAR" for k in self.zones if "RUNWAY" in k}
        for b in blips:
            pos = b.get("pos", (0, 0))
            bx, by = pos
            for z_name, z_data in self.zones.items():
                if "RUNWAY" not in z_name: continue
                zx, zy, zw, zh = z_data["rect"]
                if zx < bx < zx + zw and zy < by < zy + zh:
                    occ[z_name] = "OCCUPIED"
        return occ

    def get_situation_summary(self, blips):
        occ = self.get_runway_occupancy(blips)
        arrivals = len([b for b in blips if b.get('color') == 'green'])
        
        # Conflict Detection (Final vs Runway)
        conflict = False
        for b in blips:
            pos = b.get("pos", (0, 0))
            if b.get('color') == 'green' and 350 < pos[0] < 406:
                if any(v == "OCCUPIED" for v in occ.values()):
                    conflict = True
                    break

        status = f"TRAFFIC: {arrivals} Arrivals."
        if conflict: status += " !! CONFLICT RISK !!"
        status += " | " + " ".join([f"{k}:{v}" for k,v in occ.items()])
        return status

    def clean_command(self, raw_ocr):
        if not raw_ocr or len(str(raw_ocr)) < 3: return "NONE"
        best, score = process.extractOne(str(raw_ocr), self.valid_commands)
        return str(best) if score > 70 else str(raw_ocr)
