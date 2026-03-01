"""
Domain Models for Airport-Agnostic ATC System
==============================================
These models represent the core aviation entities, independent of any specific airport.
"""

from dataclasses import dataclass, field
from typing import List, Optional, Tuple
from enum import Enum
from datetime import datetime
import math


class AircraftStatus(Enum):
    """Aircraft operational states."""
    IN_FLIGHT = "in_flight"
    ON_APPROACH = "on_approach"
    ON_FINAL = "on_final"
    LANDING = "landing"
    LANDED = "landed"
    ON_RUNWAY = "on_runway"
    ON_GROUND = "on_ground"
    TAXIING = "taxiing"
    AT_GATE = "at_gate"
    TAKING_OFF = "taking_off"
    DEPARTING = "departing"
    DEPARTED = "departed"
    UNKNOWN = "unknown"


class CommandType(Enum):
    """ATC command categories."""
    CLEARANCE = "clearance"
    TAXI = "taxi"
    HOLD = "hold"
    TURN = "turn"
    REPORT = "report"
    CONTACT = "contact"
    GO_AROUND = "go_around"


@dataclass
class Position:
    """Geographic position with altitude."""
    lat: float  # Latitude in degrees
    lon: float  # Longitude in degrees
    altitude_ft: float = 0.0  # Altitude in feet
    timestamp: float = field(default_factory=lambda: datetime.now().timestamp())
    
    def distance_to(self, other: 'Position') -> float:
        """
        Calculate great circle distance in nautical miles.
        Uses Haversine formula for accuracy.
        """
        R = 3440.065  # Earth radius in nautical miles
        
        lat1, lon1 = math.radians(self.lat), math.radians(self.lon)
        lat2, lon2 = math.radians(other.lat), math.radians(other.lon)
        
        dlat = lat2 - lat1
        dlon = lon2 - lon1
        
        a = math.sin(dlat/2)**2 + math.cos(lat1) * math.cos(lat2) * math.sin(dlon/2)**2
        c = 2 * math.asin(math.sqrt(a))
        
        return R * c
    
    def bearing_to(self, other: 'Position') -> float:
        """Calculate bearing to another position in degrees (0-360)."""
        lat1, lon1 = math.radians(self.lat), math.radians(self.lon)
        lat2, lon2 = math.radians(other.lat), math.radians(other.lon)
        
        dlon = lon2 - lon1
        
        x = math.sin(dlon) * math.cos(lat2)
        y = math.cos(lat1) * math.sin(lat2) - math.sin(lat1) * math.cos(lat2) * math.cos(dlon)
        
        bearing = math.degrees(math.atan2(x, y))
        return (bearing + 360) % 360


