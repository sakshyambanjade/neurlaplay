def decide_command(state: dict) -> str:
    """
    Input: state from parse_full_screen() (live parser)
    Output: full command string ready to type.
    """
    if not isinstance(state, dict):
        return "STANDBY"

    if state.get("error"):
        return "STANDBY"

    callsign = str(state.get("callsign", "")).strip().upper()
    if not callsign or callsign == "UNKNOWN":
        return "STANDBY"

    runway = str(state.get("incoming_runway", "28")).strip()
    distance = float(state.get("distance_on_final", 5.0))
    planes_on_runway = int(state.get("planes_on_runway_28", 0))
    safe_to_land = bool(state.get("safe_to_land", False))

    if planes_on_runway > 0:
        return f"{callsign} GO AROUND"

    if distance < 2.0 and safe_to_land:
        return f"{callsign} RUNWAY {runway} CLEARED TO LAND"

    if distance < 5.0:
        return f"{callsign} RUNWAY {runway} CLEARED FOR LOW APPROACH"

    return f"{callsign} CONTINUE"
