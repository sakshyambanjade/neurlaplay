# UI Training Plan - Teaching AI to Understand Tower 3D Interface

## 🎮 EASIEST APPROACH: Just Play the Game!

**Tired of manual annotation?** → Use the **Passive Gameplay Recorder**

Instead of tedious manual work, just PLAY Tower 3D normally for 1 hour. The AI watches everything you do and learns automatically!

### Quick Start (Play & Learn):
```bash
python training/gameplay_recorder.py
```

That's it! Play the game normally. The AI learns by watching you.

---

## New Strategy: Learn the Interface First

Instead of hardcoding screen regions, we'll train the AI to **discover and understand** the Tower 3D UI on its own.

## Two Training Approaches

### 🟢 Approach A: PASSIVE (Recommended - No Frustration!)

**Just play the game, AI learns by watching**

1. **Record gameplay** (1 hour):
   ```bash
   python training/gameplay_recorder.py
   ```
   - Play normally
   - AI records every click with before/after screenshots
   - Captures game state every 5 seconds
   - Tracks timing and sequences

2. **Automatic analysis**:
   ```bash
   python training/analyze_gameplay.py <session_id>
   ```
   - AI finds buttons from your clicks
   - Learns what buttons do (before/after comparison)
   - Builds UI knowledge base automatically
   - Creates visualization of discovered buttons

**Advantages**:
- ✓ Zero manual work
- ✓ Learn while playing naturally
- ✓ Captures real decision patterns
- ✓ No frustration!

---

### 🟡 Approach B: MANUAL (More accurate, more tedious)

**Manual annotation for precise training data**

**Steps**:
1. ✓ Capture Tower 3D screenshots
2. ✓ Manually annotate UI elements (draw boxes around buttons/panels)
3. ✓ Train object detection model to find these elements automatically
4. Test: AI should identify "there's a button at (x,y) with size (w,h)"

**Tools**:
- `training/ui_element_annotator.py` - Interactive annotation tool
- `training/button_recognition_trainer.py` - Trains CNN to recognize elements

**Data needed**: ~50-100 annotated screenshots with different game states

**Use this when**: You want very precise button boundaries or need to label rare UI elements

---

### Phase 2: Button Function Recognition (WHAT buttons do)
**Goal**: Teach the AI what each button/element does

**Steps**:
1. Collect button click data:
   - Screenshot before click
   - Which button was clicked (coordinates + label)
   - Screenshot after click (what changed?)
   - Game state change (what happened?)

2. Build knowledge base:
   ```json
   {
     "button_label": "Clear to Land",
     "location": {"x": 100, "y": 200},
     "function": "land_aircraft",
     "context": "aircraft_on_approach",
     "effect": "aircraft_clears_runway"
   }
   ```

3. Train function classifier:
   - Input: Button visual appearance + game context
   - Output: Button function/purpose

**Tools needed** (TODO):
- Button click logger
- Visual change detector
- Function classifier model

---

### Phase 3: Action Understanding (HOW to use buttons)
**Goal**: Learn sequences and workflows

**Steps**:
1. Record human gameplay:
   - Sequence: What buttons clicked in what order
   - Context: When to click (aircraft states, timing)
   - Outcomes: Success/failure of actions

2. Build action patterns:
   ```
   PATTERN: Landing sequence
   1. Aircraft approaches → [Click "Clear to Land" button]
   2. Aircraft on runway → [Click "Taxi to Gate" button]
   3. Gate reached → [Click "Pushback Approved" later]
   ```

3. Train decision model:
   - Input: Current game state + available buttons
   - Output: Which button to click + when

---

## Current Status: Phase 1 - UI Detection

### Step 1: Collect Training Data

**Run the annotation tool**:
```bash
python training/ui_element_annotator.py
```

**What you'll do**:
1. Tool captures Tower 3D screenshot
2. You draw boxes around buttons/elements
3. Label each element (button, panel, text display, etc.)
4. Save annotations
5. Repeat 50-100 times with different game states

**Element types to annotate**:
- `button` - Clickable buttons (Clear to Land, Hold Position, etc.)
- `panel` - UI panels/windows (Flight Strip Panel, etc.)
- `text_display` - Read-only text areas
- `flight_strip` - Individual flight strips
- `radar_screen` - Radar display area
- `input_field` - Text input boxes
- `menu_item` - Menu options

### Step 2: Train Recognition Model

**After collecting ~50 annotations**:
```bash
python training/button_recognition_trainer.py
```

This trains a CNN to recognize UI element types from image patches.

### Step 3: Test Detection

**Use trained model to detect buttons in live game**:
```python
from training.button_detector import ButtonDetector

detector = ButtonDetector("models/button_recognition_best.pth")
screenshot = capture_game_screen()
buttons = detector.detect(screenshot)

for button in buttons:
    print(f"Found {button['type']}: {button['label']}")
    print(f"  Location: ({button['x']}, {button['y']})")
    print(f"  Confidence: {button['confidence']:.2%}")
```

