"""
Automatic Game Launcher
=======================
Finds and launches Tower 3D Pro, handles menu navigation,
and prepares the game for bot control.
"""

import subprocess
import time
import logging
import os
from pathlib import Path
from typing import Optional, Tuple
import pyautogui
import psutil
import win32gui
import win32con

logger = logging.getLogger(__name__)


class GameLauncher:
    """
    Automatically launches Tower 3D Pro and prepares it for bot control.
    """
    
    def __init__(self, game_path: Optional[str] = None):
        """
        Initialize game launcher.
        
        Args:
            game_path: Path to Tower.exe (auto-detected if None)
        """
        self.game_path = game_path or self._find_game_executable()
        self.game_process: Optional[subprocess.Popen] = None
        self.game_window_handle: Optional[int] = None
        
        # Safety: slow down PyAutoGUI to avoid menu issues
        pyautogui.PAUSE = 0.5
        
        logger.info(f"Game launcher initialized with path: {self.game_path}")
    
    def _find_game_executable(self) -> str:
        """
        Auto-detect Tower 3D Pro executable.
        
        Returns:
            Path to Tower.exe
        
        Raises:
            FileNotFoundError: If game not found
        """
        # Common locations
        possible_paths = [
            r"d:\Tower.3D.Pro.v7927862\Tower.exe",
            r"d:\Tower.3D.Pro.v7927862\Tower3D.exe",
            r"d:\Tower.3D.Pro.v7927862\mmwindow\mmwindow.exe",
            # Relative to current directory
            os.path.join(os.getcwd(), "..", "Tower.exe"),
            os.path.join(os.getcwd(), "..", "Tower3D.exe"),
        ]
        
        for path in possible_paths:
            if os.path.exists(path):
                logger.info(f"Found game executable: {path}")
                return path
        
        raise FileNotFoundError(
            "Could not find Tower 3D Pro executable. "
            "Please specify game_path parameter or check installation."
        )
    
    def is_game_running(self) -> bool:
        """Check if Tower 3D is already running."""
        for proc in psutil.process_iter(['name']):
            try:
                if proc.info['name'].lower() in ['tower.exe', 'tower3d.exe']:
                    logger.info(f"Game already running (PID: {proc.pid})")
                    return True
            except (psutil.NoSuchProcess, psutil.AccessDenied):
                continue
        return False
    
    def launch_game(self, wait_time: int = 15) -> bool:
        """
        Launch the game executable.
        
        Args:
            wait_time: Seconds to wait for game to load
        
        Returns:
            True if launched successfully
        """
        if self.is_game_running():
            logger.info("Game already running, skipping launch")
            self._find_game_window()
            return True
        
        try:
            logger.info(f"Launching game: {self.game_path}")
            
            # Launch the game
            self.game_process = subprocess.Popen(
                [self.game_path],
                cwd=os.path.dirname(self.game_path),
                stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL
            )
            
            logger.info(f"Game process started (PID: {self.game_process.pid})")
            logger.info(f"Waiting {wait_time} seconds for game to load...")
            time.sleep(wait_time)
            
            # Find game window
            if self._find_game_window():
                self._bring_to_front()
                logger.info("Game launched successfully!")
                return True
            else:
                logger.warning("Game launched but window not found")
                return False
                
        except Exception as e:
            logger.error(f"Failed to launch game: {e}")
            return False
    
    def _find_game_window(self) -> bool:
        """
        Find the game window handle.
        
        Returns:
            True if window found
        """
        def callback(hwnd, windows):
            if win32gui.IsWindowVisible(hwnd):
                title = win32gui.GetWindowText(hwnd)
                if 'tower' in title.lower() or 'tower 3d' in title.lower():
                    windows.append(hwnd)
        
        windows = []
        win32gui.EnumWindows(callback, windows)
        
        if windows:
            self.game_window_handle = windows[0]
            title = win32gui.GetWindowText(self.game_window_handle)
            logger.info(f"Found game window: '{title}' (handle: {self.game_window_handle})")
            return True
        
        logger.warning("Game window not found")
        return False
    
    def _bring_to_front(self):
        """Bring game window to foreground."""
        if self.game_window_handle:
            try:
                win32gui.ShowWindow(self.game_window_handle, win32con.SW_RESTORE)
                win32gui.SetForegroundWindow(self.game_window_handle)
                time.sleep(0.5)
                logger.info("Game window brought to front")
            except Exception as e:
                logger.warning(f"Could not bring window to front: {e}")
    
    def get_window_position(self) -> Optional[Tuple[int, int, int, int]]:
        """
        Get game window position and size.
        
        Returns:
            (left, top, right, bottom) or None
        """
        if self.game_window_handle:
            try:
                rect = win32gui.GetWindowRect(self.game_window_handle)
                logger.debug(f"Window position: {rect}")
                return rect
            except Exception as e:
                logger.error(f"Could not get window position: {e}")
        return None
    
    def click_start_menu(self, airport_code: str = "KJFK") -> bool:
        """
        Navigate through game menus to start a session.
        
        This is experimental - coordinates may need adjustment.
        
        Args:
            airport_code: Airport to load (KJFK, KLAX, etc.)
        
        Returns:
            True if menu navigation succeeded
        """
        if not self.game_window_handle:
            logger.error("Cannot navigate menus - window not found")
            return False
        
        try:
            self._bring_to_front()
            time.sleep(2)
            
            # Get window center for reference
            rect = self.get_window_position()
            if not rect:
                return False
            
            left, top, right, bottom = rect
            width = right - left
            height = bottom - top
            center_x = left + width // 2
            center_y = top + height // 2
            
            logger.info("Attempting to navigate game menus...")
            logger.warning("This is experimental - manual clicks may be needed")
            
            # Click "Continue" or "Start" (center of screen, slightly below middle)
            click_x = center_x
            click_y = center_y + 50
            logger.info(f"Clicking continue button at ({click_x}, {click_y})")
            pyautogui.click(click_x, click_y)
            time.sleep(2)
            
            # Type airport code in search/filter
            logger.info(f"Typing airport code: {airport_code}")
            pyautogui.write(airport_code, interval=0.1)
            time.sleep(1)
            
            # Click airport in list (assume it's now highlighted)
            logger.info("Clicking airport selection")
            pyautogui.click(center_x, center_y)
            time.sleep(2)
            
            # Click "Start Session" button (lower part of screen)
            click_y = top + int(height * 0.75)
            logger.info(f"Clicking start session at ({click_x}, {click_y})")
            pyautogui.click(click_x, click_y)
            time.sleep(5)
            
            logger.info("Menu navigation complete - session should be starting")
            return True
            
        except Exception as e:
            logger.error(f"Menu navigation failed: {e}")
            return False
    
    def wait_for_session_ready(self, timeout: int = 60) -> bool:
        """
        Wait for game session to be ready (traffic starts appearing).
        
        Args:
            timeout: Maximum seconds to wait
        
        Returns:
            True if session appears ready
        """
        logger.info(f"Waiting up to {timeout}s for session to be ready...")
        
        start_time = time.time()
        while time.time() - start_time < timeout:
            # Simple check: just wait and assume it's ready
            # More sophisticated: could check for UI elements
            if time.time() - start_time > 20:
                logger.info("Session assumed ready after 20 seconds")
                return True
            time.sleep(2)
        
        logger.warning("Timeout waiting for session")
        return False
    
    def close_game(self):
        """Close the game gracefully."""
        if self.game_process:
            try:
                logger.info("Closing game...")
                self.game_process.terminate()
                self.game_process.wait(timeout=10)
                logger.info("Game closed")
            except Exception as e:
                logger.warning(f"Could not close game gracefully: {e}")
                try:
                    self.game_process.kill()
                except:
                    pass
    
    def full_auto_launch(self, airport_code: str = "KJFK", 
                         auto_navigate: bool = True) -> bool:
        """
        Complete automated launch sequence.
        
        Args:
            airport_code: Airport to load
            auto_navigate: Try to navigate menus automatically
        
        Returns:
            True if fully ready for bot control
        """
        logger.info("=" * 60)
        logger.info("AUTOMATED GAME LAUNCH SEQUENCE")
        logger.info("=" * 60)
        
        # Step 1: Launch game
        if not self.launch_game():
            logger.error("Failed to launch game")
            return False
        
        # Step 2: Navigate menus (if enabled)
        if auto_navigate:
            logger.info("\nAttempting automatic menu navigation...")
            logger.warning("If this fails, click through menus manually.")
            logger.warning("Press Ctrl+C to abort and do it manually.")
            
            time.sleep(3)  # Give user time to read
            
            if not self.click_start_menu(airport_code):
                logger.warning("Auto-navigation failed - please click menus manually")
                input("Press Enter when you've started a session...")
        else:
            logger.info("\nManual mode: Please click through menus yourself")
            logger.info(f"1. Select airport: {airport_code}")
            logger.info("2. Click Start Session")
            logger.info("3. Wait for traffic to appear")
            input("\nPress Enter when ready...")
        
        # Step 3: Wait for session
        self.wait_for_session_ready()
        
        # Step 4: Bring to front one more time
        self._bring_to_front()
        
        logger.info("=" * 60)
        logger.info("GAME READY FOR BOT CONTROL")
        logger.info("=" * 60)
        return True


