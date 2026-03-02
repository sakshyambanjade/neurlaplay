# 🎮 PLAY & LEARN - Zero Frustration Training

Stop doing tedious manual work. **Just play Tower 3D and let the AI watch and learn!**

## Quickstart (3 steps)

### 1. Start Recording
```bash
python training/gameplay_recorder.py
```

### 2. Play the Game (30-60 minutes)
- Play Tower 3D normally
- Make ATC decisions naturally  
- Click buttons as you normally would
- **The AI is recording everything**

### 3. Analyze What You Did
```bash
# Find your session ID (shown when recording stops)
python training/analyze_gameplay.py <session_id>

# Example:
python training/analyze_gameplay.py 20260301_193045
```

## What Gets Learned

### From Your Clicks:
- ✓ **WHERE buttons are** (from click coordinates)
- ✓ **WHAT buttons do** (before/after screenshot comparison)
- ✓ **WHEN to click** (from timing patterns)
- ✓ **Decision sequences** (which buttons you click in order)

### Output:
- `ui_knowledge_base.json` - Structured button data
- `discovered_buttons.png` - Visualization of all found buttons
- `button_patches/` - Images of each button
- Complete click history with timestamps

## Example Session

```bash
$ python training/gameplay_recorder.py

How long do you want to play?
  1. Let me decide (manual stop)
  2. 30 minutes
  3. 60 minutes  ← Choose this
  4. 90 minutes

Press Enter to start recording...

🔴 RECORDING STARTED
Just play Tower 3D normally!

  Click #1: (456, 234)
  Click #2: (456, 235)  # Same button (grouped)
  Click #3: (789, 456)  # New button discovered
  ...
  Click #47: (456, 234)  # Button used again

⏹ RECORDING STOPPED

Session Summary:
  Duration: 60.2 minutes
  Clicks recorded: 47
  Screenshots: 721
  Total events: 768
```

Then analyze:

```bash
$ python training/analyze_gameplay.py 20260301_193045

Analyzing 47 clicks...
✓ Discovered 12 unique button regions
✓ Analyzed effects for 12 buttons
✓ Extracted 12 button images
✓ Knowledge base saved
✓ Visualization created

Top 5 most-used buttons:
  1. Button at (456, 234) - 8 clicks  # Clear to Land?
  2. Button at (789, 456) - 6 clicks  # Taxi to Gate?
  3. Button at (123, 789) - 5 clicks
  4. Button at (234, 567) - 4 clicks
  5. Button at (345, 678) - 3 clicks
```

## Why This is Better

### Old Way (Manual Annotation):
- ❌ Draw 50-100 bounding boxes by hand
- ❌ Takes 3-4 hours of tedious work
- ❌ Frustrating and boring
- ❌ Easy to make mistakes

### New Way (Passive Recording):
- ✓ Play normally for 1 hour
- ✓ AI learns while you play
- ✓ Captures REAL decision patterns
- ✓ More data, less work
- ✓ Actually fun!

## What the AI Learns

### Phase 1: Button Locations
```json
{
  "button_id": "btn_001",
  "location": {"x": 456, "y": 234},
  "click_count": 8,
  "usage_frequency": 0.13  // clicks per minute
}
```

### Phase 2: Button Functions (from before/after diff)
```json
{
  "button_id": "btn_001",
  "effect_type": "high_impact",  // UI changed a lot
  "likely_function": "command_execution"
}
```

### Phase 3: Decision Patterns
```json
{
  "sequence": [
    {"button": "btn_001", "delay": 0},
    {"button": "btn_002", "delay": 5.2},  // 5.2 sec later
    {"button": "btn_003", "delay": 12.8}
  ],
  "context": "aircraft_landing"
}
```

## Tips for Good Training Data

### Play Naturally:
- ✓ Handle different scenarios (arrivals, departures, emergencies)
- ✓ Use different buttons
- ✓ Play at your normal pace
- ✓ Make mistakes too (AI learns from everything!)

### Session Length:
- **30 min**: Good for quick patterns
- **60 min**: Recommended - captures variety
- **90 min**: Excellent data, includes rare events

### Multiple Sessions:
Record different gameplay styles:
- Morning session: Peak traffic management
- Afternoon session: Emergency handling
- Evening session: Different airport/weather

## Troubleshooting

### "No clicks recorded"
Make sure you're actually clicking in Tower 3D window during recording.

### "Can't find Tower 3D window"
The tool captures the entire screen. Just make sure Tower 3D is visible.

### Session ID not found
Check `training_data/gameplay_recordings/` folder for available sessions.

## Next Steps After Recording

1. **Analyze session** → Discover buttons
2. **Review visualization** → See what AI found
3. **Train recognition model** → Use discovered buttons
4. **Build decision AI** → Learn from your patterns

## Advanced: Merge Multiple Sessions

After recording several sessions, merge the knowledge:

```bash
python training/merge_sessions.py session1 session2 session3
```

This combines discoveries from multiple play sessions to build a complete UI map.

---

**TL;DR**: Run `python training/gameplay_recorder.py`, play for 1 hour, then run analyzer. Done! 🎉
