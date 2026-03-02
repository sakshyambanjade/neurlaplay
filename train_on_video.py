#!/usr/bin/env python3
"""
Tower 3D Video Training Pipeline
- Extracts frames from video
- Labels UI sections (flight strips, DBRITE, ADRIS, etc)
- Trains model to identify aircraft codes, runway assignments, taxi instructions
- Creates structured dataset for reasoning engine
"""

import cv2
import numpy as np
import pytesseract
from pathlib import Path
import json
from datetime import datetime
import os

class VideoTrainer:
    """Train vision model from Tower 3D gameplay video"""
    
    def __init__(self, video_path, output_dir="training/video_data"):
        self.video_path = Path(video_path)
        self.output_dir = Path(output_dir)
        self.output_dir.mkdir(parents=True, exist_ok=True)
        
        self.frames_dir = self.output_dir / "frames"
        self.frames_dir.mkdir(exist_ok=True)
        
        self.labels_dir = self.output_dir / "labels"
        self.labels_dir.mkdir(exist_ok=True)
        
        self.dataset = {
            'video_file': str(self.video_path),
            'frames': [],
            'ui_sections': {},
            'aircraft_codes': [],
            'commands_issued': [],
            'state_transitions': []
        }
        
    def extract_frames(self, skip_frames=10):
        """Extract frames from video"""
        print(f"\n📹 Opening video: {self.video_path}")
        
        if not self.video_path.exists():
            print(f"❌ Video not found: {self.video_path}")
            return False
            
        cap = cv2.VideoCapture(str(self.video_path))
        
        if not cap.isOpened():
            print(f"❌ Cannot open video")
            return False
        
        total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
        fps = cap.get(cv2.CAP_PROP_FPS)
        print(f"✓ Video info: {total_frames} frames @ {fps} fps ({total_frames/fps:.1f} seconds)")
        
        frame_count = 0
        extracted = 0
        
        print(f"\n📊 Extracting frames (every {skip_frames} frames)...")
        
        while True:
            ret, frame = cap.read()
            if not ret:
                break
            
            if frame_count % skip_frames == 0:
                filename = f"frame_{extracted:06d}.png"
                filepath = self.frames_dir / filename
                cv2.imwrite(str(filepath), frame)
                
                self.dataset['frames'].append({
                    'frame_num': frame_count,
                    'timestamp': frame_count / fps,
                    'file': filename
                })
                
                extracted += 1
                if extracted % 50 == 0:
                    print(f"  ✓ {extracted} frames extracted ({frame_count}/{total_frames})")
            
            frame_count += 1
        
        cap.release()
        print(f"\n✓ Extracted {extracted} frames")
        return True
    
    def analyze_frame(self, frame_path, frame_num):
        """Analyze a single frame for UI elements and text"""
        frame = cv2.imread(str(frame_path))
        if frame is None:
            return None
        
        height, width = frame.shape[:2]
        
        analysis = {
            'frame': frame_num,
            'size': (width, height),
            'regions': {},
            'text_detected': [],
            'aircraft_codes': [],
            'commands': []
        }
        
        # Define typical UI regions (adjust based on your setup)
        regions = {
            'flight_strips_left': (6, 154, 917, 760),      # Where departure/arrival strips are
            'dbrite_right': (955, 3, 1364, 269),           # DBRITE panel (what's coming)
            'adris_right': (982, 282, 1337, 771),          # ADRIS panel (taxi/current)
            'command_bar': (8, 2, 856, 85),                # Text input
        }
        
        print(f"\n🔍 Analyzing frame {frame_num} from {frame_path.name}")
        
        for region_name, (x1, y1, x2, y2) in regions.items():
            region = frame[y1:y2, x1:x2]
            
            # OCR on region
            try:
                text = pytesseract.image_to_string(region, config='--psm 6')
                lines = [l.strip() for l in text.split('\n') if l.strip()]
                
                analysis['regions'][region_name] = {
                    'bbox': [x1, y1, x2, y2],
                    'size': (x2-x1, y2-y1),
                    'text': text,
                    'lines': lines
                }
                
                if lines:
                    print(f"  📍 {region_name}:")
                    for line in lines[:5]:  # Show first 5 lines
                        print(f"      → {line}")
                    if len(lines) > 5:
                        print(f"      ... and {len(lines)-5} more lines")
                
                # Extract aircraft codes from flight strips
                if 'strip' in region_name.lower():
                    for line in lines:
                        if len(line) >= 3 and any(c.isdigit() for c in line):
                            analysis['aircraft_codes'].append(line)
                
            except Exception as e:
                print(f"  ⚠ OCR error in {region_name}: {e}")
        
        return analysis
    
    def interactive_labeling(self):
        """Interactively label frames for training"""
        print("\n" + "="*80)
        print("INTERACTIVE FRAME LABELING")
        print("="*80)
        
        frame_files = sorted(self.frames_dir.glob("frame_*.png"))
        print(f"\nFound {len(frame_files)} extracted frames")
        
        if not frame_files:
            print("❌ No frames to label. Extract frames first!")
            return False
        
        # Start with first frame
        current_idx = 0
        
        while True:
            frame_file = frame_files[current_idx]
            print(f"\n[{current_idx+1}/{len(frame_files)}] {frame_file.name}")
            print("-" * 80)
            
            # Analyze frame
            analysis = self.analyze_frame(frame_file, current_idx)
            
            if analysis:
                # Display the frame
                frame = cv2.imread(str(frame_file))
                cv2.imshow("Frame Analysis", frame)
                
                # Get user input
                print("\n" + "="*80)
                print("LABEL THIS FRAME")
                print("="*80)
                print("\nWhat's happening in this frame?")
                print("Commands: [n]ext, [p]revious, [e]xport, [q]uit")
                print("\nEnter aircraft codes (comma-separated, or leave blank):")
                aircraft_input = input("  Aircraft: ").strip()
                
                print("\nWhat commands should be issued? (e.g., 'AAL123 CLEARED TO LAND'):")
                commands_input = input("  Commands: ").strip()
                
                print("\nWhat's the state? (e.g., 'approach', 'landing', 'taxi', 'takeoff'):")
                state_input = input("  State: ").strip()
                
                # Save label
                label = {
                    'frame': current_idx,
                    'timestamp': frame_files[current_idx].name,
                    'aircraft_detected': analysis['aircraft_codes'],
                    'aircraft_labeled': [a.strip() for a in aircraft_input.split(',') if a.strip()],
                    'commands': [c.strip() for c in commands_input.split(',') if c.strip()],
                    'state': state_input,
                    'regions': analysis['regions']
                }
                
                # Save label
                label_file = self.labels_dir / f"frame_{current_idx:06d}_label.json"
                with open(label_file, 'w') as f:
                    json.dump(label, f, indent=2)
                
                self.dataset['state_transitions'].append({
                    'frame': current_idx,
                    'state': state_input,
                    'aircraft': label['aircraft_labeled'],
                    'commands': label['commands']
                })
                
                print(f"\n✓ Label saved to {label_file.name}")
            
            # Handle navigation
            print("\nNext action? [n]ext/[p]revious/[e]xport/[s]kip10/[q]uit")
            key = input("  > ").strip().lower()
            
            if key == 'n':
                current_idx = min(current_idx + 1, len(frame_files) - 1)
            elif key == 'p':
                current_idx = max(current_idx - 1, 0)
            elif key == 'skip10' or key == 's':
                current_idx = min(current_idx + 10, len(frame_files) - 1)
            elif key == 'e':
                break
            elif key == 'q':
                print("\n✗ Cancelled")
                return False
            
            cv2.destroyAllWindows()
        
        return True
    
    def export_training_data(self):
        """Export labeled data for model training"""
        print("\n" + "="*80)
        print("EXPORTING TRAINING DATA")
        print("="*80)
        
        # Collect all labels
        label_files = sorted(self.labels_dir.glob("*_label.json"))
        print(f"\nFound {len(label_files)} labeled frames")
        
        training_data = {
            'metadata': {
                'video': str(self.video_path),
                'frames_count': len(self.dataset['frames']),
                'labeled_frames': len(label_files),
                'export_date': datetime.now().isoformat()
            },
            'samples': []
        }
        
        all_aircraft = set()
        all_commands = set()
        all_states = set()
        
        for label_file in label_files:
            with open(label_file) as f:
                label = json.load(f)
                
                training_data['samples'].append(label)
                
                all_aircraft.update(label.get('aircraft_labeled', []))
                all_commands.update(label.get('commands', []))
                all_states.add(label.get('state', ''))
        
        # Add vocabularies
        training_data['vocabularies'] = {
            'aircraft_codes': sorted(list(all_aircraft)),
            'commands': sorted(list(all_commands)),
            'states': sorted(list(all_states))
        }
        
        # Save
        export_file = self.output_dir / "training_data.json"
        with open(export_file, 'w') as f:
            json.dump(training_data, f, indent=2)
        
        print(f"\n✓ Exported {len(training_data['samples'])} labeled samples")
        print(f"\n📊 Statistics:")
        print(f"  • Unique aircraft: {len(all_aircraft)}")
        print(f"  • Unique commands: {len(all_commands)}")
        print(f"  • Unique states: {len(all_states)}")
        print(f"\n✓ Saved to {export_file}")
        
        # Also save as CSV for easier analysis
        import csv
        csv_file = self.output_dir / "training_samples.csv"
        with open(csv_file, 'w', newline='') as f:
            writer = csv.writer(f)
            writer.writerow(['frame', 'state', 'aircraft', 'commands', 'detected_text'])
            
            for sample in training_data['samples']:
                detected_text = ' | '.join([
                    f"{k}: {', '.join(v['lines'][:2])}"
                    for k, v in sample.get('regions', {}).items()
                ])
                writer.writerow([
                    sample['frame'],
                    sample.get('state', ''),
                    ', '.join(sample.get('aircraft_labeled', [])),
                    ', '.join(sample.get('commands', [])),
                    detected_text
                ])
        
        print(f"✓ Also saved CSV to {csv_file}")
        return export_file

def main():
    """Main training pipeline"""
    import argparse
    
    parser = argparse.ArgumentParser(description="Train Tower 3D vision model from video")
    parser.add_argument("video_path", help="Path to Tower 3D gameplay video")
    parser.add_argument("--extract-only", action="store_true", help="Only extract frames, don't label")
    parser.add_argument("--skip-frames", type=int, default=10, help="Extract every Nth frame")
    
    args = parser.parse_args()
    
    # Create trainer
    trainer = VideoTrainer(args.video_path)
    
    # Step 1: Extract frames
    if not trainer.extract_frames(skip_frames=args.skip_frames):
        return
    
    if args.extract_only:
        print(f"\n✓ Frame extraction complete. Files saved to: {trainer.frames_dir}")
        print(f"  To label: python train_on_video.py '{args.video_path}'")
        return
    
    # Step 2: Interactive labeling
    if not trainer.interactive_labeling():
        return
    
    # Step 3: Export training data
    trainer.export_training_data()
    
    print("\n" + "="*80)
    print("✓ TRAINING PIPELINE COMPLETE")
    print("="*80)
    print(f"\nNext step: Train model on labeled data")

if __name__ == "__main__":
    main()
