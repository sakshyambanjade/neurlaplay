"""
Conflict Detection Engine
=========================
Detects separation violations, runway incursions, and potential conflicts.
Core safety system for the ATC reasoning engine.
"""

import logging
from typing import List, Dict, Optional, Set
from dataclasses import dataclass
from enum import Enum
import math

from domain.models import Aircraft, Runway, Position, Conflict, AircraftStatus

logger = logging.getLogger(__name__)


class ConflictType(Enum):
    """Types of conflicts that can be detected."""
    SEPARATION_VIOLATION = "separation_violation"  # Aircraft too close
    RUNWAY_INCURSION = "runway_incursion"  # Aircraft on active runway
    PREDICTED_CONFLICT = "predicted_conflict"  # Will violate in future
    WAKE_TURBULENCE = "wake_turbulence"  # Heavy behind light
    ALTITUDE_VIOLATION = "altitude_violation"  # Wrong altitude
    GO_AROUND_NEEDED = "go_around_needed"  # Runway not clear


@dataclass
class ConflictRule:
    """Configuration for conflict detection rules."""
    # Separation minimums (nautical miles)
    horizontal_separation_nm: float = 3.0  # Standard radar separation
    vertical_separation_ft: float = 1000.0  # Standard vertical separation
    
    # Runway rules
    runway_clear_time_seconds: float = 60.0  # How long runway must be clear after landing
    
    # Wake turbulence spacing (nautical miles)
    wake_separation_heavy_heavy: float = 4.0
    wake_separation_heavy_medium: float = 5.0
    wake_separation_heavy_light: float = 6.0
    
    # Prediction
    prediction_horizon_seconds: float = 120.0  # Look ahead 2 minutes
    prediction_steps: int = 12  # Check every 10 seconds


