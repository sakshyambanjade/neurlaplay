"""
Airport-Agnostic ATC System Demo
=================================
Example showing how the refactored architecture works together.
This demonstrates the complete flow: Perception → World → Reasoning → Action
"""

import logging
import time
import numpy as np
from pathlib import Path

# Domain models
from domain.models import Aircraft, Position, AircraftStatus, Runway
from domain.airport_topology import AirportTopology, TaxiwayNode, TaxiwayEdge

# Perception layer
from perception.layout_detector import DynamicLayoutDetector
from perception.fuzzy_matcher import FuzzyMatcher

# Core systems
from core.world_model import  ATCWorldModel
from core.conflict_detector import ConflictDetector, ConflictRule

# Utilities
from utils.metrics_collector import MetricsCollector

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


def create_example_topology() -> AirportTopology:
    """
    Create an example airport topology.
    In practice, this would be loaded from config or detected dynamically.
    """
    topology = AirportTopology('KJFK')
    
    # Add runways
    runway_04L = Runway(
        name='04L',
        magnetic_heading=40,
        length_feet=11351,
        width_feet=200,
        threshold_position=Position(lat=40.639722, lon=-73.778889, altitude_ft=13)
    )
    topology.add_runway(runway_04L)
    
    runway_22R = Runway(
        name='22R',
        magnetic_heading=220,
        length_feet=11351,
        width_feet=200,
        threshold_position=Position(lat=40.644444, lon=-73.790278, altitude_ft=13)
    )
    topology.add_runway(runway_22R)
    
    # Add taxiway nodes
    node_a1 = TaxiwayNode(
        node_id='A1',
        position=Position(lat=40.640, lon=-73.780, altitude_ft=13),
        node_type='intersection',
        runways_accessible=['04L']
    )
    topology.add_node(node_a1)
    
    # Add edges
    edge = TaxiwayEdge(
        from_node='A1',
        to_node='04L_threshold',
        distance_meters=500,
        taxiway_name='A',
        bidirectional=True
    )
    topology.add_edge(edge)
    
    # Validate
    topology.validate_topology()
    
    return topology


def simulate_perception_update() -> dict:
    """
    Simulate what the perception layer would return.
    In practice, this comes from screen capture + OCR + radar detection.
    """
    return {
        'aircraft': [
            {
                'callsign': 'UAL123',
                'position': (40.64, -73.78),
                'altitude': 2500,
                'heading': 40,
                'speed': 180,
                'status': 'ON_APPROACH',
                'type': 'B738',
                'weight_class': 'MEDIUM'
            },
            {
                'callsign': 'DAL456',
                'position': (40.65, -73.79),
                'altitude': 3000,
                'heading': 220,
                'speed': 200,
                'status': 'IN_FLIGHT',
                'type': 'B752',
                'weight_class': 'MEDIUM'
            },
            {
                'callsign': 'BAW117',
                'position': (40.64, -73.785),
                'altitude': 2000,
                'heading': 40,
                'speed': 160,
                'status': 'ON_FINAL',
                'type': 'B744',
                'weight_class': 'HEAVY'
            }
        ],
        'wind': {
            'direction': 50,
            'speed': 12
        },
        'active_runways': ['04L', '04R']
    }


def demo_layout_detection():
    """Demonstrate dynamic layout detection."""
    print("\n=== LAYOUT DETECTION DEMO ===")
    
    # Create detector
    detector = DynamicLayoutDetector()
    
    # Simulate a screenshot (in practice, captured from game)
    fake_screenshot = np.zeros((1080, 1920, 3), dtype=np.uint8)
    
    # Detect regions
    regions = detector.detect_all_regions(fake_screenshot)
    
    print(f"Detected {len(regions)} UI regions:")
    for name, region in regions.items():
        if region:
            print(f"  {name}: ({region.x}, {region.y}) {region.width}x{region.height} (confidence: {region.confidence:.2f})")


def demo_fuzzy_matching():
    """Demonstrate fuzzy OCR matching."""
    print("\n=== FUZZY MATCHING DEMO ===")
    
    matcher = FuzzyMatcher()
    
    # Known aircraft in the system
    known_callsigns = ['UAL123', 'DAL456', 'BAW117', 'AAL789']
    
    # OCR outputs with errors
    ocr_outputs = [
        'UA1123',   # Missing L
        'DAL45G',   # 6 confused with G
        '0AL456',   # D confused with 0
        'BAW1I7',   # 1 confused with I
        'UNKNOWN99' # Not in system
    ]
    
    print("Matching OCR errors to known callsigns:")
    for ocr_text in ocr_outputs:
        match = matcher.match_callsign(ocr_text, known_callsigns)
        if match:
            print(f"  '{ocr_text}' → '{match.matched_value}' (confidence: {match.confidence:.1f}%, method: {match.method})")
        else:
            print(f"  '{ocr_text}' → NO MATCH")


