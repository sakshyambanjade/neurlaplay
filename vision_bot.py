import cv2
import numpy as np
import mss
import time
import pytesseract
import pyautogui

def read_text_from_image(image):
    # Convert image to grayscale
    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    
    # Thresholding to get white text more clearly against a dark background
    _, thresh = cv2.threshold(gray, 150, 255, cv2.THRESH_BINARY)
    
    # Needs Tesseract installed on Windows to work
    # Default install path shown below:
    pytesseract.pytesseract.tesseract_cmd = r'C:\Program Files\Tesseract-OCR\tesseract.exe'
    
    try:
        text = pytesseract.image_to_string(thresh)
        return text.strip()
    except Exception as e:
        return f"Error reading text: {e}\n(Make sure Tesseract OCR is installed on Windows: https://github.com/UB-Mannheim/tesseract/wiki)"

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
                # OCR for command panel text
                text = read_text_from_image(img)
                print(f"Command Panel OCR: {text}")
                # Template matching for button options
                # Example: Find rectangles/buttons and extract their text
                gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
                _, thresh = cv2.threshold(gray, 180, 255, cv2.THRESH_BINARY)
                contours, _ = cv2.findContours(thresh, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
                button_texts = []
                for cnt in contours:
                    x, y, w, h = cv2.boundingRect(cnt)
                    if w > 60 and h > 20 and y > 20: # Filter likely buttons
                        button_crop = img[y:y+h, x:x+w]
                        btn_text = read_text_from_image(button_crop)
                        if btn_text:
                            button_texts.append(btn_text)
                print(f"Detected Command Buttons: {button_texts}")

if __name__ == "__main__":
    main()