class ConflictDetector:
    """
    Detects conflicts between aircraft and validates separation standards.
    This is the core safety system.
    """
    
    def __init__(self, rules: Optional[ConflictRule] = None):
        """
        Initialize conflict detector.
        
        Args:
            rules: Configuration for separation standards
        """
        self.rules = rules or ConflictRule()
        self.active_conflicts: Dict[str, Conflict] = {}  # conflict_id -> Conflict
        
    def detect_all_conflicts(self,
                            aircraft: List[Aircraft],
                            runways: List[Runway]) -> List[Conflict]:
        """
        Detect all conflicts in current airspace.
        
        Args:
            aircraft: List of all aircraft being tracked
            runways: List of airport runways
        
        Returns:
            List of detected conflicts, sorted by severity
        """
        conflicts = []
        
        # 1. Check horizontal separation between all pairs
        conflicts.extend(self._check_horizontal_separation(aircraft))
        
        # 2. Check runway incursions
        conflicts.extend(self._check_runway_incursions(aircraft, runways))
        
        # 3. Check wake turbulence separation
        conflicts.extend(self._check_wake_turbulence(aircraft))
        
        # 4. Predict future conflicts
        conflicts.extend(self._predict_conflicts(aircraft))
        
        # Update active conflicts tracking
        self._update_active_conflicts(conflicts)
        
        # Sort by severity (critical first)
        conflicts.sort(key=lambda c: c.severity, reverse=True)
        
        logger.info(f"Detected {len(conflicts)} conflicts ({sum(1 for c in conflicts if c.severity == 'critical')} critical)")
        return conflicts
    
    def _check_horizontal_separation(self, aircraft: List[Aircraft]) -> List[Conflict]:
        """Check all pairs for horizontal separation violations."""
        conflicts = []
        
        for i, ac1 in enumerate(aircraft):
            for ac2 in aircraft[i+1:]:
                # Skip if either is on ground
                if ac1.status == AircraftStatus.ON_GROUND or ac2.status == AircraftStatus.ON_GROUND:
                    continue
                
                separation_nm = ac1.separation_from(ac2)
                
                if separation_nm < self.rules.horizontal_separation_nm:
                    severity = 'critical' if separation_nm < 2.0 else 'warning'
                    
                    conflict = Conflict(
                        aircraft1=ac1.callsign,
                        aircraft2=ac2.callsign,
                        conflict_type='separation_violation',
                        severity=severity,
                        distance_nm=separation_nm,
                        description=f"Separation violation: {ac1.callsign} and {ac2.callsign} are {separation_nm:.2f}nm apart (min: {self.rules.horizontal_separation_nm}nm)"
                    )
                    conflicts.append(conflict)
                    logger.warning(f"SEPARATION VIOLATION: {conflict.description}")
        
        return conflicts
    
    def _check_runway_incursions(self, 
                                 aircraft: List[Aircraft],
                                 runways: List[Runway]) -> List[Conflict]:
        """Check for aircraft on active runways when they shouldn't be."""
        conflicts = []
        
        for runway in runways:
            # Find all aircraft on this runway
            on_runway = [ac for ac in aircraft 
                        if self._is_on_runway(ac, runway)]
            
            if len(on_runway) > 1:
                # Multiple aircraft on same runway - critical
                conflict = Conflict(
                    aircraft1=on_runway[0].callsign,
                    aircraft2=on_runway[1].callsign,
                    conflict_type='runway_incursion',
                    severity='critical',
                    distance_nm=on_runway[0].separation_from(on_runway[1]),
                    description=f"Runway incursion on {runway.name}: {', '.join(ac.callsign for ac in on_runway)}"
                )
                conflicts.append(conflict)
                logger.error(f"RUNWAY INCURSION: {conflict.description}")
        
        return conflicts
    
    def _check_wake_turbulence(self, aircraft: List[Aircraft]) -> List[Conflict]:
        """Check wake turbulence separation for aircraft on final approach."""
        conflicts = []
        
        # Group aircraft by runway they're approaching
        approaches: Dict[str, List[Aircraft]] = {}
        for ac in aircraft:
            if ac.status == AircraftStatus.ON_FINAL:
                runway = ac.assigned_runway or "UNKNOWN"
                if runway not in approaches:
                    approaches[runway] = []
                approaches[runway].append(ac)
        
        # Check wake separation for each approach sequence
        for runway, ac_list in approaches.items():
            # Sort by distance to runway (closest first)
            ac_list.sort(key=lambda ac: self._distance_to_threshold(ac))
            
            for i in range(len(ac_list) - 1):
                leader = ac_list[i]
                follower = ac_list[i + 1]
                
                required_sep = self._required_wake_separation(leader, follower)
                actual_sep = leader.separation_from(follower)
                
                if actual_sep < required_sep:
                    conflict = Conflict(
                        aircraft1=leader.callsign,
                        aircraft2=follower.callsign,
                        conflict_type='wake_turbulence',
                        severity='warning',
                        distance_nm=actual_sep,
                        description=f"Wake turbulence: {follower.callsign} too close behind {leader.callsign} ({actual_sep:.1f}nm, need {required_sep:.1f}nm)"
                    )
                    conflicts.append(conflict)
                    logger.warning(conflict.description)
        
        return conflicts
    
    def _predict_conflicts(self, aircraft: List[Aircraft]) -> List[Conflict]:
        """Predict conflicts that will occur in the near future."""
        conflicts = []
        dt = self.rules.prediction_horizon_seconds / self.rules.prediction_steps
        
        for step in range(1, self.rules.prediction_steps + 1):
            time_ahead = dt * step
            
            # Predict positions for all aircraft
            predicted = [(ac, ac.predict_position(time_ahead)) for ac in aircraft]
            
            # Check all pairs at predicted positions
            for i, (ac1, pos1) in enumerate(predicted):
                for ac2, pos2 in predicted[i+1:]:
                    if pos1 and pos2:
                        distance = pos1.distance_to(pos2)
                        
                        if distance < self.rules.horizontal_separation_nm:
                            conflict = Conflict(
                                aircraft1=ac1.callsign,
                                aircraft2=ac2.callsign,
                                conflict_type='predicted_conflict',
                                severity='advisory',
                                distance_nm=distance,
                                time_to_conflict=time_ahead,
                                description=f"Predicted conflict in {time_ahead:.0f}s: {ac1.callsign} and {ac2.callsign} will be {distance:.2f}nm apart"
                            )
                            conflicts.append(conflict)
                            # Only log first prediction for each pair
                            if step == 1:
                                logger.info(conflict.description)
                            break  # Don't check this pair at later times
        
        return conflicts
    
    def _is_on_runway(self, aircraft: Aircraft, runway: Runway) -> bool:
        """
        Check if aircraft is physically on a runway.
        Simplified - needs actual runway geometry.
        """
        # TODO: Use airport topology for real runway boundaries
        # For now, check if assigned and status indicates on runway
        return (aircraft.assigned_runway == runway.name and
                aircraft.status in [AircraftStatus.TAKING_OFF, 
                                   AircraftStatus.LANDING,
                                   AircraftStatus.ON_RUNWAY])
    
    def _distance_to_threshold(self, aircraft: Aircraft) -> float:
        """
        Calculate distance to runway threshold.
        Simplified - needs actual runway coordinates.
        """
        # TODO: Use real runway threshold position
        # For now, use a rough estimate from position
        return abs(aircraft.position.lat) + abs(aircraft.position.lon)  # Placeholder
    
    def _required_wake_separation(self, leader: Aircraft, follower: Aircraft) -> float:
        """
        Determine required wake turbulence separation.
        
        Rules:
        - Heavy behind heavy: 4nm
        - Medium/Light behind heavy: 5-6nm
        - No extra spacing for heavy behind medium/light
        """
        if leader.weight_class == 'HEAVY':
            if follower.weight_class == 'HEAVY':
                return self.rules.wake_separation_heavy_heavy
            elif follower.weight_class == 'MEDIUM':
                return self.rules.wake_separation_heavy_medium
            else:  # LIGHT
                return self.rules.wake_separation_heavy_light
        
        # Default separation for non-heavy leaders
        return self.rules.horizontal_separation_nm
    
    def _update_active_conflicts(self, new_conflicts: List[Conflict]):
        """Track which conflicts are new, ongoing, or resolved."""
        new_ids = {self._conflict_id(c) for c in new_conflicts}
        old_ids = set(self.active_conflicts.keys())
        
        # New conflicts
        appeared = new_ids - old_ids
        # Resolved conflicts
        resolved = old_ids - new_ids
        
        if appeared:
            logger.info(f"New conflicts: {appeared}")
        if resolved:
            logger.info(f"Resolved conflicts: {resolved}")
        
        # Update tracking
        self.active_conflicts = {
            self._conflict_id(c): c for c in new_conflicts
        }
    
    def _conflict_id(self, conflict: Conflict) -> str:
        """Generate unique ID for a conflict."""
        ac1, ac2 = sorted([conflict.aircraft1, conflict.aircraft2])
        return f"{ac1}_{ac2}_{conflict.conflict_type}"
    
    def get_conflicts_for_aircraft(self, callsign: str) -> List[Conflict]:
        """Get all active conflicts involving a specific aircraft."""
        return [c for c in self.active_conflicts.values() 
                if callsign in [c.aircraft1, c.aircraft2]]
    
    def has_critical_conflicts(self) -> bool:
        """Check if any critical conflicts exist."""
        return any(c.severity == 'critical' for c in self.active_conflicts.values())
    
    def get_conflict_summary(self) -> str:
        """Get human-readable summary of all conflicts."""
        if not self.active_conflicts:
            return "No conflicts detected"
        
        by_severity = {
            'critical': [],
            'warning': [],
            'advisory': []
        }
        
        for c in self.active_conflicts.values():
            by_severity[c.severity].append(c)
        
        lines = []
        if by_severity['critical']:
            lines.append(f"CRITICAL: {len(by_severity['critical'])} conflicts")
            for c in by_severity['critical']:
                lines.append(f"  - {c.description}")
        
        if by_severity['warning']:
            lines.append(f"WARNING: {len(by_severity['warning'])} conflicts")
        
        if by_severity['advisory']:
            lines.append(f"ADVISORY: {len(by_severity['advisory'])} predictions")
        
        return "\n".join(lines)
