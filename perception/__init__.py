"""
Perception Layer Package
========================
Handles screen capture, OCR, layout detection, and fuzzy matching.
Separates low-level perception from world understanding.
"""

from .layout_detector import DynamicLayoutDetector, UIRegion
from .fuzzy_matcher import FuzzyMatcher, FuzzyMatch, get_default_matcher

__all__ = [
    'DynamicLayoutDetector',
    'UIRegion',
    'FuzzyMatcher',
    'FuzzyMatch',
    'get_default_matcher'
]
