"""
Airport Topology Module
=======================
Dynamic airport graph structure built from detected runways and taxiways.
Enables pathfinding, conflict detection, and airport-agnostic operations.
"""

import logging
from typing import Dict, List, Optional, Set, Tuple
from dataclasses import dataclass, field
import networkx as nx
import math

from domain.models import Position, Runway

logger = logging.getLogger(__name__)


@dataclass
class TaxiwayNode:
    """A node in the airport ground network."""
    node_id: str
    position: Position
    node_type: str  # 'runway_entry', 'runway_exit', 'intersection', 'gate', 'ramp'
    runways_accessible: List[str] = field(default_factory=list)
    
    def __hash__(self):
        return hash(self.node_id)


@dataclass
class TaxiwayEdge:
    """An edge connecting two nodes in the ground network."""
    from_node: str
    to_node: str
    distance_meters: float
    taxiway_name: str
    bidirectional: bool = True


class AirportTopology:
    """
    Represents the physical layout of an airport as a graph.
    Built dynamically from detected or configured airport data.
    """
    
    def __init__(self, airport_code: str):
        """
        Initialize airport topology.
        
        Args:
            airport_code: ICAO code (e.g., 'KJFK', 'KLAX')
        """
        self.airport_code = airport_code
        self.runways: Dict[str, Runway] = {}
        self.nodes: Dict[str, TaxiwayNode] = {}
        self.graph = nx.DiGraph()  # Directed graph for one-way taxiways
        
        logger.info(f"Initialized topology for {airport_code}")
    
    def add_runway(self, runway: Runway):
        """Add a runway to the topology."""
        self.runways[runway.name] = runway
        
        # Add runway threshold as nodes
        entry_node = TaxiwayNode(
            node_id=f"{runway.name}_threshold",
            position=runway.threshold_position,
            node_type='runway_entry',
            runways_accessible=[runway.name]
        )
        self.add_node(entry_node)
        
        logger.debug(f"Added runway {runway.name}")
    
    def add_node(self, node: TaxiwayNode):
        """Add a node to the topology."""
        self.nodes[node.node_id] = node
        self.graph.add_node(node.node_id, position=node.position, type=node.node_type)
    
    def add_edge(self, edge: TaxiwayEdge):
        """Add a taxiway edge to the topology."""
        self.graph.add_edge(
            edge.from_node,
            edge.to_node,
            weight=edge.distance_meters,
            taxiway=edge.taxiway_name
        )
        
        if edge.bidirectional:
            self.graph.add_edge(
                edge.to_node,
                edge.from_node,
                weight=edge.distance_meters,
                taxiway=edge.taxiway_name
            )
    
    def find_shortest_path(self, 
                          from_node: str, 
                          to_node: str) -> Optional[List[str]]:
        """
        Find shortest taxiway path between two nodes.
        
        Args:
            from_node: Starting node ID
            to_node: Destination node ID
        
        Returns:
            List of node IDs forming the path, or None if no path exists
        """
        try:
            path = nx.shortest_path(
                self.graph,
                source=from_node,
                target=to_node,
                weight='weight'
            )
            return path
        except nx.NetworkXNoPath:
            logger.warning(f"No path found from {from_node} to {to_node}")
            return None
    
    def get_runway_by_heading(self, heading: float, tolerance: float = 15.0) -> Optional[Runway]:
        """
        Find runway that matches a given heading.
        
        Args:
            heading: Magnetic heading in degrees (0-360)
            tolerance: Acceptable deviation in degrees
        
        Returns:
            Matching runway or None
        """
        for runway in self.runways.values():
            # Normalize headings
            rwy_heading = runway.magnetic_heading % 360
            diff = abs(rwy_heading - heading)
            
            # Handle wrap-around (e.g., 359 vs 1)
            if diff > 180:
                diff = 360 - diff
            
            if diff <= tolerance:
                return runway
        
        return None
    
    def get_active_runways(self, 
                          wind_direction: float, 
                          wind_speed: float,
                          prefer_into_wind: bool = True) -> List[Runway]:
        """
        Determine which runways should be active based on wind.
        
        Args:
            wind_direction: Wind direction in degrees
            wind_speed: Wind speed in knots
            prefer_into_wind: Prefer runways with headwind component
        
        Returns:
            List of recommended active runways
        """
        active = []
        
        for runway in self.runways.values():
            if prefer_into_wind and runway.is_headwind(wind_direction):
                # Calculate headwind component
                headwind = abs(wind_speed * math.cos(math.radians(
                    abs(runway.magnetic_heading - wind_direction)
                )))
                active.append((runway, headwind))
        
        # Sort by headwind component (highest first)
        active.sort(key=lambda x: x[1], reverse=True)
        
        return [rwy for rwy, _ in active]
    
    def get_intersecting_runways(self, runway_name: str) -> List[str]:
        """
        Find runways that intersect with the given runway.
        
        Args:
            runway_name: Name of the runway to check
        
        Returns:
            List of intersecting runway names
        """
        # Simplified - would need actual geometric intersection
        # For now, return runways with crossing angles
        if runway_name not in self.runways:
            return []
        
        base_runway = self.runways[runway_name]
        intersecting = []
        
        for name, runway in self.runways.items():
            if name == runway_name:
                continue
            
            # Check if headings are perpendicular (crude intersection check)
            angle_diff = abs(base_runway.magnetic_heading - runway.magnetic_heading)
            angle_diff = min(angle_diff, 360 - angle_diff)
            
            # Consider intersecting if angle is 45-135 degrees
            if 45 <= angle_diff <= 135:
                intersecting.append(name)
        
        return intersecting
    
    def get_nodes_near_position(self, 
                               position: Position, 
                               radius_meters: float = 100.0) -> List[TaxiwayNode]:
        """
        Find all nodes within a radius of a position.
        
        Args:
            position: Center position
            radius_meters: Search radius in meters
        
        Returns:
            List of nearby nodes
        """
        nearby = []
        
        for node_id, node in self.nodes.items():
            distance = position.distance_to(node.position) * 1852  # nm to meters
            if distance <= radius_meters:
                nearby.append(node)
        
        return nearby
    
    def get_runway_occupancy_zone(self, runway_name: str) -> List[str]:
        """
        Get all nodes that are part of a runway's occupancy zone.
        
        Args:
            runway_name: Runway identifier
        
        Returns:
            List of node IDs in the runway zone
        """
        zone_nodes = []
        
        for node_id, node in self.nodes.items():
            if runway_name in node.runways_accessible:
                zone_nodes.append(node_id)
        
        return zone_nodes
    
    def validate_topology(self) -> List[str]:
        """
        Validate the topology for common issues.
        
        Returns:
            List of validation warnings/errors
        """
        issues = []
        
        # Check for isolated nodes
        if not nx.is_weakly_connected(self.graph):
            components = list(nx.weakly_connected_components(self.graph))
            if len(components) > 1:
                issues.append(f"Graph has {len(components)} disconnected components")
        
        # Check for runways without nodes
        for runway_name in self.runways.keys():
            threshold_node = f"{runway_name}_threshold"
            if threshold_node not in self.nodes:
                issues.append(f"Runway {runway_name} missing threshold node")
        
        # Check for nodes without edges
        for node_id in self.nodes.keys():
            if self.graph.degree(node_id) == 0:
                issues.append(f"Node {node_id} is isolated (no edges)")
        
        if issues:
            logger.warning(f"Topology validation found {len(issues)} issues")
            for issue in issues:
                logger.warning(f"  - {issue}")
        else:
            logger.info("Topology validation passed")
        
        return issues
    
    def to_dict(self) -> Dict:
        """Export topology as dictionary for serialization."""
        return {
            'airport_code': self.airport_code,
            'runways': {name: {
                'name': rwy.name,
                'magnetic_heading': rwy.magnetic_heading,
                'length_feet': rwy.length_feet,
                'width_feet': rwy.width_feet
            } for name, rwy in self.runways.items()},
            'nodes': {node_id: {
                'position': (node.position.lat, node.position.lon),
                'type': node.node_type,
                'runways_accessible': node.runways_accessible
            } for node_id, node in self.nodes.items()},
            'edges': [
                {
                    'from': u,
                    'to': v,
                    'distance': data['weight'],
                    'taxiway': data['taxiway']
                }
                for u, v, data in self.graph.edges(data=True)
            ]
        }
    
    @classmethod
    def from_config(cls, config: Dict) -> 'AirportTopology':
        """
        Build topology from configuration dictionary.
        
        Args:
            config: Airport configuration with runways, nodes, edges
        
        Returns:
            Constructed AirportTopology
        """
        topology = cls(config['airport_code'])
        
        # Add runways
        for rwy_data in config.get('runways', []):
            runway = Runway(
                name=rwy_data['name'],
                magnetic_heading=rwy_data['magnetic_heading'],
                length_feet=rwy_data['length_feet'],
                width_feet=rwy_data.get('width_feet', 150),
                threshold_position=Position(
                    lat=rwy_data['threshold'][0],
                    lon=rwy_data['threshold'][1],
                    altitude_ft=rwy_data.get('threshold_elevation', 0)
                )
            )
            topology.add_runway(runway)
        
        # Add nodes
        for node_data in config.get('nodes', []):
            node = TaxiwayNode(
                node_id=node_data['id'],
                position=Position(
                    lat=node_data['position'][0],
                    lon=node_data['position'][1],
                    altitude_ft=0
                ),
                node_type=node_data['type'],
                runways_accessible=node_data.get('runways_accessible', [])
            )
            topology.add_node(node)
        
        # Add edges
        for edge_data in config.get('edges', []):
            edge = TaxiwayEdge(
                from_node=edge_data['from'],
                to_node=edge_data['to'],
                distance_meters=edge_data['distance'],
                taxiway_name=edge_data['taxiway'],
                bidirectional=edge_data.get('bidirectional', True)
            )
            topology.add_edge(edge)
        
        logger.info(f"Loaded topology for {config['airport_code']}: {len(topology.runways)} runways, {len(topology.nodes)} nodes")
        return topology
