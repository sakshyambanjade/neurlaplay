# 🎮 Game Auto-Launch Guide

## Overview

The bot can now **automatically find and launch Tower 3D Pro** for you! No more manual clicking through menus every time you want to test.

## Quick Start

### Option 1: Launch + Run Bot (One Command)

```bash
# Launch game and start interactive mode
python run_atc_bot.py --mode interactive --launch --airport KJFK

# Launch game and run fully autonomous
python run_atc_bot.py --mode live --launch --airport KLAX

# Launch game and record your gameplay
python run_atc_bot.py --mode training --launch --airport EGLL
```

**What happens:**
1. ✅ Bot finds Tower.exe automatically
2. ✅ Launches the game
3. ✅ Waits for it to load (15 seconds)
4. ✅ Prompts you to click through menus (Select airport → Start)
5. ✅ Bot starts once you're in the session

---

### Option 2: Launch Game Only (Test First)

```bash
# Just launch the game
python launch_game.py

# Launch specific airport
python launch_game.py KLAX

# Try experimental auto-navigation (clicks menus for you)
python launch_game.py KJFK --auto
```

**Use this to:**
- Test if game launches correctly
- Verify game path detection works
- Practice menu navigation
- Then run bot separately with `python run_atc_bot.py --mode interactive`

---

## Command Reference

### `run_atc_bot.py` (Main Bot)

```bash
python run_atc_bot.py [OPTIONS]

Options:
  --mode {live|interactive|training}
      Bot operating mode (default: live)
      
  --launch
      Automatically launch Tower 3D Pro
      
  --airport CODE
      Airport to load (default: KJFK)
      Examples: KJFK, KLAX, EGLL, LFPG, EDDF, RJTT
      
  --auto-nav
      Try to click through menus automatically (EXPERIMENTAL)
      May not work - click manually if it fails

Examples:
  # Simplest: Just start bot (game already running)
  python run_atc_bot.py --mode interactive
  
  # With auto-launch
  python run_atc_bot.py --mode interactive --launch
  
  # Different airport
  python run_atc_bot.py --mode live --launch --airport KLAX
  
  # Try automatic menu clicking (may fail)
  python run_atc_bot.py --mode live --launch --airport KJFK --auto-nav
```

---

### `launch_game.py` (Standalone Launcher)

```bash
python launch_game.py [AIRPORT] [--auto]

Arguments:
  AIRPORT     Airport code (default: KJFK)
  --auto      Try automatic menu navigation (experimental)

Examples:
  python launch_game.py              # KJFK, manual menus
  python launch_game.py KLAX         # KLAX, manual menus
  python launch_game.py KJFK --auto  # KJFK, auto menus (experimental)
```

---

## How It Works

### Automatic Game Detection

The launcher searches these locations:
```
d:\Tower.3D.Pro.v7927862\Tower.exe
d:\Tower.3D.Pro.v7927862\Tower3D.exe
d:\Tower.3D.Pro.v7927862\mmwindow\mmwindow.exe
../Tower.exe (relative to bot directory)
```

**If your game is elsewhere:**
Edit `utils/game_launcher.py` line 40 to add your path.

---

### Menu Navigation

#### Manual Mode (Recommended)
```bash
python run_atc_bot.py --mode interactive --launch
```

**You see:**
```
=== LAUNCHING TOWER 3D PRO ===
Game process started (PID: 12345)
Waiting 15 seconds for game to load...
Game launched successfully!

Manual mode: Please click through menus yourself
1. Select airport: KJFK
2. Click Start Session
3. Wait for traffic to appear

Press Enter when ready...
```

**You do:**
1. Alt+Tab to game
2. Click airport selection
3. Click Start Session
4. Alt+Tab back to console
5. Press Enter

**Bot starts!**

---

#### Auto-Navigation Mode (Experimental)
```bash
python run_atc_bot.py --mode interactive --launch --auto-nav
```

**What it tries:**
- Click "Continue" button (center of screen)
- Type airport code in search
- Click airport in list
- Click "Start Session" button

**⚠️ May not work because:**
- Button positions vary by resolution
- Menu layout changes between game versions
- Timing issues

**If it fails:**
- Run without `--auto-nav`
- Click menus manually
- Or use `launch_game.py` first to test

---

## Setup & Installation

### 1. Install New Dependencies

```bash
pip install psutil pywin32
```

Or reinstall everything:
```bash
pip install -r requirements.txt
```

**New packages:**
- `psutil` - Detect if game is already running
- `pywin32` - Find and control game window

---

### 2. Test the Launcher

```bash
# Simple test
python launch_game.py
```

