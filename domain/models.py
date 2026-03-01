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
    EN_ROUTE = "en_route"
    APPROACHING = "approaching"
    ON_FINAL = "on_final"
    LANDING = "landing"
    ON_RUNWAY = "on_runway"
    TAXIING = "taxiing"
    AT_GATE = "at_gate"
    DEPARTING = "departing"
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
    """2D position with velocity tracking."""
    x: float
    y: float
    timestamp: float = field(default_factory=lambda: datetime.now().timestamp())
    
    def distance_to(self, other: 'Position') -> float:
        """Calculate Euclidean distance."""
        return math.sqrt((self.x - other.x)**2 + (self.y - other.y)**2)
    
    def bearing_to(self, other: 'Position') -> float:
        """Calculate bearing in degrees."""
        dx = other.x - self.x
        dy = other.y - self.y
        return math.degrees(math.atan2(dx, dy)) % 360


@dataclass
class Aircraft:
    """
    Persistent aircraft object with state tracking.
    
    This is track-based, not frame-based - maintains identity across frames.
    """
    callsign: str
    aircraft_type: Optional[str] = None
    status: AircraftStatus = AircraftStatus.UNKNOWN
    
    # Position tracking
    position_history: List[Position] = field(default_factory=list)
    current_altitude: Optional[int] = None
    current_heading: Optional[int] = None
    current_speed: Optional[int] = None
    
    # State
    assigned_runway: Optional[str] = None
    assigned_gate: Optional[str] = None
    last_clearance: Optional[str] = None
    last_clearance_time: Optional[float] = None
    
    # Tracking metadata
    first_seen: float = field(default_factory=lambda: datetime.now().timestamp())
    last_seen: float = field(default_factory=lambda: datetime.now().timestamp())
    confidence: float = 1.0  # OCR confidence for this aircraft
    track_id: Optional[int] = None
    
    def update_position(self, x: float, y: float, timestamp: Optional[float] = None):
        """Add position to history, maintain last 20 positions."""
        if timestamp is None:
            timestamp = datetime.now().timestamp()
        
        pos = Position(x, y, timestamp)
        self.position_history.append(pos)
        
        # Keep only last 20 positions
        if len(self.position_history) > 20:
            self.position_history.pop(0)
        
        self.last_seen = timestamp
    
    @property
    def current_position(self) -> Optional[Position]:
        """Get most recent position."""
        return self.position_history[-1] if self.position_history else None
    
    @property
    def velocity_vector(self) -> Optional[Tuple[float, float]]:
        """Calculate velocity from last 2 positions."""
        if len(self.position_history) < 2:
            return None
        
        p1 = self.position_history[-2]
        p2 = self.position_history[-1]
        dt = p2.timestamp - p1.timestamp
        
        if dt == 0:
            return None
        
        vx = (p2.x - p1.x) / dt
        vy = (p2.y - p1.y) / dt
        return (vx, vy)
    
    def predict_position(self, dt: float) -> Optional[Position]:
        """Predict position dt seconds in the future."""
        if not self.current_position or not self.velocity_vector:
            return None
        
        vx, vy = self.velocity_vector
        current = self.current_position
        
        predicted_x = current.x + vx * dt
        predicted_y = current.y + vy * dt
        
        return Position(predicted_x, predicted_y, current.timestamp + dt)
    
    def separation_from(self, other: 'Aircraft') -> Optional[float]:
        """Calculate current separation distance."""
        if not self.current_position or not other.current_position:
            return None
        return self.current_position.distance_to(other.current_position)


@dataclass
class Runway:
    """Runway with operational state."""
    name: str
    heading: int  # Magnetic heading (0-360)
    length: Optional[int] = None  # Feet/meters
    position: Optional[Position] = None  # Center position on radar
    
    # State
    occupied: bool = False
    occupied_by: Optional[str] = None  # Aircraft callsign
    active: bool = True
    
    # Configuration
    ils_available: bool = False
    
    def get_reciprocal(self) -> int:
        """Get reciprocal heading."""
        return (self.heading + 180) % 360
    
    def is_headwind(self, wind_direction: int, threshold: int = 90) -> bool:
        """Check if runway is into the wind."""
        wind_diff = abs(self.heading - wind_direction)
        return min(wind_diff, 360 - wind_diff) <= threshold
    
    def tailwind_component(self, wind_direction: int, wind_speed: int) -> float:
        """Calculate tailwind component."""
        diff_rad = math.radians(wind_direction - self.heading)
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
    aircraft_1: str
    aircraft_2: str
    separation_distance: float
    minimum_safe_distance: float
    timestamp: float = field(default_factory=lambda: datetime.now().timestamp())
    severity: str = "WARNING"  # WARNING, CRITICAL
    type: str = "SEPARATION"  # SEPARATION, RUNWAY, WAKE
    
    @property
    def is_violation(self) -> bool:
        """Check if this is an actual violation vs. prediction."""
        return self.separation_distance < self.minimum_safe_distance
