#!/usr/bin/env python3
"""
Smart Video Frame Labeler
Auto-detects aircraft codes, situations, and suggests labels.
User just confirms or corrects.
"""

import cv2
import json
import pytesseract
import numpy as np
from pathlib import Path
import re

class SmartLabeler:
    """Intelligent frame labeler with auto-detection"""
    
    def __init__(self, frames_dir="training/video_data/frames"):
        self.frames_dir = Path(frames_dir)
        self.labels_dir = self.frames_dir.parent / "labels"
        self.labels_dir.mkdir(exist_ok=True)
        
        # Aircraft code pattern (e.g., AAL123, SWA456, UAL789)
        self.callsign_pattern = re.compile(r'\b[A-Z]{3}\d{1,4}\b')
        
        # Common ATC keywords
        self.keywords = {
            'arrival': ['CLEARED TO LAND', 'FINAL', 'APPROACH', 'LANDING', 'ILS'],
            'departure': ['CLEARED FOR TAKEOFF', 'TAKEOFF', 'LINE UP', 'HOLD SHORT'],
            'taxi': ['TAXI', 'HOLD POSITION', 'CROSS', 'GATE'],
            'pushback': ['PUSHBACK', 'STARTUP', 'READY'],
        }
        
    def auto_detect_aircraft(self, frame):
        """Auto-detect aircraft callsigns from frame"""
        height, width = frame.shape[:2]
        
        # Focus on flight strip area (typically left 1/3 of screen for LAX video at 1080p)
        strip_region = frame[100:900, 0:600]
        
        # OCR
        text = pytesseract.image_to_string(strip_region, config='--psm 6')
        
        # Find all callsigns
        callsigns = self.callsign_pattern.findall(text)
        
        # Deduplicate and sort
        callsigns = sorted(set(callsigns))
        
        return callsigns, text
    
    def auto_detect_situation(self, text):
        """Auto-detect what situation this is (arrival/departure/taxi)"""
        text_upper = text.upper()
        
        scores = {}
        for situation, keywords in self.keywords.items():
            scores[situation] = sum(1 for keyword in keywords if keyword in text_upper)
        
        # Get highest score
        if max(scores.values()) > 0:
            return max(scores, key=scores.get)
        return 'unknown'
    
    def suggest_commands(self, callsigns, situation):
        """Suggest ATC commands based on situation"""
        if not callsigns:
            return []
        
        commands = []
        
        if situation == 'arrival':
            for cs in callsigns[:2]:  # First 2 aircraft
                commands.append(f"{cs} CLEARED TO LAND RWY 25L")
        elif situation == 'departure':
            for cs in callsigns[:2]:
                commands.append(f"{cs} CLEARED FOR TAKEOFF RWY 25R")
        elif situation == 'taxi':
            for cs in callsigns[:2]:
                commands.append(f"{cs} TAXI TO GATE")
        
        return commands
    
    def quick_label(self, batch_size=10):
        """Quickly label frames with auto-detection"""
        print("\n" + "="*80)
        print("SMART FRAME LABELER - Auto-detection enabled")
        print("="*80)
        
        frame_files = sorted(self.frames_dir.glob("frame_*.png"))
        print(f"\n✓ Found {len(frame_files)} frames to label")
        
        # Check already labeled
        existing_labels = set(f.stem.replace('_label', '') for f in self.labels_dir.glob("*_label.json"))
        remaining = [f for f in frame_files if f.stem not in existing_labels]
        
        print(f"✓ Already labeled: {len(existing_labels)}")
        print(f"✓ Remaining: {len(remaining)}")
        
        if not remaining:
            print("\n✓ All frames already labeled!")
            return True
        
        print(f"\n🚀 Starting smart labeling (batch size: {batch_size})")
        print("\nControls:")
        print("  [y] - Accept auto-label")
        print("  [e] - Edit aircraft codes")
        print("  [s] - Skip frame")
        print("  [q] - Quit and export")
        
        labeled_count = 0
        
        for idx, frame_file in enumerate(remaining):
            print(f"\n{'='*80}")
            print(f"Frame {idx+1}/{len(remaining)}: {frame_file.name}")
            print(f"{'='*80}")
            
            # Load frame
            frame = cv2.imread(str(frame_file))
            if frame is None:
                print("⚠ Could not load frame, skipping")
                continue
            
            # Auto-detect
            print("\n🔍 Auto-detecting...")
            callsigns, full_text = self.auto_detect_aircraft(frame)
            situation = self.auto_detect_situation(full_text)
            commands = self.suggest_commands(callsigns, situation)
            
            # Show detection results
            print(f"\n✓ Aircraft detected: {', '.join(callsigns) if callsigns else 'None'}")
            print(f"✓ Situation: {situation}")
            print(f"✓ Suggested commands:")
            for cmd in commands:
                print(f"    → {cmd}")
            
            # Show frame
            display = frame.copy()
            # Add text overlay
            y = 30
            cv2.putText(display, f"Aircraft: {', '.join(callsigns)}", (10, y),
                       cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 255, 0), 2)
            y += 30
            cv2.putText(display, f"Situation: {situation}", (10, y),
                       cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 255, 0), 2)
            
            cv2.imshow("Frame Labeler", display)
            cv2.waitKey(100)
            
            # Get user input
            print("\n[y] Accept | [e] Edit | [s] Skip | [q] Quit")
            choice = input("› ").strip().lower()
            
            if choice == 'q':
                print("\n✓ Exporting...")
                break
            elif choice == 's':
                print("⏭ Skipped")
                continue
            elif choice == 'e':
                # Manual edit
                print("\nEnter aircraft codes (comma-separated):")
                manual_aircraft = input("  Aircraft: ").strip()
                callsigns = [a.strip() for a in manual_aircraft.split(',') if a.strip()]
                
                print("\nEnter situation (arrival/departure/taxi/pushback):")
                situation = input("  Situation: ").strip() or situation
                
                commands = self.suggest_commands(callsigns, situation)
                print(f"\nUpdated commands: {commands}")
            
            # Save label
            label = {
                'frame': idx,
                'file': frame_file.name,
                'aircraft': callsigns,
                'situation': situation,
                'commands': commands,
                'auto_detected': choice != 'e'
            }
            
            label_file = self.labels_dir / f"{frame_file.stem}_label.json"
            with open(label_file, 'w') as f:
                json.dump(label, f, indent=2)
            
            labeled_count += 1
            print(f"✓ Labeled ({labeled_count} total)")
            
            # Auto-save every 10 labels
            if labeled_count % 10 == 0:
                print(f"\n💾 Auto-saved {labeled_count} labels")
        
        cv2.destroyAllWindows()
        print(f"\n✓ Labeled {labeled_count} frames")
        return True
    
    def export_dataset(self):
        """Export all labels as training dataset"""
        print("\n" + "="*80)
        print("EXPORTING TRAINING DATASET")
        print("="*80)
        
        label_files = sorted(self.labels_dir.glob("*_label.json"))
        print(f"\n✓ Found {len(label_files)} labeled frames")
        
        dataset = {
            'metadata': {
                'total_frames': len(label_files),
                'source': 'Tower 3D Pro - LAX gameplay'
            },
            'samples': [],
            'vocabularies': {
                'aircraft': set(),
                'situations': set(),
                'commands': set()
            }
        }
        
        for label_file in label_files:
            with open(label_file) as f:
                label = json.load(f)
                dataset['samples'].append(label)
                
                dataset['vocabularies']['aircraft'].update(label.get('aircraft', []))
                dataset['vocabularies']['situations'].add(label.get('situation', ''))
                dataset['vocabularies']['commands'].update(label.get('commands', []))
        
        # Convert sets to sorted lists
        dataset['vocabularies']['aircraft'] = sorted(dataset['vocabularies']['aircraft'])
        dataset['vocabularies']['situations'] = sorted(dataset['vocabularies']['situations'])
        dataset['vocabularies']['commands'] = sorted(dataset['vocabularies']['commands'])
        
        # Save
        output_file = self.labels_dir.parent / "training_dataset.json"
        with open(output_file, 'w') as f:
            json.dump(dataset, f, indent=2)
        
        print(f"\n✓ Exported {len(dataset['samples'])} samples")
        print(f"\n📊 Dataset Statistics:")
        print(f"  • Unique aircraft: {len(dataset['vocabularies']['aircraft'])}")
        print(f"  • Situations: {dataset['vocabularies']['situations']}")
        print(f"  • Unique commands: {len(dataset['vocabularies']['commands'])}")
        print(f"\n✓ Saved to: {output_file}")
        
        return output_file

def main():
    """Run smart labeling"""
    import argparse
    
    parser = argparse.ArgumentParser(description="Smart frame labeler with auto-detection")
    parser.add_argument("--frames-dir", default="training/video_data/frames",
                       help="Directory containing extracted frames")
    parser.add_argument("--batch", type=int, default=10, help="Batch size for labeling")
    parser.add_argument("--export-only", action="store_true", help="Only export existing labels")
    
    args = parser.parse_args()
    
    labeler = SmartLabeler(args.frames_dir)
    
    if not args.export_only:
        labeler.quick_label(batch_size=args.batch)
    
    # Always export at the end
    labeler.export_dataset()

if __name__ == "__main__":
    main()