def quick_launch(airport_code: str = "KJFK", auto_navigate: bool = False) -> GameLauncher:
    """
    Quick launch helper function.
    
    Args:
        airport_code: Airport to load
        auto_navigate: Try automatic menu clicking (experimental)
    
    Returns:
        GameLauncher instance
    
    Example:
        >>> launcher = quick_launch("KJFK", auto_navigate=False)
        >>> # Game is now running and ready
    """
    launcher = GameLauncher()
    launcher.full_auto_launch(airport_code, auto_navigate)
    return launcher


if __name__ == "__main__":
    # Test the launcher
    logging.basicConfig(
        level=logging.INFO,
        format='%(asctime)s - %(levelname)s - %(message)s'
    )
    
    print("\n" + "=" * 60)
    print("TOWER 3D GAME LAUNCHER TEST")
    print("=" * 60)
    print("\nThis will:")
    print("1. Find and launch Tower.exe")
    print("2. Wait for game to load")
    print("3. Prompt you to click through menus")
    print("4. Prepare for bot control")
    print("\nPress Ctrl+C to cancel\n")
    
    try:
        time.sleep(2)
        launcher = quick_launch("KJFK", auto_navigate=False)
        print("\n✓ Game successfully launched and ready!")
        print("✓ You can now run the bot with: python run_atc_bot.py")
        
    except KeyboardInterrupt:
        print("\n\nCancelled by user")
    except Exception as e:
        print(f"\n✗ Launch failed: {e}")
