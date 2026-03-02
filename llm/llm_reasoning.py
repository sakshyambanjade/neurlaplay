"""
llm_reasoning.py
Module for integrating LLM (Groq/Gemini) reasoning into the ATC bot pipeline.
Handles ambiguous/complex scenarios by querying an LLM and extracting actionable ATC commands.
"""

import os
import json
import base64
from dotenv import load_dotenv
from groq import Groq


def encode_image(image_path: str) -> str:
    with open(image_path, "rb") as f:
        return base64.b64encode(f.read()).decode("utf-8")

class LLMReasoner:
    def __init__(self, api_key=None):
        load_dotenv()
        self.keys = []
        for i in range(1, 10):
            key = os.getenv(f'GROQ_API_KEY_{i}')
            if key and "your_" not in key:
                self.keys.append(key)
        if api_key and api_key not in self.keys:
            self.keys.insert(0, api_key)
        fallback_key = os.getenv('GROQ_API_KEY')
        if fallback_key and "your_" not in fallback_key and fallback_key not in self.keys:
            self.keys.append(fallback_key)
        self.current_key_index = 0
        self.api_key = self.keys[0] if self.keys else api_key
        self.client = Groq(api_key=self.api_key) if self.api_key else None

    def _get_client(self):
        if not self.keys:
            return self.client
        key = self.keys[self.current_key_index]
        self.current_key_index = (self.current_key_index + 1) % len(self.keys)
        return Groq(api_key=key)

    def query_llm(self, prompt, model='llama-3.3-70b-versatile'):
        client = self._get_client()
        if not client:
            return "No Groq API key configured."
        messages = [
            {"role": "system", "content": "You are an expert ATC assistant. Output only actionable ATC instructions."},
            {"role": "user", "content": prompt},
        ]
        chat_completion = client.chat.completions.create(
            messages=messages,
            model=model,
        )
        return chat_completion.choices[0].message.content.strip()

    def parse_screen_with_vision(self, screenshot_path: str) -> dict:
        """Send full screenshot to Groq Llama-4-Scout Vision and return parsed JSON state."""
        client = self._get_client()
        if not client:
            return {"error": "No Groq API key configured"}

        if not os.path.exists(screenshot_path):
            return {"error": f"Screenshot not found: {screenshot_path}"}

        base64_image = encode_image(screenshot_path)
        prompt = """
You are an expert Tower!3D Pro ATC controller.
Analyze this exact screenshot and return ONLY valid JSON with these keys:

{
  "callsign": "N380MO",
  "command_line_text": "N380MO RUNWAY 10 CLEARED TO LAND",
  "progress_bar": {"green": 28, "white": 10, "meaning": "almost at threshold"},
  "visible_buttons": ["CLEARED TO", "GO AROUND", "ENTER FINAL", "TURN", "REPORT", "TAKE NEXT", "CONTACT"],
  "radar_blips": [{"callsign": "N380MO", "heading": 126, "distance": "close", "conflict": false}],
  "strip_list": [{"callsign": "N380MO", "runway": "10", "status": "arrivals"}],
  "adirs_taxiways": ["A", "B", "C", "FG", "28 active"],
  "safety_assessment": "safe to land - no conflicts on DBRITE or ADIRS",
  "recommended_command": "N380MO RUNWAY 10 CLEARED TO LAND"
}

Use ONLY exact Tower!3D style full commands when recommending commands.
"""

        response = client.chat.completions.create(
            model="meta-llama/llama-4-scout-17b-16e-instruct",
            messages=[
                {"role": "system", "content": "You are a precise ATC AI. Always respond with valid JSON only."},
                {
                    "role": "user",
                    "content": [
                        {"type": "text", "text": prompt},
                        {"type": "image_url", "image_url": {"url": f"data:image/png;base64,{base64_image}"}}
                    ]
                }
            ],
            temperature=0.0,
            max_tokens=800
        )

        content = (response.choices[0].message.content or "").strip()
        try:
            return json.loads(content)
        except Exception:
            if "```" in content:
                cleaned = content.replace("```json", "").replace("```", "").strip()
                try:
                    return json.loads(cleaned)
                except Exception:
                    pass
            return {"error": "JSON parse failed", "raw": content}

    def parse_screen_with_vision_direct(
        self, base64_image: str
    ) -> dict:
        """Send base64 image directly (no file I/O) to Groq vision."""
        client = self._get_client()
        if not client:
            return {"error": "No Groq API key configured"}

        prompt = """
You are an expert Tower!3D Pro ATC controller.
Analyze this Tower!3D screenshot and return ONLY valid JSON:

{
  "callsign": "KAP8051",
  "incoming_runway": "28",
  "distance_on_final": 1.0,
  "planes_on_runway_28": 0,
  "planes_in_queue": 3,
  "taxi_clear": true,
  "safe_to_land": true,
  "recommended_command": "KAP8051 RUNWAY 28 CLEARED TO LAND"
}

Extract exact values from STRIP, DBRITE, and ADIRS.
"""

        response = client.chat.completions.create(
            model="meta-llama/llama-4-scout-17b-16e-instruct",
            messages=[
                {
                    "role": "system",
                    "content": "You are a precise ATC AI. Always "
                    "respond with valid JSON only."
                },
                {
                    "role": "user",
                    "content": [
                        {"type": "text", "text": prompt},
                        {
                            "type": "image_url",
                            "image_url": {
                                "url": (
                                    f"data:image/png;base64,"
                                    f"{base64_image}"
                                )
                            }
                        }
                    ]
                }
            ],
            temperature=0.0,
            max_tokens=500
        )

        content = (response.choices[0].message.content or "").strip()
        try:
            return json.loads(content)
        except Exception:
            if "```" in content:
                cleaned = content.replace(
                    "```json", ""
                ).replace("```", "").strip()
                try:
                    return json.loads(cleaned)
                except Exception:
                    pass
            return {"error": "JSON parse failed", "raw": content}

    def get_atc_instruction(self, event_context):
        """
        Given an event context (dict or str), query the LLM for the correct ATC instruction.
        """
        if isinstance(event_context, dict):
            prompt = f"Event: {event_context.get('event_type')}\nDetails: {event_context}"
        else:
            prompt = str(event_context)
        return self.query_llm(prompt)

# Example usage:
# llm = LLMReasoner(api_key='YOUR_API_KEY')
# instruction = llm.get_atc_instruction({'event_type': 'ambiguous_landing', 'callsign': 'UAL123', ...})
