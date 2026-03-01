"""
UI Element Annotation Tool
Captures Tower 3D screenshots and lets you label buttons, panels, and UI elements
"""
import cv2
import numpy as np
import json
import os
from datetime import datetime
import pyautogui
from pathlib import Path

class UIAnnotator:
    def __init__(self, output_dir="training_data/ui_elements"):
        self.output_dir = Path(output_dir)
        self.output_dir.mkdir(parents=True, exist_ok=True)
        
        self.annotations_file = self.output_dir / "annotations.json"
        self.screenshots_dir = self.output_dir / "screenshots"
        self.screenshots_dir.mkdir(exist_ok=True)
        
        # Load existing annotations or create new
        if self.annotations_file.exists():
            with open(self.annotations_file, 'r') as f:
                self.annotations = json.load(f)
        else:
            self.annotations = {
                "images": [],
                "ui_elements": []
            }
        
        # Current annotation state
        self.current_image = None
        self.current_screenshot_path = None
        self.drawing = False
        self.start_point = None
        self.temp_rect = None
        self.current_annotations = []
        
        print(f"✓ Annotator initialized")
        print(f"  Output: {self.output_dir}")
        print(f"  Existing annotations: {len(self.annotations['ui_elements'])}")

    def capture_screenshot(self, window_title="Tower!3D Pro"):
        """Capture full Tower 3D window screenshot"""
        screenshot = pyautogui.screenshot()
        img = cv2.cvtColor(np.array(screenshot), cv2.COLOR_RGB2BGR)
        
        # Save screenshot
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        filename = f"tower3d_{timestamp}.png"
        filepath = self.screenshots_dir / filename
        cv2.imwrite(str(filepath), img)
        
        print(f"✓ Screenshot saved: {filename}")
        print(f"  Resolution: {img.shape[1]}x{img.shape[0]}")
        
        return img, str(filepath), filename

    def mouse_callback(self, event, x, y, flags, param):
        """Handle mouse events for drawing bounding boxes"""
        if event == cv2.EVENT_LBUTTONDOWN:
            self.drawing = True
            self.start_point = (x, y)
            
        elif event == cv2.EVENT_MOUSEMOVE:
            if self.drawing:
                self.temp_rect = (self.start_point, (x, y))
                
        elif event == cv2.EVENT_LBUTTONUP:
            self.drawing = False
            end_point = (x, y)
            
            # Calculate bounding box
            x1, y1 = self.start_point
            x2, y2 = end_point
            
            # Ensure top-left and bottom-right
            bbox = {
                "x": min(x1, x2),
                "y": min(y1, y2),
                "width": abs(x2 - x1),
                "height": abs(y2 - y1)
            }
            
            # Ask for element type
            print("\n" + "="*50)
            print("What type of UI element is this?")
            print("="*50)
            print("1. Button (clickable)")
            print("2. Panel/Window (container)")
            print("3. Text display (read-only)")
            print("4. Input field (editable)")
            print("5. Flight strip")
            print("6. Radar screen")
            print("7. Menu item")
            print("8. Other")
            print("0. Cancel (don't save)")
            
            choice = input("\nEnter number: ").strip()
            
            element_types = {
                "1": "button",
                "2": "panel",
                "3": "text_display",
                "4": "input_field",
                "5": "flight_strip",
                "6": "radar_screen",
                "7": "menu_item",
                "8": "other"
            }
            
            if choice == "0":
                print("⊠ Annotation cancelled")
                return
            
            element_type = element_types.get(choice, "unknown")
            
            # Ask for label/description
            label = input("Enter button name/description (e.g., 'Clear to Land', 'Flight Strip Panel'): ").strip()
            
            annotation = {
                "bbox": bbox,
                "type": element_type,
                "label": label,
                "timestamp": datetime.now().isoformat()
            }
            
            self.current_annotations.append(annotation)
            print(f"✓ Saved: {element_type} - '{label}'")
            print(f"  Location: ({bbox['x']}, {bbox['y']}) Size: {bbox['width']}x{bbox['height']}")

    def annotate_screenshot(self, image, filepath, filename):
        """Interactive annotation session"""
        self.current_image = image.copy()
        self.current_screenshot_path = filepath
        self.current_annotations = []
        
        window_name = "UI Element Annotator - Draw boxes around buttons/elements"
        cv2.namedWindow(window_name, cv2.WINDOW_NORMAL)
        cv2.resizeWindow(window_name, 1280, 720)
        cv2.setMouseCallback(window_name, self.mouse_callback)
        
        print("\n" + "="*70)
        print("ANNOTATION INSTRUCTIONS")
        print("="*70)
        print("1. Click and drag to draw a box around a button or UI element")
        print("2. Release to save and label the element")
        print("3. Press 's' to save all annotations for this screenshot")
        print("4. Press 'q' to quit without saving")
        print("5. Press 'r' to reset all annotations for this screenshot")
        print("="*70)
        
        while True:
            # Create display image
            display = self.current_image.copy()
            
            # Draw existing annotations
            for ann in self.current_annotations:
                bbox = ann['bbox']
                x, y, w, h = bbox['x'], bbox['y'], bbox['width'], bbox['height']
                
                # Different colors for different types
                color_map = {
                    "button": (0, 255, 0),        # Green
                    "panel": (255, 0, 0),         # Blue
                    "text_display": (0, 255, 255), # Yellow
                    "input_field": (255, 255, 0),  # Cyan
                    "flight_strip": (255, 0, 255), # Magenta
                    "radar_screen": (128, 0, 128), # Purple
                    "menu_item": (0, 165, 255),    # Orange
                    "other": (200, 200, 200)       # Gray
                }
                
                color = color_map.get(ann['type'], (255, 255, 255))
                
                cv2.rectangle(display, (x, y), (x+w, y+h), color, 2)
                
                # Label
                label_text = f"{ann['type']}: {ann['label']}"
                cv2.putText(display, label_text, (x, y-5),
                           cv2.FONT_HERSHEY_SIMPLEX, 0.5, color, 1)
            
            # Draw temporary rectangle while dragging
            if self.temp_rect:
                pt1, pt2 = self.temp_rect
                cv2.rectangle(display, pt1, pt2, (0, 255, 0), 2)
            
            # Show annotation count
            count_text = f"Annotations: {len(self.current_annotations)}"
            cv2.putText(display, count_text, (10, 30),
                       cv2.FONT_HERSHEY_SIMPLEX, 1, (0, 255, 0), 2)
            
            cv2.imshow(window_name, display)
            
            key = cv2.waitKey(1) & 0xFF
            
            if key == ord('q'):
                print("\n⊠ Quit without saving")
                cv2.destroyAllWindows()
                return False
            
            elif key == ord('s'):
                # Save annotations
                if len(self.current_annotations) > 0:
                    self.save_annotations(filename)
                    print(f"\n✓ Saved {len(self.current_annotations)} annotations")
                    cv2.destroyAllWindows()
                    return True
                else:
                    print("\n⚠ No annotations to save")
            
            elif key == ord('r'):
                # Reset
                self.current_annotations = []
                print("\n↻ Reset annotations")
        
        cv2.destroyAllWindows()

    def save_annotations(self, image_filename):
        """Save annotations to JSON file"""
        # Add image entry
        image_entry = {
            "filename": image_filename,
            "path": str(self.screenshots_dir / image_filename),
            "timestamp": datetime.now().isoformat(),
            "annotation_count": len(self.current_annotations)
        }
        
        self.annotations["images"].append(image_entry)
        
        # Add UI element annotations
        for ann in self.current_annotations:
            ui_element = {
                "image": image_filename,
                "bbox": ann['bbox'],
                "type": ann['type'],
                "label": ann['label'],
                "timestamp": ann['timestamp']
            }
            self.annotations["ui_elements"].append(ui_element)
        
        # Save to file
        with open(self.annotations_file, 'w') as f:
            json.dump(self.annotations, f, indent=2)
        
        print(f"✓ Annotations saved to {self.annotations_file}")

    def run_session(self):
        """Run an annotation session"""
        print("\n" + "="*70)
        print("UI ELEMENT ANNOTATION SESSION")
        print("="*70)
        print("\nMake sure Tower 3D is visible on screen!")
        print("Press Enter when ready to capture screenshot...")
        input()
        
        # Capture screenshot
        img, filepath, filename = self.capture_screenshot()
        
        # Annotate
        success = self.annotate_screenshot(img, filepath, filename)
        
        if success:
            print("\n✓ Session completed successfully")
            print(f"  Total annotations in dataset: {len(self.annotations['ui_elements'])}")
            return True
        else:
            print("\n⊠ Session cancelled")
            return False

    def generate_summary(self):
        """Generate summary of annotations"""
        if len(self.annotations['ui_elements']) == 0:
            print("\n⚠ No annotations yet")
            return
        
        print("\n" + "="*70)
        print("ANNOTATION SUMMARY")
        print("="*70)
        
        # Count by type
        type_counts = {}
        for elem in self.annotations['ui_elements']:
            elem_type = elem['type']
            type_counts[elem_type] = type_counts.get(elem_type, 0) + 1
        
        print(f"\nTotal images: {len(self.annotations['images'])}")
        print(f"Total UI elements: {len(self.annotations['ui_elements'])}")
        print("\nBy type:")
        for elem_type, count in sorted(type_counts.items()):
            print(f"  {elem_type}: {count}")
        
        # Show some examples
        print("\nRecent annotations:")
        for elem in self.annotations['ui_elements'][-10:]:
            print(f"  [{elem['type']}] {elem['label']} - {elem['image']}")


def main():
    """Main annotation tool"""
    annotator = UIAnnotator()
    
    print("\n" + "="*70)
    print("TOWER 3D UI ELEMENT ANNOTATION TOOL")
    print("="*70)
    print("\nThis tool helps you teach the AI where buttons and UI elements are.")
    print("You'll capture screenshots and draw boxes around elements.\n")
    
    while True:
        print("\n" + "="*70)
        print("MENU")
        print("="*70)
        print("1. Start new annotation session (capture screenshot)")
        print("2. View annotation summary")
        print("3. Exit")
        
        choice = input("\nEnter choice: ").strip()
        
        if choice == "1":
            annotator.run_session()
            
        elif choice == "2":
            annotator.generate_summary()
            
        elif choice == "3":
            print("\n✓ Exiting...")
            annotator.generate_summary()
            break
        
        else:
            print("⚠ Invalid choice")


if __name__ == "__main__":
    main()
