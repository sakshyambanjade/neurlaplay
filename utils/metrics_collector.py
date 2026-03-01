"""
Metrics Collection System
=========================
Research-grade metrics for evaluating ATC performance.
Tracks safety, efficiency, and workload measures.
"""

import logging
import time
from typing import Dict, List, Optional, Any
from dataclasses import dataclass, field, asdict
from datetime import datetime
import json
import csv
from pathlib import Path

from domain.models import Aircraft, Conflict

logger = logging.getLogger(__name__)


@dataclass
class SessionMetrics:
    """Metrics for a single ATC session."""
    session_id: str
    start_time: datetime
    end_time: Optional[datetime] = None
    
    # Safety metrics
    total_conflicts: int = 0
    critical_conflicts: int = 0
    separation_violations: int = 0
    runway_incursions: int = 0
    min_separation_nm: float = float('inf')
    
    # Efficiency metrics
    total_aircraft_handled: int = 0
    total_landings: int = 0
    total_takeoffs: int = 0
    average_taxi_time_seconds: float = 0.0
    average_approach_time_seconds: float = 0.0
    runway_utilization_percent: float = 0.0
    
    # Command metrics
    total_commands_issued: int = 0
    commands_per_aircraft: float = 0.0
    average_command_latency_ms: float = 0.0
    
    # Workload metrics
    peak_aircraft_count: int = 0
    average_aircraft_count: float = 0.0
    
    # Decision quality (for ML evaluation)
    decisions_made: int = 0
    human_interventions: int = 0  # In interactive mode
    automation_acceptance_rate: float = 0.0
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for JSON serialization."""
        d = asdict(self)
        d['start_time'] = self.start_time.isoformat()
        d['end_time'] = self.end_time.isoformat() if self.end_time else None
        return d


@dataclass
class AircraftMetrics:
    """Metrics for individual aircraft."""
    callsign: str
    entry_time: float
    exit_time: Optional[float] = None
    
    # Flight path
    positions_recorded: int = 0
    total_distance_nm: float = 0.0
    
    # Commands received
    commands_received: List[str] = field(default_factory=list)
    
    # Separation events
    min_separation_encountered_nm: float = float('inf')
    separation_violations: int = 0
    
    # Timing
    time_in_system_seconds: float = 0.0
    taxi_time_seconds: float = 0.0
    approach_time_seconds: float = 0.0
    
    # Status
    operation_type: str = "unknown"  # arrival, departure, overflight
    completed_successfully: bool = False
    
    def calculate_time_in_system(self):
        """Calculate total time from entry to exit."""
        if self.exit_time is not None:
            self.time_in_system_seconds = self.exit_time - self.entry_time


class MetricsCollector:
    """
    Collects and analyzes performance metrics for research purposes.
    """
    
    def __init__(self, session_id: Optional[str] = None, output_dir: str = "metrics"):
        """
        Initialize metrics collector.
        
        Args:
            session_id: Unique identifier for this session
            output_dir: Directory to save metrics files
        """
        self.session_id = session_id or f"session_{int(time.time())}"
        self.output_dir = Path(output_dir)
        self.output_dir.mkdir(exist_ok=True)
        
        self.session_metrics = SessionMetrics(
            session_id=self.session_id,
            start_time=datetime.now()
        )
        
        self.aircraft_metrics: Dict[str, AircraftMetrics] = {}
        
        # Real-time tracking
        self.command_timestamps: List[float] = []
        self.aircraft_count_samples: List[int] = []
        self.separation_measurements: List[float] = []
        
        logger.info(f"Metrics collector initialized for session {self.session_id}")
    
    def record_aircraft_entry(self, callsign: str, operation_type: str = "unknown"):
        """Record when aircraft enters the system."""
        if callsign not in self.aircraft_metrics:
            self.aircraft_metrics[callsign] = AircraftMetrics(
                callsign=callsign,
                entry_time=time.time(),
                operation_type=operation_type
            )
            self.session_metrics.total_aircraft_handled += 1
            logger.debug(f"Aircraft entry: {callsign}")
    
    def record_aircraft_exit(self, callsign: str, successful: bool = True):
        """Record when aircraft exits the system."""
        if callsign in self.aircraft_metrics:
            metrics = self.aircraft_metrics[callsign]
            metrics.exit_time = time.time()
            metrics.completed_successfully = successful
            metrics.calculate_time_in_system()
            
            # Update session totals
            if metrics.operation_type == "arrival":
                self.session_metrics.total_landings += 1
            elif metrics.operation_type == "departure":
                self.session_metrics.total_takeoffs += 1
            
            logger.debug(f"Aircraft exit: {callsign} (time in system: {metrics.time_in_system_seconds:.1f}s)")
    
    def record_command(self, callsign: str, command: str, latency_ms: Optional[float] = None):
        """Record a command issued to an aircraft."""
        timestamp = time.time()
        self.command_timestamps.append(timestamp)
        self.session_metrics.total_commands_issued += 1
        
        if callsign in self.aircraft_metrics:
            self.aircraft_metrics[callsign].commands_received.append(command)
        
        if latency_ms is not None:
            # Update running average of command latency
            n = self.session_metrics.total_commands_issued
            current_avg = self.session_metrics.average_command_latency_ms
            self.session_metrics.average_command_latency_ms = (
                (current_avg * (n - 1) + latency_ms) / n
            )
    
    def record_conflict(self, conflict: Conflict):
        """Record a detected conflict."""
        self.session_metrics.total_conflicts += 1
        
        if conflict.severity == 'critical':
            self.session_metrics.critical_conflicts += 1
        
        if conflict.conflict_type == 'separation_violation':
            self.session_metrics.separation_violations += 1
        elif conflict.conflict_type == 'runway_incursion':
            self.session_metrics.runway_incursions += 1
        
        # Track minimum separation
        if conflict.distance_nm < self.session_metrics.min_separation_nm:
            self.session_metrics.min_separation_nm = conflict.distance_nm
        
        logger.warning(f"Conflict recorded: {conflict.conflict_type} between {conflict.aircraft1} and {conflict.aircraft2}")
    
    def record_separation(self, aircraft1: str, aircraft2: str, distance_nm: float):
        """Record separation measurement between aircraft."""
        self.separation_measurements.append(distance_nm)
        
        # Update aircraft-specific minimums
        for callsign in [aircraft1, aircraft2]:
            if callsign in self.aircraft_metrics:
                metrics = self.aircraft_metrics[callsign]
                if distance_nm < metrics.min_separation_encountered_nm:
                    metrics.min_separation_encountered_nm = distance_nm
    
    def record_aircraft_count(self, count: int):
        """Record current number of aircraft in system."""
        self.aircraft_count_samples.append(count)
        
        if count > self.session_metrics.peak_aircraft_count:
            self.session_metrics.peak_aircraft_count = count
    
    def record_human_intervention(self):
        """Record when human takes over in interactive mode."""
        self.session_metrics.human_interventions += 1
    
    def record_decision(self, accepted: bool):
        """Record an AI decision and whether it was accepted."""
        self.session_metrics.decisions_made += 1
        if accepted:
            # Update acceptance rate
            n = self.session_metrics.decisions_made
            rate = self.session_metrics.automation_acceptance_rate
            self.session_metrics.automation_acceptance_rate = (
                (rate * (n - 1) + 1.0) / n
            )
    
    def finalize_session(self):
        """Calculate final metrics for the session."""
        self.session_metrics.end_time = datetime.now()
        
        # Calculate averages
        if self.aircraft_count_samples:
            self.session_metrics.average_aircraft_count = (
                sum(self.aircraft_count_samples) / len(self.aircraft_count_samples)
            )
        
        # Calculate commands per aircraft
        if self.session_metrics.total_aircraft_handled > 0:
            self.session_metrics.commands_per_aircraft = (
                self.session_metrics.total_commands_issued / 
                self.session_metrics.total_aircraft_handled
            )
        
        # Calculate average taxi and approach times
        taxi_times = [m.taxi_time_seconds for m in self.aircraft_metrics.values() 
                     if m.taxi_time_seconds > 0]
        if taxi_times:
            self.session_metrics.average_taxi_time_seconds = sum(taxi_times) / len(taxi_times)
        
        approach_times = [m.approach_time_seconds for m in self.aircraft_metrics.values()
                         if m.approach_time_seconds > 0]
        if approach_times:
            self.session_metrics.average_approach_time_seconds = sum(approach_times) / len(approach_times)
        
        logger.info(f"Session finalized: {self.session_metrics.total_aircraft_handled} aircraft handled")
    
    def save_metrics(self):
        """Save all metrics to files."""
        self.finalize_session()
        
        # Save session summary as JSON
        session_file = self.output_dir / f"{self.session_id}_summary.json"
        with open(session_file, 'w') as f:
            json.dump(self.session_metrics.to_dict(), f, indent=2)
        logger.info(f"Session metrics saved to {session_file}")
        
        # Save aircraft metrics as CSV
        aircraft_file = self.output_dir / f"{self.session_id}_aircraft.csv"
        if self.aircraft_metrics:
            with open(aircraft_file, 'w', newline='') as f:
                writer = csv.DictWriter(f, fieldnames=[
                    'callsign', 'operation_type', 'time_in_system_seconds',
                    'commands_received', 'min_separation_encountered_nm',
                    'separation_violations', 'completed_successfully'
                ])
                writer.writeheader()
                for metrics in self.aircraft_metrics.values():
                    writer.writerow({
                        'callsign': metrics.callsign,
                        'operation_type': metrics.operation_type,
                        'time_in_system_seconds': f"{metrics.time_in_system_seconds:.1f}",
                        'commands_received': len(metrics.commands_received),
                        'min_separation_encountered_nm': f"{metrics.min_separation_encountered_nm:.2f}",
                        'separation_violations': metrics.separation_violations,
                        'completed_successfully': metrics.completed_successfully
                    })
            logger.info(f"Aircraft metrics saved to {aircraft_file}")
        
        # Save time-series data
        timeseries_file = self.output_dir / f"{self.session_id}_timeseries.csv"
        with open(timeseries_file, 'w', newline='') as f:
            writer = csv.writer(f)
            writer.writerow(['sample', 'aircraft_count'])
            for i, count in enumerate(self.aircraft_count_samples):
                writer.writerow([i, count])
        logger.info(f"Time-series data saved to {timeseries_file}")
    
    def get_performance_summary(self) -> str:
        """Get human-readable performance summary."""
        m = self.session_metrics
        
        lines = [
            f"=== Session {self.session_id} Performance Summary ===",
            f"Duration: {m.start_time} to {m.end_time or 'ongoing'}",
            "",
            "SAFETY:",
            f"  Total conflicts: {m.total_conflicts} ({m.critical_conflicts} critical)",
            f"  Separation violations: {m.separation_violations}",
            f"  Runway incursions: {m.runway_incursions}",
            f"  Minimum separation: {m.min_separation_nm:.2f}nm",
            "",
            "EFFICIENCY:",
            f"  Aircraft handled: {m.total_aircraft_handled}",
            f"  Landings: {m.total_landings}",
            f"  Takeoffs: {m.total_takeoffs}",
            f"  Avg taxi time: {m.average_taxi_time_seconds:.1f}s",
            f"  Avg approach time: {m.average_approach_time_seconds:.1f}s",
            "",
            "WORKLOAD:",
            f"  Commands issued: {m.total_commands_issued}",
            f"  Commands per aircraft: {m.commands_per_aircraft:.1f}",
            f"  Avg command latency: {m.average_command_latency_ms:.1f}ms",
            f"  Peak aircraft: {m.peak_aircraft_count}",
            f"  Average aircraft: {m.average_aircraft_count:.1f}",
            "",
            "AUTOMATION:",
            f"  Decisions made: {m.decisions_made}",
            f"  Human interventions: {m.human_interventions}",
            f"  Acceptance rate: {m.automation_acceptance_rate:.1%}",
        ]
        
        return "\n".join(lines)
