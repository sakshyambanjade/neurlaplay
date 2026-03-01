"""
Dynamic Layout Detection Module
================================
Automatically discovers UI elements and airport layout without hardcoded coordinates.
Makes the system work on any airport by detecting the game's UI structure.
"""

import cv2
import numpy as np
from typing import Dict, List, Tuple, Optional
import logging
from dataclasses import dataclass

logger = logging.getLogger(__name__)


@dataclass
class UIRegion:
    """Detected UI region with confidence."""
    name: str
    x: int
    y: int
    width: int
    height: int
    confidence: float
    
    def as_tuple(self) -> Tuple[int, int, int, int]:
        """Return as (x, y, w, h) tuple."""
        return (self.x, self.y, self.width, self.height)
    
    def contains_point(self, x: int, y: int) -> bool:
        """Check if point is inside region."""
        return (self.x <= x <= self.x + self.width and 
                self.y <= y <= self.y + self.height)


class DynamicLayoutDetector:
    """
    Detects game UI elements dynamically instead of using fixed coordinates.
    This makes the bot work on any resolution and any airport.
    """
    
    def __init__(self):
        self.detected_regions: Dict[str, UIRegion] = {}
        self.radar_center: Optional[Tuple[int, int]] = None
        self.radar_scale: float = 1.0
        
    def detect_all_regions(self, screenshot: np.ndarray) -> Dict[str, UIRegion]:
        """
        Auto-detect all UI regions from a screenshot.
        
        Args:
            screenshot: Full game window screenshot (BGR)
        
        Returns:
            Dictionary of detected regions: {'radar': UIRegion, 'strips': UIRegion, ...}
        """
        logger.info("Starting dynamic UI detection...")
        
        # Detect each region
        self.detected_regions['radar'] = self._detect_radar(screenshot)
        self.detected_regions['strips'] = self._detect_strips_panel(screenshot)
        self.detected_regions['command_line'] = self._detect_command_line(screenshot)
        self.detected_regions['wind_indicator'] = self._detect_wind_indicator(screenshot)
        
        # Calculate radar scale for position normalization
        if self.detected_regions['radar']:
            self._calculate_radar_scale(self.detected_regions['radar'])
        
        logger.info(f"Detected {len(self.detected_regions)} UI regions")
        return self.detected_regions
    
    def _detect_radar(self, img: np.ndarray) -> Optional[UIRegion]:
        """
        Detect radar display using circular Hough transform.
        The radar is typically a dark circle with colored blips.
        """
        gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
        
        # Apply Gaussian blur
        blurred = cv2.GaussianBlur(gray, (9, 9), 2)
        
        # Detect circles
        circles = cv2.HoughCircles(
            blurred,
            cv2.HOUGH_GRADIENT,
            dp=1,
            minDist=100,
            param1=50,
            param2=30,
            minRadius=150,
            maxRadius=400
        )
        
        if circles is not None:
            circles = np.uint16(np.around(circles))
            # Take largest circle (usually the radar)
            largest = max(circles[0], key=lambda c: c[2])
            x, y, r = largest
            
            # Store center for position calculations
            self.radar_center = (x, y)
            
            return UIRegion(
                name="radar",
                x=x - r,
                y=y - r,
                width=r * 2,
                height=r * 2,
                confidence=0.9
            )
        
        logger.warning("Radar not detected - falling back to default region")
        # Fallback: assume radar is in top-left quadrant
        h, w = img.shape[:2]
        return UIRegion(
            name="radar",
            x=0,
            y=0,
            width=w // 2,
            height=h // 2,
            confidence=0.3
        )
    
    def _detect_strips_panel(self, img: np.ndarray) -> Optional[UIRegion]:
        """
        Detect flight strips panel using edge detection and yellow color.
        Strips are typically yellow/orange rectangles in a vertical list.
        """
        hsv = cv2.cvtColor(img, cv2.COLOR_BGR2HSV)
        
        # Yellow/orange range for strips
        lower_yellow = np.array([15, 50, 50])
        upper_yellow = np.array([35, 255, 255])
        mask = cv2.inRange(hsv, lower_yellow, upper_yellow)
        
        # Find contours
        contours, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        
        if contours:
            # Find bounding box of all strips
            all_points = np.vstack([cv2.boundingRect(c) for c in contours if cv2.contourArea(c) > 100])
            
            if len(all_points) > 0:
                x = all_points[:, 0].min()
                y = all_points[:, 1].min()
                x_max = (all_points[:, 0] + all_points[:, 2]).max()
                y_max = (all_points[:, 1] + all_points[:, 3]).max()
                
                return UIRegion(
                    name="strips",
                    x=x,
                    y=y,
                    width=x_max - x,
                    height=y_max - y,
                    confidence=0.85
                )
        
        # Fallback: strips are usually on the right side
        h, w = img.shape[:2]
        return UIRegion(
            name="strips",
            x=int(w * 0.7),
            y=int(h * 0.3),
            width=int(w * 0.3),
            height=int(h * 0.6),
            confidence=0.4
        )
    
    def _detect_command_line(self, img: np.ndarray) -> Optional[UIRegion]:
        """
        Detect command input line (usually at bottom or top).
        Look for text input box or contrasting horizontal rectangle.
        """
        gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
        edges = cv2.Canny(gray, 50, 150)
        
        # Find horizontal lines
        lines = cv2.HoughLinesP(edges, 1, np.pi/180, threshold=100, minLineLength=200, maxLineGap=10)
        
        h, w = img.shape[:2]
        
        if lines is not None:
            # Command line is usually in top 20% or bottom 20%
            top_lines = [l for l in lines if l[0][1] < h * 0.2]
            bottom_lines = [l for l in lines if l[0][1] > h * 0.8]
            
            if top_lines:
                y = np.mean([l[0][1] for l in top_lines])
                return UIRegion(
                    name="command_line",
                    x=0,
                    y=int(y) - 40,
                    width=w,
                    height=80,
                    confidence=0.7
                )
        
        # Default: bottom of screen
        return UIRegion(
            name="command_line",
            x=0,
            y=h - 100,
            width=w,
            height=100,
            confidence=0.5
        )
    
    def _detect_wind_indicator(self, img: np.ndarray) -> Optional[UIRegion]:
        """
        Detect wind indicator (usually shows wind direction/speed).
        Typically in top-right or near radar.
        """
        h, w = img.shape[:2]
        
        # Wind indicator is usually small, in top portion
        return UIRegion(
            name="wind_indicator",
            x=int(w * 0.85),
            y=int(h * 0.05),
            width=int(w * 0.15),
            height=int(h * 0.1),
            confidence=0.6
        )
    
    def _calculate_radar_scale(self, radar_region: UIRegion):
        """Calculate scale factor for position normalization."""
        if radar_region and radar_region.width > 0:
            # Normalize to 1.0 = full radar width
            self.radar_scale = 1.0 / radar_region.width
            logger.info(f"Radar scale calculated: {self.radar_scale:.4f}")
    
    def normalize_position(self, x: int, y: int) -> Tuple[float, float]:
        """
        Convert screen coordinates to normalized radar coordinates.
        Returns (rel_x, rel_y) where 0,0 is radar center and 1.0 is radar edge.
        """
        if not self.radar_center:
            return (0.0, 0.0)
        
        cx, cy = self.radar_center
        rel_x = (x - cx) * self.radar_scale
        rel_y = (y - cy) * self.radar_scale
        
        return (rel_x, rel_y)
    
    def get_region(self, name: str) -> Optional[UIRegion]:
        """Get detected region by name."""
        return self.detected_regions.get(name)
    
    def save_detection_visualization(self, screenshot: np.ndarray, output_path: str):
        """Save screenshot with detected regions overlaid for debugging."""
        vis = screenshot.copy()
        
        for name, region in self.detected_regions.items():
            if region:
                color = (0, 255, 0) if region.confidence > 0.7 else (0, 165, 255)
                cv2.rectangle(vis, (region.x, region.y), 
                            (region.x + region.width, region.y + region.height),
                            color, 2)
                cv2.putText(vis, f"{name} ({region.confidence:.2f})", 
                          (region.x, region.y - 5),
                          cv2.FONT_HERSHEY_SIMPLEX, 0.5, color, 1)
        
        if self.radar_center:
            cv2.circle(vis, self.radar_center, 5, (0, 0, 255), -1)
        
        cv2.imwrite(output_path, vis)
        logger.info(f"Detection visualization saved to {output_path}")
