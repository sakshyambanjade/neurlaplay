import os
import json
from dotenv import load_dotenv
from groq import Groq

class ATCReasoningEngine:
    def __init__(self):
        load_dotenv()
        # Collect all available keys from .env
        self.keys = []
        for i in range(1, 10): # Supports up to 9 keys
            key = os.getenv(f"GROQ_API_KEY_{i}")
            if key and "your_" not in key:
                self.keys.append(key)
        
        # Fallback to the single key if provided
        single_key = os.getenv("GROQ_API_KEY")
        if single_key and "your_" not in single_key and single_key not in self.keys:
            self.keys.append(single_key)

        self.current_key_index = 0
        self.model = "meta-llama/llama-4-scout-17b-16e-instruct"
        
        if not self.keys:
            print("WARNING: No Groq API keys found in .env! Reasoning will be disabled.")

    def get_client(self):
        """Returns a Groq client using the next key in rotation."""
        if not self.keys:
            return None
        
        key = self.keys[self.current_key_index]
        self.current_key_index = (self.current_key_index + 1) % len(self.keys)
        return Groq(api_key=key)

    def analyze_situation(self, state_data):
        client = self.get_client()
        if not client:
            return "Reasoning: Offline (Check .env for keys)."
        # Example: Select best command from available options
        available_commands = state_data.get("available_commands", [])
        situation = state_data.get("situation", "")
        # Simple logic: prioritize safety, then efficiency
        if "conflict" in situation.lower():
            if "HOLD POSITION" in available_commands:
                return "HOLD POSITION"
            elif "GO AROUND" in available_commands:
                return "GO AROUND"
        if "arrival" in situation.lower() and "CLEARED TO LAND" in available_commands:
            return "CLEARED TO LAND"
        if "departure" in situation.lower() and "CLEARED FOR TAKEOFF" in available_commands:
            return "CLEARED FOR TAKEOFF"
        # Fallback: pick first available
        if available_commands:
            return available_commands[0]
        return "NO DECISION"

        prompt = f"""
        ROLE: Expert ATC Instructor & Neuro-Systems Researcher.
        
        DATA:
        - Callsign: {state_data['callsign']}
        - Transcript: {state_data['raw_text']}
        - ATC Situation: {state_data.get('situation', 'No data')}
        - Pilot Audio Captured: {state_data.get('pilot_request', 'Silent')}

        ANALYSIS TASK:
        Explain the logical connection between the Pilot's request and the ATC's response. 
        Focus on:
        1. Runway selection (Why 9R vs 9L?).
        2. Sequence management (Is there a conflict?).
        3. Compliance (Did the human follow standard ATC procedures?).
        
        Keep the tone academic and professional for a research publication.
        """

        try:
            completion = client.chat.completions.create(
                model=self.model,
                messages=[{"role": "user", "content": prompt}],
                temperature=0.7,
                max_tokens=512,
                top_p=1,
                stream=False
            )
            return completion.choices[0].message.content
        except Exception as e:
            return f"Reasoning Error (Rate Limit?): {e}"

if __name__ == "__main__":
    engine = ATCReasoningEngine()
    print(f"Initialized with {len(engine.keys)} API Keys.")