def demo_world_model():
    """Demonstrate the complete world model system."""
    print("\n=== WORLD MODEL DEMO ===")
    
    # Create topology
    topology = create_example_topology()
    
    # Create conflict rules
    rules = ConflictRule(
        horizontal_separation_nm=3.0,
        vertical_separation_ft=1000.0
    )
    
    # Create metrics collector
    metrics = MetricsCollector(session_id='demo_session')
    
    # Create world model
    world = ATCWorldModel(
        airport_topology=topology,
        conflict_rules=rules,
        metrics_collector=metrics
    )
    
    # Simulate multiple perception updates
    print("\nSimulating 5 perception updates...")
    for i in range(5):
        # Get simulated perception data
        perception_data = simulate_perception_update()
        
        # Update world model
        world.update_from_perception(perception_data)
        
        # Print situation
        if i == 0 or i == 4:  # Print first and last
            print(f"\n--- Update {i+1} ---")
            print(world.get_situation_summary())
        
        time.sleep(0.5)
    
    # Show metrics
    print("\n--- Performance Metrics ---")
    print(metrics.get_performance_summary())
    
    # Demonstrate conflict detection
    print("\n--- Conflict Detection ---")
    print(world.conflict_detector.get_conflict_summary())
    
    # Demonstrate aircraft queries
    print("\n--- Aircraft Queries ---")
    ac = world.get_aircraft('UAL123')
    if ac:
        print(f"UAL123: {ac.status.name} at {ac.position.altitude_ft}ft, {ac.speed_knots}kts")
        closest = world.get_closest_aircraft('UAL123', max_count=2)
        print(f"Closest aircraft to UAL123:")
        for callsign, distance in closest:
            print(f"  {callsign}: {distance:.2f}nm")
    
    # Demonstrate runway operations
    print("\n--- Runway Operations ---")
    for runway_name in topology.runways.keys():
        is_clear = world.is_runway_clear(runway_name)
        on_runway = world.get_aircraft_on_runway(runway_name)
        print(f"{runway_name}: {'CLEAR' if is_clear else 'OCCUPIED'} ({len(on_runway)} aircraft)")


def demo_conflict_resolution():
    """Demonstrate conflict detection and resolution logic."""
    print("\n=== CONFLICT RESOLUTION DEMO ===")
    
    # Create two aircraft too close together
    ac1 = Aircraft(
        callsign='TEST1',
        aircraft_type='B738',
        position=Position(lat=40.64, lon=-73.78, altitude_ft=3000),
        status=AircraftStatus.IN_FLIGHT,
        heading=90,
        speed_knots=250,
        weight_class='MEDIUM'
    )
    
    ac2 = Aircraft(
        callsign='TEST2',
        aircraft_type='A320',
        position=Position(lat=40.64, lon=-73.77, altitude_ft=3000),  # Too close!
        status=AircraftStatus.IN_FLIGHT,
        heading=90,
        speed_knots=250,
        weight_class='MEDIUM'
    )
    
    # Calculate separation
    separation = ac1.separation_from(ac2)
    print(f"Separation between TEST1 and TEST2: {separation:.2f}nm")
    
    # Run conflict detector
    detector = ConflictDetector()
    conflicts = detector.detect_all_conflicts([ac1, ac2], [])
    
    print(f"\nDetected {len(conflicts)} conflicts:")
    for conflict in conflicts:
        print(f"  {conflict.severity.upper()}: {conflict.description}")


def main():
    """Run all demos."""
    print("╔════════════════════════════════════════════════════════╗")
    print("║  AIRPORT-AGNOSTIC ATC SYSTEM DEMONSTRATION            ║")
    print("║  Showing refactored architecture components           ║")
    print("╚════════════════════════════════════════════════════════╝")
    
    try:
        demo_layout_detection()
        demo_fuzzy_matching()
        demo_world_model()
        demo_conflict_resolution()
        
        print("\n" + "="*60)
        print("DEMONSTRATION COMPLETE")
        print("="*60)
        print("\nKey Improvements Demonstrated:")
        print("✓ Airport-agnostic domain models (works with any airport)")
        print("✓ Dynamic layout detection (no hardcoded coordinates)")
        print("✓ Fuzzy OCR matching (handles text recognition errors)")
        print("✓ Conflict detection with separation standards")
        print("✓ Metrics collection for research analysis")
        print("✓ Clean separation: Perception → World → Decision")
        
    except Exception as e:
        logger.error(f"Demo failed: {e}", exc_info=True)
        raise


if __name__ == '__main__':
    main()
