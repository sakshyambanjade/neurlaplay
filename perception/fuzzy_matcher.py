"""
Fuzzy OCR Matching Module
==========================
Matches OCR output against known values using fuzzy string matching.
Handles OCR errors like "UA1234" -> "0A1234" or "DL456" -> "DL45G".
"""

import logging
from typing import List, Optional, Tuple
from dataclasses import dataclass
from rapidfuzz import fuzz, process

logger = logging.getLogger(__name__)


@dataclass
class FuzzyMatch:
    """Result of a fuzzy match operation."""
    matched_value: str
    original_value: str
    confidence: float
    method: str  # 'exact', 'fuzzy', 'partial', or 'fallback'


class FuzzyMatcher:
    """
    Handles fuzzy matching for OCR outputs against known values.
    Essential for robust callsign recognition.
    """
    
    # Common OCR confusions
    OCR_SUBSTITUTIONS = {
        '0': ['O', 'D', 'Q'],
        'O': ['0', 'D', 'Q'],
        '1': ['I', 'l', '|'],
        'I': ['1', 'l', '|'],
        '5': ['S'],
        'S': ['5'],
        '8': ['B'],
        'B': ['8'],
        '6': ['G'],
        'G': ['6'],
        '2': ['Z'],
        'Z': ['2'],
    }
    
    def __init__(self, 
                 exact_threshold: float = 100.0,
                 fuzzy_threshold: float = 85.0,
                 partial_threshold: float = 70.0):
        """
        Initialize fuzzy matcher.
        
        Args:
            exact_threshold: Score for exact matches (100)
            fuzzy_threshold: Minimum score for fuzzy matches (85)
            partial_threshold: Minimum score for partial matches (70)
        """
        self.exact_threshold = exact_threshold
        self.fuzzy_threshold = fuzzy_threshold
        self.partial_threshold = partial_threshold
        
    def match_callsign(self, 
                       ocr_text: str, 
                       known_callsigns: List[str],
                       min_confidence: float = 70.0) -> Optional[FuzzyMatch]:
        """
        Match OCR text to a known callsign using fuzzy matching.
        
        Args:
            ocr_text: Text extracted from OCR (may have errors)
            known_callsigns: List of callsigns currently in the system
            min_confidence: Minimum confidence to return a match
        
        Returns:
            FuzzyMatch object or None if no good match found
        """
        if not ocr_text or not known_callsigns:
            return None
        
        # Clean input
        ocr_clean = ocr_text.strip().upper()
        callsigns_clean = [cs.strip().upper() for cs in known_callsigns]
        
        # 1. Try exact match
        if ocr_clean in callsigns_clean:
            return FuzzyMatch(
                matched_value=ocr_clean,
                original_value=ocr_text,
                confidence=100.0,
                method='exact'
            )
        
        # 2. Try fuzzy ratio match
        result = process.extractOne(
            ocr_clean, 
            callsigns_clean, 
            scorer=fuzz.ratio
        )
        
        if result and result[1] >= self.fuzzy_threshold:
            return FuzzyMatch(
                matched_value=result[0],
                original_value=ocr_text,
                confidence=result[1],
                method='fuzzy'
            )
        
        # 3. Try partial ratio (handles truncation)
        result_partial = process.extractOne(
            ocr_clean,
            callsigns_clean,
            scorer=fuzz.partial_ratio
        )
        
        if result_partial and result_partial[1] >= self.partial_threshold:
            return FuzzyMatch(
                matched_value=result_partial[0],
                original_value=ocr_text,
                confidence=result_partial[1],
                method='partial'
            )
        
        # 4. Try OCR confusion correction
        corrected = self._apply_ocr_corrections(ocr_clean, callsigns_clean)
        if corrected:
            return FuzzyMatch(
                matched_value=corrected,
                original_value=ocr_text,
                confidence=90.0,  # High confidence for known confusions
                method='ocr_correction'
            )
        
        logger.debug(f"No good match for '{ocr_text}' (best: {result[0] if result else 'none'}, score: {result[1] if result else 0})")
        return None
    
    def _apply_ocr_corrections(self, 
                              ocr_text: str, 
                              known_values: List[str]) -> Optional[str]:
        """
        Try common OCR character substitutions.
        
        Example: "0A123" -> "UA123" (0 confused with O -> U)
        """
        for i, char in enumerate(ocr_text):
            if char in self.OCR_SUBSTITUTIONS:
                for replacement in self.OCR_SUBSTITUTIONS[char]:
                    corrected = ocr_text[:i] + replacement + ocr_text[i+1:]
                    if corrected in known_values:
                        logger.info(f"OCR correction: '{ocr_text}' -> '{corrected}'")
                        return corrected
        return None
    
    def match_command(self,
                     ocr_text: str,
                     valid_commands: List[str],
                     min_confidence: float = 80.0) -> Optional[FuzzyMatch]:
        """
        Match OCR text to a valid ATC command.
        
        Args:
            ocr_text: OCR extracted command text
            valid_commands: List of valid command strings
            min_confidence: Minimum matching confidence
        
        Returns:
            FuzzyMatch or None
        """
        if not ocr_text or not valid_commands:
            return None
        
        ocr_clean = ocr_text.strip().upper()
        commands_clean = [cmd.strip().upper() for cmd in valid_commands]
        
        # Commands need high confidence
        result = process.extractOne(
            ocr_clean,
            commands_clean,
            scorer=fuzz.token_sort_ratio  # Better for multi-word commands
        )
        
        if result and result[1] >= min_confidence:
            return FuzzyMatch(
                matched_value=result[0],
                original_value=ocr_text,
                confidence=result[1],
                method='fuzzy_command'
            )
        
        return None
    
    def match_runway(self,
                    ocr_text: str,
                    available_runways: List[str],
                    min_confidence: float = 75.0) -> Optional[FuzzyMatch]:
        """
        Match OCR text to a runway identifier.
        
        Handles: "04L", "22R", "09", etc.
        Common errors: "04L" -> "O4L", "22R" -> "ZZR"
        
        Args:
            ocr_text: OCR extracted runway text
            available_runways: List of valid runways at this airport
            min_confidence: Minimum matching confidence
        
        Returns:
            FuzzyMatch or None
        """
        if not ocr_text or not available_runways:
            return None
        
        ocr_clean = ocr_text.strip().upper()
        runways_clean = [rwy.strip().upper() for rwy in available_runways]
        
        # Exact match
        if ocr_clean in runways_clean:
            return FuzzyMatch(
                matched_value=ocr_clean,
                original_value=ocr_text,
                confidence=100.0,
                method='exact'
            )
        
        # Fuzzy match
        result = process.extractOne(
            ocr_clean,
            runways_clean,
            scorer=fuzz.ratio
        )
        
        if result and result[1] >= min_confidence:
            return FuzzyMatch(
                matched_value=result[0],
                original_value=ocr_text,
                confidence=result[1],
                method='fuzzy'
            )
        
        # Try OCR corrections specific to runways
        # Common: O->0, Z->2, S->5
        corrected = ocr_clean.replace('O', '0').replace('Z', '2').replace('S', '5')
        if corrected in runways_clean:
            return FuzzyMatch(
                matched_value=corrected,
                original_value=ocr_text,
                confidence=95.0,
                method='ocr_correction'
            )
        
        return None
    
    def batch_match(self,
                   ocr_texts: List[str],
                   known_values: List[str],
                   match_type: str = 'callsign') -> List[Optional[FuzzyMatch]]:
        """
        Match multiple OCR outputs in batch.
        
        Args:
            ocr_texts: List of OCR extracted texts
            known_values: List of valid values to match against
            match_type: 'callsign', 'command', or 'runway'
        
        Returns:
            List of FuzzyMatch objects (None for no match)
        """
        matcher_func = {
            'callsign': self.match_callsign,
            'command': self.match_command,
            'runway': self.match_runway
        }.get(match_type, self.match_callsign)
        
        return [matcher_func(text, known_values) for text in ocr_texts]
    
    def get_best_matches(self,
                        ocr_text: str,
                        known_values: List[str],
                        top_n: int = 3) -> List[Tuple[str, float]]:
        """
        Get top N best matches with their confidence scores.
        Useful for debugging or manual selection.
        
        Args:
            ocr_text: OCR extracted text
            known_values: List of valid values
            top_n: Number of top matches to return
        
        Returns:
            List of (matched_value, confidence) tuples
        """
        if not ocr_text or not known_values:
            return []
        
        ocr_clean = ocr_text.strip().upper()
        values_clean = [v.strip().upper() for v in known_values]
        
        results = process.extract(
            ocr_clean,
            values_clean,
            scorer=fuzz.ratio,
            limit=top_n
        )
        
        return [(match, score) for match, score, _ in results]


# Singleton instance
_default_matcher = None

def get_default_matcher() -> FuzzyMatcher:
    """Get singleton fuzzy matcher instance."""
    global _default_matcher
    if _default_matcher is None:
        _default_matcher = FuzzyMatcher()
    return _default_matcher
