"""
Refactored World Model
======================
Airport-agnostic world state using domain objects.
This is the "brain" that maintains situational awareness.
"""

import logging
from typing import Dict, List, Optional, Tuple
from dataclasses import dataclass
import time

from domain.models import Aircraft, Position, AircraftStatus, Runway
from domain.airport_topology import AirportTopology
from core.conflict_detector import ConflictDetector, ConflictRule
from utils.metrics_collector import MetricsCollector

logger = logging.getLogger(__name__)


@dataclass
class WorldState:
    """
    Complete representation of the current ATC situation.
    """
    timestamp: float
    aircraft: Dict[str, Aircraft]  # callsign -> Aircraft
    active_runways: List[str]
    wind_direction: float
    wind_speed: float
    conflicts: List[str]  # Current conflict descriptions
    
    def get_aircraft_count(self) -> int:
        """Get total number of tracked aircraft."""
        return len(self.aircraft)
    
    def get_airborne_count(self) -> int:
        """Get number of airborne aircraft."""
        return sum(1 for ac in self.aircraft.values() 
                  if ac.status != AircraftStatus.ON_GROUND)


class ATCWorldModel:
    """
    Airport-agnostic world model using domain objects.
    Tracks all aircraft, detects conflicts, maintains airport topology.
    """
    
    def __init__(self, 
                 airport_topology: Optional[AirportTopology] = None,
                 conflict_rules: Optional[ConflictRule] = None,
                 metrics_collector: Optional[MetricsCollector] = None):
        """
        Initialize world model.
        
        Args:
            airport_topology: Airport layout and runway configuration
            conflict_rules: Rules for conflict detection
            metrics_collector: Optional metrics tracking
        """
        self.topology = airport_topology
        self.conflict_detector = ConflictDetector(conflict_rules)
        self.metrics = metrics_collector
        
        # Core state
        self.aircraft: Dict[str, Aircraft] = {}
        self.wind_direction: float = 0.0
        self.wind_speed: float = 0.0
        self.active_runways: List[str] = []
        
        # Tracking
        self.last_update_time: float = time.time()
        self.update_count: int = 0
        
        logger.info("ATCWorldModel initialized")
    
    def update_from_perception(self, perception_data: Dict):
        """
        Update world state from perception layer output.
        
        Args:
            perception_data: Dictionary with detected aircraft, wind, etc.
                {
                    'aircraft': [{'callsign': 'UAL123', 'position': (x, y), ...}, ...],
                    'wind': {'direction': 270, 'speed': 15},
                    'active_runways': ['04L', '04R']
                }
        """
        current_time = time.time()
        dt = current_time - self.last_update_time
        
        # Update wind
        if 'wind' in perception_data:
            self.wind_direction = perception_data['wind'].get('direction', 0)
            self.wind_speed = perception_data['wind'].get('speed', 0)
        
        # Update active runways
        if 'active_runways' in perception_data:
            self.active_runways = perception_data['active_runways']
        
        # Update aircraft
        detected_callsigns = set()
        for ac_data in perception_data.get('aircraft', []):
            callsign = ac_data['callsign']
            detected_callsigns.add(callsign)
            
            if callsign in self.aircraft:
                # Update existing aircraft
                self._update_aircraft(callsign, ac_data, dt)
            else:
                # New aircraft entry
                self._add_aircraft(callsign, ac_data)
        
        # Remove aircraft that are no longer detected
        current_callsigns = set(self.aircraft.keys())
        exited_callsigns = current_callsigns - detected_callsigns
        for callsign in exited_callsigns:
            self._remove_aircraft(callsign)
        
        # Run conflict detection
        self._detect_conflicts()
        
        # Update metrics
        if self.metrics:
            self.metrics.record_aircraft_count(len(self.aircraft))
        
        self.last_update_time = current_time
        self.update_count += 1
        
        logger.debug(f"World model updated: {len(self.aircraft)} aircraft tracked")
    
    def _add_aircraft(self, callsign: str, data: Dict):
        """Add newly detected aircraft."""
        position = Position(
            lat=data['position'][0],
            lon=data['position'][1],
            altitude_ft=data.get('altitude', 0)
        )
        
        aircraft = Aircraft(
            callsign=callsign,
            aircraft_type=data.get('type', 'UNKNOWN'),
            position=position,
            status=AircraftStatus[data.get('status', 'IN_FLIGHT')],
            heading=data.get('heading', 0),
            speed_knots=data.get('speed', 0),
            weight_class=data.get('weight_class', 'MEDIUM')
        )
        
        self.aircraft[callsign] = aircraft
        
        if self.metrics:
            # Determine operation type from initial status
            op_type = 'arrival' if aircraft.status == AircraftStatus.ON_APPROACH else 'departure'
            self.metrics.record_aircraft_entry(callsign, op_type)
        
        logger.info(f"Aircraft entered: {callsign} ({aircraft.aircraft_type})")
    
    def _update_aircraft(self, callsign: str, data: Dict, dt: float):
        """Update existing aircraft with new data."""
        aircraft = self.aircraft[callsign]
        
        new_position = Position(
            lat=data['position'][0],
            lon=data['position'][1],
            altitude_ft=data.get('altitude', aircraft.position.altitude_ft)
        )
        
        # Update position (this automatically updates velocity history)
        aircraft.update_position(new_position, dt)
        
        # Update other attributes
        aircraft.heading = data.get('heading', aircraft.heading)
        aircraft.speed_knots = data.get('speed', aircraft.speed_knots)
        
        # Update status
        new_status = data.get('status')
        if new_status and new_status != aircraft.status.name:
            aircraft.status = AircraftStatus[new_status]
            logger.debug(f"{callsign} status changed to {aircraft.status.name}")
    
    def _remove_aircraft(self, callsign: str):
        """Remove aircraft that exited the airspace."""
        if callsign in self.aircraft:
            aircraft = self.aircraft[callsign]
            
            if self.metrics:
                # Determine if exit was successful
                successful = aircraft.status in [
                    AircraftStatus.LANDED,
                    AircraftStatus.DEPARTED
                ]
                self.metrics.record_aircraft_exit(callsign, successful)
            
            del self.aircraft[callsign]
            logger.info(f"Aircraft exited: {callsign}")
    
    def _detect_conflicts(self):
        """Run conflict detection on all aircraft."""
        if not self.aircraft:
            return
        
        aircraft_list = list(self.aircraft.values())
        runways = list(self.topology.runways.values()) if self.topology else []
        
        conflicts = self.conflict_detector.detect_all_conflicts(aircraft_list, runways)
        
        # Record conflicts in metrics
        if self.metrics:
            for conflict in conflicts:
                self.metrics.record_conflict(conflict)
    
    def get_aircraft(self, callsign: str) -> Optional[Aircraft]:
        """Get aircraft by callsign."""
        return self.aircraft.get(callsign)
    
    def get_all_aircraft(self) -> List[Aircraft]:
        """Get list of all tracked aircraft."""
        return list(self.aircraft.values())
    
    def get_aircraft_by_status(self, status: AircraftStatus) -> List[Aircraft]:
        """Get all aircraft with a specific status."""
        return [ac for ac in self.aircraft.values() if ac.status == status]
    
    def get_aircraft_on_runway(self, runway_name: str) -> List[Aircraft]:
        """Get all aircraft currently on a specific runway."""
        return [ac for ac in self.aircraft.values() 
                if ac.assigned_runway == runway_name and 
                ac.status in [AircraftStatus.ON_RUNWAY, 
                            AircraftStatus.TAKING_OFF,
                            AircraftStatus.LANDING]]
    
    def is_runway_clear(self, runway_name: str) -> bool:
        """Check if a runway is clear for operations."""
        return len(self.get_aircraft_on_runway(runway_name)) == 0
    
    def get_conflicts_for_aircraft(self, callsign: str) -> List[str]:
        """Get all active conflicts involving an aircraft."""
        conflicts = self.conflict_detector.get_conflicts_for_aircraft(callsign)
        return [c.description for c in conflicts]
    
    def get_closest_aircraft(self, callsign: str, max_count: int = 5) -> List[Tuple[str, float]]:
        """
        Get the N closest aircraft to a given aircraft.
        
        Args:
            callsign: Target aircraft
            max_count: Maximum number of aircraft to return
        
        Returns:
            List of (callsign, distance_nm) tuples
        """
        if callsign not in self.aircraft:
            return []
        
        target = self.aircraft[callsign]
        distances = []
        
        for other_callsign, other_aircraft in self.aircraft.items():
            if other_callsign == callsign:
                continue
            distance = target.separation_from(other_aircraft)
            distances.append((other_callsign, distance))
        
        distances.sort(key=lambda x: x[1])
        return distances[:max_count]
    
    def get_state(self) -> WorldState:
        """
        Get current world state snapshot.
        
        Returns:
            WorldState object with all current information
        """
        return WorldState(
            timestamp=time.time(),
            aircraft=self.aircraft.copy(),
            active_runways=self.active_runways.copy(),
            wind_direction=self.wind_direction,
            wind_speed=self.wind_speed,
            conflicts=[c.description for c in self.conflict_detector.active_conflicts.values()]
        )
    
    def get_situation_summary(self) -> str:
        """
        Get human-readable situation summary.
        
        Returns:
            Multi-line string describing current situation
        """
        state = self.get_state()
        
        lines = [
            f"=== ATC Situation at {time.strftime('%H:%M:%S')} ===",
            f"Aircraft: {state.get_aircraft_count()} total ({state.get_airborne_count()} airborne)",
            f"Active Runways: {', '.join(state.active_runways) if state.active_runways else 'None'}",
            f"Wind: {state.wind_direction:.0f}° at {state.wind_speed:.0f}kt",
            ""
        ]
        
        # Aircraft by status
        by_status = {}
        for ac in self.aircraft.values():
            status = ac.status.name
            by_status[status] = by_status.get(status, 0) + 1
        
        if by_status:
            lines.append("Aircraft by Status:")
            for status, count in sorted(by_status.items()):
                lines.append(f"  {status}: {count}")
            lines.append("")
        
        # Conflicts
        if state.conflicts:
            lines.append(f"CONFLICTS ({len(state.conflicts)}):")
            for conflict in state.conflicts[:5]:  # Show first 5
                lines.append(f"  - {conflict}")
            if len(state.conflicts) > 5:
                lines.append(f"  ... and {len(state.conflicts) - 5} more")
        else:
            lines.append("No conflicts detected")
        
        return "\n".join(lines)
    
    def assign_runway(self, callsign: str, runway_name: str) -> bool:
        """
        Assign an aircraft to a runway.
        
        Args:
            callsign: Aircraft to assign
            runway_name: Runway identifier
        
        Returns:
            True if assignment successful
        """
        if callsign not in self.aircraft:
            logger.warning(f"Cannot assign runway to unknown aircraft {callsign}")
            return False
        
        if self.topology and runway_name not in self.topology.runways:
            logger.warning(f"Unknown runway {runway_name}")
            return False
        
        self.aircraft[callsign].assigned_runway = runway_name
        logger.info(f"Assigned {callsign} to runway {runway_name}")
        return True
    
    def clear_aircraft(self, callsign: str, clearance_type: str) -> bool:
        """
        Issue a clearance to an aircraft.
        
        Args:
            callsign: Aircraft receiving clearance
            clearance_type: 'takeoff', 'landing', 'taxi', etc.
        
        Returns:
            True if clearance issued successfully
        """
        if callsign not in self.aircraft:
            return False
        
        aircraft = self.aircraft[callsign]
        
        # Update aircraft status based onclearance
        if clearance_type == 'takeoff':
            aircraft.status = AircraftStatus.TAKING_OFF
        elif clearance_type == 'landing':
            aircraft.status = AircraftStatus.LANDING
        elif clearance_type == 'taxi':
            aircraft.status = AircraftStatus.TAXIING
        
        logger.info(f"Cleared {callsign} for {clearance_type}")
        return True