**Expected output:**
```
=== TOWER 3D PRO - QUICK LAUNCHER ===
Selected airport: KJFK
Auto-navigate: No (you click menus)

Launching game: d:\Tower.3D.Pro.v7927862\Tower.exe
Game process started (PID: 12345)
Waiting 15 seconds for game to load...
Game window brought to front

✓ SUCCESS - GAME IS READY!
```

**If you see errors:**
- Check game installation path
- Close any existing Tower 3D instances
- Run as administrator
- Check `utils/game_launcher.py` line 40 for paths

---

### 3. Run the Full Bot

```bash
python run_atc_bot.py --mode interactive --launch --airport KJFK
```

---

## Troubleshooting

### "Could not find Tower 3D Pro executable"

**Fix:** Edit `utils/game_launcher.py` and add your game path:

```python
# Line 40-50
possible_paths = [
    r"d:\Tower.3D.Pro.v7927862\Tower.exe",
    r"C:\Your\Custom\Path\Tower.exe",  # ADD YOUR PATH HERE
    # ... existing paths
]
```

---

### "Game already running"

The launcher detects existing instances.

**Options:**
1. Let it use the existing instance
2. Close the game first: Task Manager → End Task
3. Run bot without `--launch` flag

---

### "Window not found"

Game launched but window detection failed.

**Try:**
```python
# In game_launcher.py line 180, increase wait time
self.launch_game(wait_time=30)  # Default is 15
```

---

### "Auto-navigation failed"

Menu clicking didn't work.

**Solution:** Run without `--auto-nav`:
```bash
python run_atc_bot.py --mode interactive --launch
```

Click menus manually when prompted.

---

### Game won't close automatically

**Manual close:**
- Task Manager → Tower.exe → End Task
- Or let it keep running for next session

**Fix auto-close:**
Check if you have admin rights (needed for process termination)

---

## Advanced Usage

### Custom Game Path

```bash
# Set environment variable
set TOWER3D_PATH=C:\Custom\Path\Tower.exe
python run_atc_bot.py --launch
```

Or hardcode in `launch_game.py`:
```python
launcher = GameLauncher(game_path=r"C:\Custom\Path\Tower.exe")
```

---

### Keep Game Running Between Sessions

```bash
# Launch once
python launch_game.py

# Run multiple bot sessions without relaunching
python run_atc_bot.py --mode interactive
python run_atc_bot.py --mode training
python run_atc_bot.py --mode live
```

---

### Run on Different Monitors

The launcher brings the game window to the foreground automatically.

**If you want it on a specific monitor:**
1. Launch game manually
2. Drag to desired monitor
3. Run bot without `--launch` flag

---

## Testing Checklist

Before running with real bot:

- [ ] Test standalone launcher: `python launch_game.py`
- [ ] Verify game launches
- [ ] Check window detection works
- [ ] Test manual menu navigation
- [ ] Try auto-nav (if feeling brave)
- [ ] Confirm session starts correctly
- [ ] Run bot: `python run_atc_bot.py --mode interactive --launch`

---

## Comparison: Before vs After

| Task | Before | After |
|------|--------|-------|
| Launch game | Manual clicking | `--launch` flag |
| Select airport | Click through menus | `--airport KJFK` |
| Start session | Manual | Prompted or auto |
| Run bot | Separate steps | One command |
| Testing | Tedious | Fast iterations |

---

## Full Example Session

```bash
# Terminal 1: Navigate to bot directory
cd D:\Tower.3D.Pro.v7927862\Tower3D_AI_Bot
.venv\Scripts\Activate.ps1

# Launch game + start bot in interactive mode at KLAX
python run_atc_bot.py --mode interactive --launch --airport KLAX

# What happens:
# 1. Game launches automatically
# 2. Wait 15 seconds for load
# 3. Console prompts: "Click through menus, then press Enter"
# 4. You: Alt+Tab to game, select KLAX, click Start
# 5. You: Alt+Tab back, press Enter
# 6. Bot starts suggesting commands
# 7. You: Press 'y' to accept or 'n' to skip

# When done:
# Ctrl+C to stop bot
# Choose whether to close game (y/n)
```

---

## Tips & Best Practices

✅ **DO:**
- Test `launch_game.py` first before full bot
- Use `--launch` for quick iterations
- Use manual menu navigation (more reliable)
- Keep game running between short tests
- Check Task Manager if launch seems stuck

❌ **DON'T:**
- Use `--auto-nav` on first try (test manually first)
- Launch multiple instances (wastes memory)
- Forget to activate virtual environment
- Close bot during delicate operations

---

## Future Enhancements

Planned features:
- [ ] Better menu detection (image recognition)
- [ ] Save/load scenarios automatically
- [ ] Multi-monitor support
- [ ] Headless mode (game runs hidden)
- [ ] Auto-restart on crash

---

**You're all set! The game launcher makes testing 10x faster. Enjoy!** 🚀
