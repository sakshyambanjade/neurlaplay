"""
test_llm_fallback.py
Test script for LLM fallback in ambiguous ATC event scenarios.
"""
from llm.llm_reasoning import LLMReasoner

def test_ambiguous_event():
    # Simulate an ambiguous event where rules/ML cannot decide
    event_context = {
        'event_type': 'ambiguous_landing',
        'callsign': 'UAL123',
        'situation': 'UAL123 is on final approach, but the runway is currently occupied by another aircraft.',
        'available_commands': [
            'CLEARED TO LAND',
            'GO AROUND',
            'HOLD POSITION',
            'TAXI TO GATE',
        ],
    }
    llm = LLMReasoner()
    result = llm.get_atc_instruction(event_context)
    print(f"LLM Fallback Decision: {result}")

if __name__ == "__main__":
    test_ambiguous_event()