@dataclass
class Aircraft:
    """
    Persistent aircraft object with state tracking.
    
    This is track-based, not frame-based - maintains identity across frames.
    """
    callsign: str
    aircraft_type: str = "UNKNOWN"
    position: Position = None  # Current position
    status: AircraftStatus = AircraftStatus.UNKNOWN
    heading: float = 0.0  # Magnetic heading in degrees
    speed_knots: float = 0.0  # Ground speed in knots
    weight_class: str = "MEDIUM"  # LIGHT, MEDIUM, HEAVY, SUPER
    
    # Position tracking
    position_history: List[Position] = field(default_factory=list)
    
    # State
    assigned_runway: Optional[str] = None
    assigned_gate: Optional[str] = None
    last_clearance: Optional[str] = None
    last_clearance_time: Optional[float] = None
    
    # Tracking metadata
    first_seen: float = field(default_factory=lambda: datetime.now().timestamp())
    last_seen: float = field(default_factory=lambda: datetime.now().timestamp())
    confidence: float = 1.0  # OCR confidence for this aircraft
    
    def update_position(self, new_position: Position, dt: float = 1.0):
        """
        Add position to history, maintain last 20 positions.
        
        Args:
            new_position: New Position object
            dt: Time delta in seconds since last update
        """
        self.position = new_position
        self.position_history.append(new_position)
        
        # Keep only last 20 positions
        if len(self.position_history) > 20:
            self.position_history.pop(0)
        
        self.last_seen = new_position.timestamp
    
    @property
    def velocity_vector(self) -> Optional[Tuple[float, float]]:
        """
        Calculate velocity from last 2 positions.
        Returns (speed_knots, heading_degrees) or None.
        """
        if len(self.position_history) < 2:
            return None
        
        p1 = self.position_history[-2]
        p2 = self.position_history[-1]
        dt = p2.timestamp - p1.timestamp
        
        if dt == 0:
            return None
        
        # Distance in nautical miles
        distance_nm = p1.distance_to(p2)
        # Speed in knots (nm/hour)
        speed = (distance_nm / dt) * 3600
        # Bearing
        heading = p1.bearing_to(p2)
        
        return (speed, heading)
    
    def predict_position(self, dt: float) -> Optional[Position]:
        """
        Predict position dt seconds in the future using current velocity.
        
        Args:
            dt: Time ahead in seconds
        
        Returns:
            Predicted Position or None if insufficient data
        """
        if not self.position or not self.velocity_vector:
            return None
        
        speed_knots, heading_deg = self.velocity_vector
        
        # Distance traveled in nautical miles
        distance_nm = (speed_knots / 3600) * dt
        
        # Convert to lat/lon change
        # Approximate: 1 nm ≈ 1/60 degree latitude
        # Longitude varies by latitude
        lat_change = (distance_nm / 60) * math.cos(math.radians(heading_deg))
        lon_change = (distance_nm / 60) * math.sin(math.radians(heading_deg)) / math.cos(math.radians(self.position.lat))
        
        predicted_lat = self.position.lat + lat_change
        predicted_lon = self.position.lon + lon_change
        
        return Position(
            lat=predicted_lat,
            lon=predicted_lon,
            altitude_ft=self.position.altitude_ft,
            timestamp=self.position.timestamp + dt
        )
    
    def separation_from(self, other: 'Aircraft') -> float:
        """
        Calculate current separation distance in nautical miles.
        
        Args:
            other: Another Aircraft object
        
        Returns:
            Separation distance in NM, or infinity if positions unknown
        """
        if not self.position or not other.position:
            return float('inf')
        return self.position.distance_to(other.position)


@dataclass
class Runway:
    """Runway with operational state and geometry."""
    name: str
    magnetic_heading: float  # Magnetic heading (0-360)
    length_feet: float
    width_feet: float = 150.0
    threshold_position: Optional[Position] = None  # Runway threshold coordinates
    
    # State
    occupied: bool = False
    occupied_by: Optional[str] = None  # Aircraft callsign
    active: bool = True
    
    # Configuration
    ils_available: bool = False
    
    def get_reciprocal(self) -> float:
        """Get reciprocal heading."""
        return (self.magnetic_heading + 180) % 360
    
    def is_headwind(self, wind_direction: float, threshold: float = 90) -> bool:
        """Check if runway is into the wind."""
        wind_diff = abs(self.magnetic_heading - wind_direction)
        return min(wind_diff, 360 - wind_diff) <= threshold
    
    def tailwind_component(self, wind_direction: float, wind_speed: float) -> float:
        """Calculate tailwind component in knots."""
        diff_rad = math.radians(wind_direction - self.magnetic_heading)
        return -wind_speed * math.cos(diff_rad)  # Negative = tailwind


@dataclass
class Taxiway:
    """Taxiway node in airport graph."""
    name: str
    connections: List[str] = field(default_factory=list)
    position: Optional[Position] = None
    
    def add_connection(self, other_taxiway: str):
        """Add bidirectional connection."""
        if other_taxiway not in self.connections:
            self.connections.append(other_taxiway)


@dataclass
class Gate:
    """Aircraft gate/parking position."""
    name: str
    position: Optional[Position] = None
    occupied: bool = False
    occupied_by: Optional[str] = None
    terminal: Optional[str] = None


@dataclass
class Conflict:
    """Detected separation violation or potential conflict."""
    aircraft1: str
    aircraft2: str
    conflict_type: str  # 'separation_violation', 'runway_incursion', etc.
    severity: str  # 'critical', 'warning', 'advisory'
    distance_nm: float
    time_to_conflict: Optional[float] = None  # For predicted conflicts
    description: str = ""
    timestamp: float = field(default_factory=lambda: datetime.now().timestamp())
    
    @property
    def is_violation(self) -> bool:
        """Check if this is a critical violation."""
        return self.severity == 'critical'
