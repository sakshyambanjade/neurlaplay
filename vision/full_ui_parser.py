import json
import time
import base64
from io import BytesIO
from pathlib import Path

import pyautogui
from PIL import Image

from llm.llm_reasoning import LLMReasoner


def encode_image_to_base64(image_obj) -> str:
    """Convert PIL Image directly to base64 without saving to disk."""
    buffered = BytesIO()
    image_obj.save(buffered, format="PNG")
    return base64.b64encode(buffered.getvalue()).decode("utf-8")


def parse_full_screen() -> dict:
    """Capture full screen and send to Groq vision (no disk writes)."""
    Path("logs").mkdir(exist_ok=True)

    screenshot = pyautogui.screenshot()
    base64_image = encode_image_to_base64(screenshot)

    reasoner = LLMReasoner()
    state = reasoner.parse_screen_with_vision_direct(base64_image)

    session_log = Path("logs") / f"session_{int(time.time())}.json"
    with open(session_log, "w", encoding="utf-8") as f:
        json.dump(state, f, indent=2)

    return state
