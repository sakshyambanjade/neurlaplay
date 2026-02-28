"""
test_llm_fallback.py
Test script for LLM fallback in ambiguous ATC event scenarios.
"""
from reasoning_engine import ATCReasoningEngine

def test_ambiguous_event():
    # Simulate an ambiguous event where rules/ML cannot decide
    game_state = {
        'available_commands': [
            'CLEARED TO LAND',
            'GO AROUND',
            'HOLD POSITION',
            'TAXI TO GATE',
        ],
        'aircraft_on_final': True,
        'runway_occupied': True,  # Ambiguous: aircraft on final, but runway not clear
        'aircraft': ['UAL123'],
        'strips': ['UAL123 ARR'],
        'situation': 'UAL123 is on final approach, but the runway is currently occupied by another aircraft.',
        'conflict_detected': False,
        'aircraft_on_ground': False,
        'aircraft_taxiing': False,
        'departure_ready': False,
        'arrival_strip_new': False,
    }
    engine = ATCReasoningEngine()
    result = engine.decide(game_state)
    print(f"LLM Fallback Decision: {result}")

if __name__ == "__main__":
    test_ambiguous_event()