---

## Why This Approach is Better

### Old Approach (Hardcoded):
```python
# Breaks when UI changes, different resolutions, etc.
FLIGHT_STRIP_REGION = (100, 100, 600, 800)
RADAR_REGION = (700, 100, 1200, 700)
```

### New Approach (Learned):
```python
# AI discovers UI layout automatically
ui_elements = detector.detect_all(screenshot)
flight_strips = [e for e in ui_elements if e['type'] == 'flight_strip']
radar = [e for e in ui_elements if e['type'] == 'radar_screen'][0]
```

**Benefits**:
- ✓ Works with different screen resolutions
- ✓ Adapts to UI changes/updates
- ✓ Generalizes to other airports/scenarios
- ✓ Can discover new UI elements we didn't know about
- ✓ More like how humans learn (observe → understand → use)

---

## Next Steps

### Immediate (Today):
1. **Collect data**: Run `ui_element_annotator.py` and annotate 20-30 screenshots
   - Start Tower 3D
   - Get different game states (idle, busy, different airports)
   - Annotate all visible buttons and panels

2. **Train first model**: Once you have 30+ annotations
   - Run `button_recognition_trainer.py`
   - Check validation accuracy (aim for >80%)

### This Week:
3. **Build live detector**: Create real-time UI element detection
4. **Test accuracy**: How well does it find buttons in new screenshots?
5. **Iterate**: Collect more data where model fails

### Next Week:
6. **Phase 2**: Start recording button functions
7. **Build knowledge base**: What does each button do?

---

## File Structure

```
Tower3D_AI_Bot/
├── training/
│   ├── ui_element_annotator.py      ✓ Interactive annotation tool
│   ├── button_recognition_trainer.py ✓ CNN training
│   ├── button_detector.py           TODO: Live detection
│   └── function_learner.py           TODO: Phase 2
│
├── training_data/
│   └── ui_elements/
│       ├── screenshots/              Captured images
│       ├── annotations.json          Bounding boxes + labels
│       └── dataset_stats.txt         Data statistics
│
├── models/
│   ├── button_recognition_best.pth  Trained model
│   └── button_functions.json        Knowledge base
│
└── docs/
    └── UI_TRAINING_PLAN.md          This file
```

---

## Expected Timeline

| Phase | Task | Time Estimate | Status |
|-------|------|---------------|--------|
| 1 | Annotation tool | 2 hours | ✓ Done |
| 1 | Collect 50 annotations | 3-4 hours | ⏳ In Progress |
| 1 | Train CNN model | 1 hour | ⏳ Waiting for data |
| 1 | Build live detector | 2 hours | ⏸ TODO |
| 2 | Click logger | 3 hours | ⏸ TODO |
| 2 | Function classifier | 4 hours | ⏸ TODO |
| 3 | Sequence recorder | 3 hours | ⏸ TODO |
| 3 | Decision model | 5 hours | ⏸ TODO |

**Total estimated time**: ~23-25 hours of focused work

---

## Tips for Good Annotations

1. **Variety**: Annotate different game states
   - Idle vs busy
   - Different airports
   - Day vs night (if applicable)
   - Different UI states (menus open/closed)

2. **Accuracy**: Draw tight boxes
   - Include whole button (not cropped)
   - Don't include too much background
   - Be consistent with similar elements

3. **Labels**: Use clear, consistent names
   - "Clear to Land" not "cleartoland" or "CTL"
   - Same name for same button across images

4. **Coverage**: Annotate ALL visible elements
   - Don't skip small buttons
   - Include panels and displays too
   - Mark inactive/grayed buttons differently

---

## Success Metrics

### Phase 1 Complete When:
- [ ] 50+ annotated screenshots collected
- [ ] Model achieves >80% validation accuracy
- [ ] Live detector finds >90% of visible buttons
- [ ] <5% false positives (detecting buttons that aren't there)

### Phase 2 Complete When:
- [ ] All button functions documented
- [ ] Function classifier >85% accurate
- [ ] Can explain what any clicked button does

### Phase 3 Complete When:
- [ ] AI can execute simple commands (e.g., "land this aircraft")
- [ ] Action sequences work correctly
- [ ] Timing/context awareness demonstrated

---

## Questions to Answer Through Training

1. **Where are the buttons?** → Phase 1
2. **What is this button called?** → Phase 1
3. **What does this button do?** → Phase 2
4. **When should I click it?** → Phase 3
5. **What to click next?** → Phase 3

This is how humans learn software - by observing, experimenting, and building mental models. We're teaching the AI the same way! 🎓
