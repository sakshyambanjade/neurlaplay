"""
Gameplay Analyzer - Automatically Learn from Recorded Sessions
Analyzes recorded gameplay to discover UI elements and their functions
"""
import cv2
import numpy as np
import json
from pathlib import Path
from collections import defaultdict
import sys

class GameplayAnalyzer:
    """Analyzes recorded gameplay to extract UI knowledge"""
    
    def __init__(self, session_dir):
        self.session_dir = Path(session_dir)
        
        # Load session metadata
        metadata_file = self.session_dir / "session_metadata.json"
        with open(metadata_file, 'r') as f:
            self.metadata = json.load(f)
        
        self.discovered_buttons = []
        self.click_heatmap = None
        
        print(f"✓ Loaded session: {self.metadata['session_id']}")
        print(f"  Duration: {self.metadata['duration_minutes']:.1f} minutes")
        print(f"  Clicks: {self.metadata['total_clicks']}")
    
    def detect_button_regions(self):
        """Find button regions from click coordinates"""
        clicks = [e for e in self.metadata['events'] if e['type'] == 'click']
        
        if len(clicks) == 0:
            print("⚠ No clicks recorded!")
            return []
        
        print(f"\nAnalyzing {len(clicks)} clicks...")
        
        # Cluster clicks to find buttons
        # Similar clicks likely = same button
        button_regions = []
        
        for click in clicks:
            x, y = click['x'], click['y']
            
            # Check if this click is near an existing button
            found_existing = False
            for button in button_regions:
                dist = np.sqrt((button['center_x'] - x)**2 + (button['center_y'] - y)**2)
                if dist < 30:  # Within 30 pixels = same button
                    button['clicks'].append(click)
                    found_existing = True
                    break
            
            if not found_existing:
                # New button discovered!
                button_regions.append({
                    'center_x': x,
                    'center_y': y,
                    'clicks': [click]
                })
        
        print(f"✓ Discovered {len(button_regions)} unique button regions")
        
        # Refine button locations (average of all clicks)
        for button in button_regions:
            clicks = button['clicks']
            button['center_x'] = int(np.mean([c['x'] for c in clicks]))
            button['center_y'] = int(np.mean([c['y'] for c in clicks]))
            button['click_count'] = len(clicks)
            
            # Estimate button size (smaller by default for better accuracy)
            button['width'] = 80  # Smaller estimate
            button['height'] = 25  # Smaller estimate
            button['x'] = button['center_x'] - button['width'] // 2
            button['y'] = button['center_y'] - button['height'] // 2
        
        self.discovered_buttons = button_regions
        return button_regions
    
    def analyze_button_effects(self):
        """Analyze what each button does by comparing before/after screenshots"""
        print("\nAnalyzing button effects...")
        
        for button in self.discovered_buttons:
            effects = []
            
            for click in button['clicks']:
                # Load before/after screenshots
                before_path = self.session_dir / click['screenshot_before']
                after_path = self.session_dir / click['screenshot_after']
                
                if not before_path.exists() or not after_path.exists():
                    continue
                
                before = cv2.imread(str(before_path))
                after = cv2.imread(str(after_path))
                
                # Calculate difference
                diff = cv2.absdiff(before, after)
                diff_score = np.sum(diff) / (diff.shape[0] * diff.shape[1] * diff.shape[2])
                
                effects.append({
                    'diff_score': diff_score,
                    'timestamp': click['timestamp']
                })
            
            # Summarize effect
            if effects:
                avg_diff = np.mean([e['diff_score'] for e in effects])
                button['effect_magnitude'] = avg_diff
                button['effect_type'] = 'high_impact' if avg_diff > 5 else 'low_impact'
            else:
                button['effect_magnitude'] = 0
                button['effect_type'] = 'unknown'
        
        print(f"✓ Analyzed effects for {len(self.discovered_buttons)} buttons")
    
    def extract_button_images(self):
        """Extract image patches of discovered buttons"""
        print("\nExtracting button images...")
        
        patches_dir = self.session_dir / "button_patches"
        patches_dir.mkdir(exist_ok=True)
        
        extracted_count = 0
        for i, button in enumerate(self.discovered_buttons):
            # Get a representative screenshot (from first click)
            if len(button['clicks']) > 0:
                click = button['clicks'][0]
                screenshot_path = self.session_dir / click['screenshot_before']
                
                if screenshot_path.exists():
                    try:
                        img = cv2.imread(str(screenshot_path))
                        
                        if img is None:
                            continue
                        
                        # Extract button region
                        x, y, w, h = button['x'], button['y'], button['width'], button['height']
                        
                        # Ensure within bounds
                        x = max(0, x)
                        y = max(0, y)
                        x2 = min(img.shape[1], x + w)
                        y2 = min(img.shape[0], y + h)
                        
                        # Check if region is valid
                        if x2 <= x or y2 <= y:
                            continue
                        
                        patch = img[y:y2, x:x2]
                        
                        # Check if patch is empty
                        if patch.size == 0 or patch.shape[0] == 0 or patch.shape[1] == 0:
                            continue
                        
                        # Save patch
                        patch_file = patches_dir / f"button_{i:03d}.png"
                        success = cv2.imwrite(str(patch_file), patch)
                        
                        if success:
                            button['patch_file'] = str(patch_file)
                            extracted_count += 1
                    
                    except Exception as e:
                        continue
        
        print(f"✓ Extracted {extracted_count}/{len(self.discovered_buttons)} button images")
    
    def generate_ui_knowledge_base(self):
        """Generate structured knowledge base from analysis"""
        knowledge = {
            "session_id": self.metadata['session_id'],
            "discovery_date": self.metadata['start_time'],
            "play_duration_minutes": self.metadata['duration_minutes'],
            "discovered_buttons": []
        }
        
        for i, button in enumerate(self.discovered_buttons):
            button_knowledge = {
                "button_id": f"btn_{i:03d}",
                "location": {
                    "x": button['x'],
                    "y": button['y'],
                    "width": button['width'],
                    "height": button['height'],
                    "center_x": button['center_x'],
                    "center_y": button['center_y']
                },
                "usage_stats": {
                    "click_count": button['click_count'],
                    "usage_frequency": button['click_count'] / self.metadata['duration_minutes']
                },
                "effect": {
                    "magnitude": button.get('effect_magnitude', 0),
                    "type": button.get('effect_type', 'unknown')
                },
                "image_patch": button.get('patch_file', None)
            }
            
            knowledge["discovered_buttons"].append(button_knowledge)
        
        # Save knowledge base
        kb_file = self.session_dir / "ui_knowledge_base.json"
        with open(kb_file, 'w') as f:
            json.dump(knowledge, f, indent=2)
        
        print(f"\n✓ Knowledge base saved: {kb_file}")
        return knowledge
    
    def visualize_discovered_buttons(self):
        """Create visualization of discovered buttons"""
        print("\nCreating visualization...")
        
        # Get a representative screenshot
        periodic_screenshots = list(self.session_dir.glob("periodic_*.png"))
        if not periodic_screenshots:
            print("⚠ No periodic screenshots found")
            return
        
        screenshot = cv2.imread(str(periodic_screenshots[0]))
        
        # Draw all discovered buttons
        for i, button in enumerate(self.discovered_buttons):
            x, y, w, h = button['x'], button['y'], button['width'], button['height']
            
            # Color based on usage frequency
            if button['click_count'] > 5:
                color = (0, 0, 255)  # Red = frequently used
            elif button['click_count'] > 2:
                color = (0, 255, 255)  # Yellow = moderately used
            else:
                color = (0, 255, 0)  # Green = rarely used
            
            cv2.rectangle(screenshot, (x, y), (x+w, y+h), color, 2)
            
            # Label
            label = f"#{i} ({button['click_count']}x)"
            cv2.putText(screenshot, label, (x, y-5),
                       cv2.FONT_HERSHEY_SIMPLEX, 0.5, color, 1)
        
        # Save visualization
        viz_file = self.session_dir / "discovered_buttons.png"
        cv2.imwrite(str(viz_file), screenshot)
        
        print(f"✓ Visualization saved: {viz_file}")
        print(f"\nColor legend:")
        print(f"  🟢 Green: Rarely clicked (1-2 times)")
        print(f"  🟡 Yellow: Moderately used (3-5 times)")
        print(f"  🔴 Red: Frequently used (>5 times)")
    
    def analyze_full_session(self):
        """Run complete analysis pipeline"""
        print("\n" + "="*70)
        print("ANALYZING GAMEPLAY SESSION")
        print("="*70)
        
        # Step 1: Detect button regions
        self.detect_button_regions()
        
        # Step 2: Analyze what buttons do
        self.analyze_button_effects()
        
        # Step 3: Extract button images
        self.extract_button_images()
        
        # Step 4: Generate knowledge base
        knowledge = self.generate_ui_knowledge_base()
        
        # Step 5: Visualize
        self.visualize_discovered_buttons()
        
        # Summary
        print("\n" + "="*70)
        print("ANALYSIS COMPLETE")
        print("="*70)
        print(f"\n✓ Discovered {len(self.discovered_buttons)} unique buttons")
        print(f"✓ Extracted button images")
        print(f"✓ Generated UI knowledge base")
        print(f"✓ Created visualization\n")
        
        # Most used buttons
        sorted_buttons = sorted(self.discovered_buttons, key=lambda b: b['click_count'], reverse=True)
        print("Top 5 most-used buttons:")
        for i, btn in enumerate(sorted_buttons[:5], 1):
            print(f"  {i}. Button at ({btn['center_x']}, {btn['center_y']}) - {btn['click_count']} clicks")
        
        print(f"\nAll data saved to: {self.session_dir}")
        
        return knowledge


def main():
    """Main analyzer interface"""
    if len(sys.argv) < 2:
        print("\nUsage: python analyze_gameplay.py <session_id>")
        print("\nAvailable sessions:")
        
        sessions_dir = Path("training_data/gameplay_recordings")
        if sessions_dir.exists():
            sessions = [d.name for d in sessions_dir.iterdir() if d.is_dir()]
            for session in sorted(sessions):
                print(f"  • {session}")
        else:
            print("  (none yet - record a session first!)")
        
        return
    
    session_id = sys.argv[1]
    session_dir = Path("training_data/gameplay_recordings") / session_id
    
    if not session_dir.exists():
        print(f"✗ Session not found: {session_dir}")
        return
    
    # Analyze session
    analyzer = GameplayAnalyzer(session_dir)
    analyzer.analyze_full_session()


if __name__ == "__main__":
    main()
