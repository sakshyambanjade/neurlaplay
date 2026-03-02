# Vision Training Pipeline - HOW TO USE

## Overview
This system will train the bot to **UNDERSTAND** Tower 3D before executing commands.

It learns:
- ✅ Flight strip sections (departure/arrival/taxi panels)
- ✅ Aircraft codes/callsigns (AAL123, UAL456, etc)
- ✅ DBRITE panel (incoming traffic, landing patterns)
- ✅ ADRIS panel (current taxi routes, positions)
- ✅ What commands should be issued in each situation

## Step 1: Prepare Your Video

You need a **Tower 3D gameplay video** showing:
- Flight strips with aircraft codes clearly visible
- DBRITE panel showing incoming traffic
- ADRIS panel showing taxi instructions
- Various situations: arrivals, departures, taxi

**Video Format:**
- MP4, AVI, MOV (any OpenCV-compatible format)
- 5-30 minutes long is ideal
- 1366x768 resolution (your current screen size)
- Clear, unobstructed view of all UI panels

## Step 2: Run Frame Extraction

```powershell
cd Tower3D_AI_Bot
python train_on_video.py "C:\path\to\your\video.mp4" --skip-frames 10
```

This will:
1. Extract every 10th frame from your video
2. Save frames to `training/video_data/frames/`
3. Automatically detect text in each region using OCR
4. Show you what was detected

Example output:
```
📹 Opening video: video.mp4
✓ Video info: 9000 frames @ 30 fps (300.0 seconds)

🔍 Analyzing frame 0 from frame_000000.png
  📍 flight_strips_left:
      → AAL123 DEP 22L
      → UAL456 ARR 22R
      → SWA789 TAXI
```

## Step 3: Interactive Labeling

After extraction, you'll see each frame and label it:

```
[1/150] frame_000000.png
────────────────────────────────────────────
📍 flight_strips_left:
    → AAL123 DEP 22L
    → UAL456 ARR 22R

LABEL THIS FRAME
=================================

What's happening in this frame?
Commands: [n]ext, [p]revious, [e]xport, [q]uit

Enter aircraft codes (comma-separated, or leave blank):
  Aircraft: AAL123, UAL456

What commands should be issued? (e.g., 'AAL123 CLEARED TO LAND'):
  Commands: AAL123 CLEARED TO LAND RWY 22R, UAL456 HOLDING PATTERN

What's the state? (e.g., 'approach', 'landing', 'taxi', 'takeoff'):
  State: arrival_sequence

[n]ext/[p]revious/[e]xport/[s]kip10/[q]uit
  > n
```

**Navigation:**
- `n` - Next frame
- `p` - Previous frame
- `s` or `skip10` - Skip 10 frames
- `e` - Export training data
- `q` - Quit

### For Each Frame, Label:

1. **Aircraft codes** - What actual callsigns are visible?
   - Example: `AAL123, SWA456`

2. **Commands** - What should the bot say?
   - Example: `AAL123 CLEARED TO LAND RWY 22R, SWA456 HOLD POSITION`

3. **State** - What phase is it in?
   - Options: `approach`, `landing`, `takeoff`, `taxi`, `startup`, `pushback`, `waiting`

## Step 4: Export Training Data

When you press `e` for export, it creates:

**Output Files:**
```
training/video_data/
├── frames/
│   ├── frame_000000.png
│   ├── frame_000001.png
│   └── ...
├── labels/
│   ├── frame_000000_label.json
│   ├── frame_000001_label.json
│   └── ...
├── training_data.json       ← Complete labeled dataset
└── training_samples.csv     ← Easy-to-read format
```

**training_data.json contains:**
```json
{
  "metadata": {
    "video": "video.mp4",
    "frames_count": 150,
    "labeled_frames": 150
  },
  "samples": [
    {
      "frame": 0,
      "state": "arrival_sequence",
      "aircraft_labeled": ["AAL123", "UAL456"],
      "commands": ["AAL123 CLEARED TO LAND RWY 22R"],
      "regions": {...}
    }
  ],
  "vocabularies": {
    "aircraft_codes": ["AAL123", "SWA456", "UAL789"],
    "commands": ["CLEARED TO LAND", "HOLD POSITION", ...],
    "states": ["approach", "landing", "taxi", ...]
  }
}
```

## Step 5: Train Model (Next Phase)

Once you have labeled data, we'll build a model that:

1. **Recognizes patterns** - "When I see X text in Y region, it means Z"
2. **Classifies states** - "This is an arrival situation" vs "This is a taxi"
3. **Suggests commands** - "Given this situation, issue these commands"

## Summary of Workflow:

```
Your Video
    ↓
[Extract Frames]
    ↓
[Label Each Frame]
    ↓
[Export JSON/CSV]
    ↓
[Train AI Model]
    ↓
[Smart Bot that UNDERSTANDS Tower 3D]
```

## Quick Start Command:

```powershell
# 1. Extract frames every 10 frames (5-min video = ~150 frames)
python train_on_video.py "C:\path\to\video.mp4" --skip-frames 10

# 2. Label frames interactively (press 'n' to skip, 'e' to export when done)

# 3. Training data saved to training/video_data/training_data.json
```

---

**Ready?** Place your video file and run the command! 

What's your video file path/name?
