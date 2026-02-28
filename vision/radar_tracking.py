import cv2
import numpy as np
import mss

def find_aircraft_blips(img):
    """
    Detects blips on the radar map and distinguishes by color.
    Green = Arrival
    Pink/Magenta = Taxiing/Departure
    """
    hsv = cv2.cvtColor(img, cv2.COLOR_BGR2HSV)
    
    # 1. Detect Green Blips (Arrivals)
    lower_green = np.array([40, 40, 40])
    upper_green = np.array([80, 255, 255])
    mask_green = cv2.inRange(hsv, lower_green, upper_green)
    
    # 2. Detect Pink/Magenta Blips (Taxiing/Departures)
    # Pink is roughly 140-170 in HSV Hue
    lower_pink = np.array([140, 50, 50])
    upper_pink = np.array([170, 255, 255])
    mask_pink = cv2.inRange(hsv, lower_pink, upper_pink)

    # Find contours
    contours_green, _ = cv2.findContours(mask_green, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    contours_pink, _ = cv2.findContours(mask_pink, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    
    blips = []
    for cnt in contours_green:
        M = cv2.moments(cnt)
        if M["m00"] != 0:
            cx = int(M["m10"] / M["m00"])
            cy = int(M["m01"] / M["m00"])
            blips.append({"pos": (cx, cy), "type": "arrival", "color": "green"})
            
    for cnt in contours_pink:
        M = cv2.moments(cnt)
        if M["m00"] != 0:
            cx = int(M["m10"] / M["m00"])
            cy = int(M["m01"] / M["m00"])
            blips.append({"pos": (cx, cy), "type": "taxi_dep", "color": "pink"})
            
    return blips, mask_green, mask_pink

if __name__ == "__main__":
    print("Radar Tracking Module Test...")
    with mss.mss() as sct:
        monitor = sct.monitors[1] if len(sct.monitors) > 1 else sct.monitors[0]
        # Radar is usually central. We'll capture a large central block.
        # This needs calibration based on the user's specific layout.
        capture_area = {
            "top": int(monitor['height'] * 0.2), 
            "left": int(monitor['width'] * 0.1), 
            "width": int(monitor['width'] * 0.8), 
            "height": int(monitor['height'] * 0.7)
        }
        
        while True:
            sct_img = sct.grab(capture_area)
            img = np.array(sct_img)
            img = cv2.cvtColor(img, cv2.COLOR_BGRA2BGR)
            
            blips, m_green, m_red = find_aircraft_blips(img)
            
            # Draw circles around detected blips for debug preview
            for blip in blips:
                color = (0, 255, 0) if blip["type"] == "active" else (0, 0, 255)
                cv2.circle(img, blip["pos"], 10, color, 2)
            
            cv2.imshow('Radar AI Vision', img)
            if cv2.waitKey(1) & 0xFF == ord('q'):
                break
                
    cv2.destroyAllWindows()