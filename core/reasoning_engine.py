import os
import json
from dotenv import load_dotenv
from groq import Groq

class ATCReasoningEngine:
    SAFE_COMMANDS = ["HOLD POSITION", "GO AROUND", "STANDBY"]

    def query_groq_llm(self, state_data):
        """
        Query Groq LLM for ATC decision or explanation based on current state_data.
        """
        client = self.get_client()
        if not client:
            return "Reasoning: Offline (Check .env for keys)."
        prompt = f"""
        You are an expert ATC instructor. Given the following situation, suggest the best ATC command to issue:
        Situation: {state_data.get('situation', '')}
        Available Commands: {', '.join(state_data.get('available_commands', []))}
        Aircraft: {state_data.get('aircraft', [])}
        Strips: {state_data.get('strips', [])}
        What is the best command to issue and why?
        """
        completion = client.chat.completions.create(
            model=self.model,
            messages=[{"role": "user", "content": prompt}],
            temperature=1,
            max_completion_tokens=512,
            top_p=1,
            stream=True,
            stop=None
        )
        response = ""
        for chunk in completion:
            response += chunk.choices[0].delta.content or ""
        return response

    def decide(self, game_state):
        available_commands = game_state.get('available_commands', [])
        world_state = game_state
        # Priority 1: Handle emergencies first
        if world_state.get('conflict_detected'):
            for safe in self.SAFE_COMMANDS:
                if safe in available_commands:
                    return safe
        # Priority 2: Try rule-based logic
        command = self._apply_rules(available_commands, world_state)
        if command:
            return command
        # Priority 3: Try ML model (if loaded)
        if hasattr(self, 'ml_model') and self.ml_model:
            try:
                cmd = self.ml_model.predict([world_state])
                if cmd and cmd[0] in available_commands:
                    return cmd[0]
            except Exception:
                pass
        # Priority 4: Try LLM for ambiguous/complex scenarios
        try:
            from llm_reasoning import LLMReasoner
            llm = LLMReasoner()
            llm_result = llm.get_atc_instruction(world_state)
            # Only return if result matches available commands
            for cmd in available_commands:
                if cmd.lower() in llm_result.lower():
                    return cmd
        except Exception as e:
            print(f"LLM fallback error: {e}")
        # Priority 5: Always return something safe
        for safe in self.SAFE_COMMANDS:
            if safe in available_commands:
                return safe
        # Last resort: return first available command
        return available_commands[0] if available_commands else None

    def _apply_rules(self, available_commands, world_state):
        # Landing: Aircraft on final approach, runway clear
        if "CLEARED TO LAND" in available_commands:
            if world_state.get('aircraft_on_final') and not world_state.get('runway_occupied'):
                return "CLEARED TO LAND"
        # Taxiing: Aircraft landed and on ground
        if "TAXI TO GATE" in available_commands:
            if world_state.get('aircraft_on_ground'):
                return "TAXI TO GATE"
        if "CONTINUE TAXI" in available_commands:
            if world_state.get('aircraft_taxiing'):
                return "CONTINUE TAXI"
        # Departures: Departure strip ready, runway clear
        if "CLEARED FOR TAKEOFF" in available_commands:
            if world_state.get('departure_ready') and not world_state.get('runway_occupied'):
                return "CLEARED FOR TAKEOFF"
        if "LINE UP AND WAIT" in available_commands:
            if world_state.get('departure_ready') and world_state.get('runway_occupied'):
                return "LINE UP AND WAIT"
        # Arrivals: New arrival strip detected
        if "ENTER FINAL" in available_commands:
            if world_state.get('arrival_strip_new'):
                return "ENTER FINAL"
        # Add more rules as needed for other ATC actions
        return None
    # ML model attributes
    def setup_ml(self):
        try:
            import joblib
            from sklearn.ensemble import RandomForestClassifier
            self.joblib = joblib
            self.RandomForestClassifier = RandomForestClassifier
            self.ml_model = None
            self.confidence_threshold = 0.65
        except ImportError:
            print("ML libraries not installed. ML mode disabled.")
            self.ml_model = None
            self.confidence_threshold = 0.65

    def train_ml(self, dataset):
        """
        Train ML model using dataset (expects .states and .actions).
        """
        if not hasattr(self, 'RandomForestClassifier'):
            self.setup_ml()
        X = [s.to_vector() for s in dataset.states]
        y = dataset.actions
        self.ml_model = self.RandomForestClassifier(n_estimators=100)
        self.ml_model.fit(X, y)
        self.joblib.dump(self.ml_model, 'models/reasoning_model.pkl')

        def decide(self, game_state):
            """
            Hybrid ML + rule-based decision logic.
            """
            if not hasattr(self, 'ml_model'):
                self.setup_ml()
            if self.ml_model:
                try:
                    proba = self.ml_model.predict_proba([game_state.to_vector()])
                    confidence = max(proba[0])
                    if confidence > self.confidence_threshold:
                        return self.ml_model.predict([game_state.to_vector()])[0]
                except Exception as e:
                    print(f"ML decision error: {e}")
            # Fallback to rule-based
            return self.analyze_situation(game_state)
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
        # Use rule-based logic first
        available_commands = state_data.get("available_commands", [])
        situation = state_data.get("situation", "")
        if "conflict" in situation.lower():
            if "HOLD POSITION" in available_commands:
                return "HOLD POSITION"
            elif "GO AROUND" in available_commands:
                return "GO AROUND"
        if "arrival" in situation.lower() and "CLEARED TO LAND" in available_commands:
            return "CLEARED TO LAND"
        if "departure" in situation.lower() and "CLEARED FOR TAKEOFF" in available_commands:
            return "CLEARED FOR TAKEOFF"
        # If no clear rule, ask Groq LLM for advice
        llm_response = self.query_groq_llm(state_data)
        # Try to extract a valid command from LLM response
        for cmd in available_commands:
            if cmd in llm_response:
                return cmd
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