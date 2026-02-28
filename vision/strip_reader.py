import cv2
import numpy as np
import mss
import pytesseract
import re

# SETTINGS
TESSERACT_PATH = r'C:\Program Files\Tesseract-OCR\tesseract.exe'
pytesseract.pytesseract.tesseract_cmd = TESSERACT_PATH

def read_strips(img):
    """
    Parses the flight strips on the right side of the screen.
    Focuses on the yellow/orange boxes which indicate active flights.
    """
    # 1. Convert to HSV to find those yellow/orange strips
    hsv = cv2.cvtColor(img, cv2.COLOR_BGR2HSV)
    
    # Yellow range in Tower!3D strips
    lower_yellow = np.array([20, 100, 100])
    upper_yellow = np.array([40, 255, 255])
    mask = cv2.inRange(hsv, lower_yellow, upper_yellow)
    
    # 2. Find contours of the strips
    contours, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    
    flights = []
    for cnt in contours:
        x, y, w, h = cv2.boundingRect(cnt)
        
        # Filter out tiny noises, real strips are wide
        if w > 100 and h > 20: 
            # Crop to the strip
            strip_crop = img[y:y+h, x:x+w]
            
            # OCR the strip
            gray = cv2.cvtColor(strip_crop, cv2.COLOR_BGR2GRAY)
            _, thresh = cv2.threshold(gray, 50, 255, cv2.THRESH_BINARY_INV) # Inverse to get dark text on light bg
            text = pytesseract.image_to_string(thresh, config='--psm 6').strip()
            
            # Extract Callsign (e.g. KAP8051)
            callsign_match = re.search(r'[A-Z]{2,4}\d{1,4}', text.upper())
            if callsign_match:
                callsign = callsign_match.group(0)
                flights.append({
                    "callsign": callsign,
                    "raw_text": text.replace('\n', ' '),
                    "rect": (x, y, w, h)
                })
                
    return flights, mask

if __name__ == "__main__":
    print("Strip Reader Test...")
    with mss.mss() as sct:
        monitor = sct.monitors[1] if len(sct.monitors) > 1 else sct.monitors[0]
        
        # Strip window is usually on the far right
        strip_area = {
            "top": int(monitor['height'] * 0.4), 
            "left": int(monitor['width'] * 0.7), 
            "width": int(monitor['width'] * 0.3), 
            "height": int(monitor['height'] * 0.5)
        }
        
        while True:
            sct_img = sct.grab(strip_area)
            img = np.array(sct_img)
            img = cv2.cvtColor(img, cv2.COLOR_BGRA2BGR)
            
            flights, mask = read_strips(img)
            
            for f in flights:
                print(f"Detected Flight in Strip: {f['callsign']} | Data: {f['raw_text']}")
                x, y, w, h = f['rect']
                cv2.rectangle(img, (x, y), (x+w, y+h), (0, 0, 255), 2)
            
            cv2.imshow('Strip Vision', img)
            cv2.imshow('Strip Mask (Yellow)', mask)
            
            if cv2.waitKey(500) & 0xFF == ord('q'):
                break
                
    cv2.destroyAllWindows()