"""
View discovered buttons and analysis results
Shows what the AI learned from your gameplay
"""
import json
from pathlib import Path
import sys
from tabulate import tabulate

def view_session_results(session_dir):
    """Display analysis results from a session"""
    session_dir = Path(session_dir)
    
    # Load knowledge base
    kb_file = session_dir / "ui_knowledge_base.json"
    if not kb_file.exists():
        print(f"✗ Knowledge base not found: {kb_file}")
        print("\nRun analyzer first: python training/analyze_gameplay.py <session_id>")
        return
    
    with open(kb_file, 'r') as f:
        kb = json.load(f)
    
    print("\n" + "="*80)
    print("DISCOVERED UI ELEMENTS & DECISION PATTERNS")
    print("="*80)
    
    print(f"\nSession: {kb['session_id']}")
    print(f"Play duration: {kb['play_duration_minutes']:.1f} minutes")
    print(f"Total buttons discovered: {len(kb['discovered_buttons'])}")
    
    # Sort by usage frequency
    buttons = sorted(kb['discovered_buttons'], 
                    key=lambda b: b['usage_stats']['click_count'], 
                    reverse=True)
    
    # Display top buttons
    print("\n" + "-"*80)
    print("TOP 20 MOST-USED BUTTONS:")
    print("-"*80)
    
    table_data = []
    for i, btn in enumerate(buttons[:20], 1):
        location = btn['location']
        usage = btn['usage_stats']
        effect = btn['effect']
        
        table_data.append([
            i,
            f"({location['center_x']}, {location['center_y']})",
            usage['click_count'],
            f"{usage['usage_frequency']:.2f}/min",
            effect['type']
        ])
    
    headers = ["#", "Location (x, y)", "Clicks", "Freq/min", "Effect"]
    print(tabulate(table_data, headers=headers, tablefmt="grid"))
    
    # Impact analysis
    print("\n" + "-"*80)
    print("BUTTON IMPACT ANALYSIS:")
    print("-"*80)
    
    high_impact = [b for b in buttons if b['effect']['type'] == 'high_impact']
    low_impact = [b for b in buttons if b['effect']['type'] == 'low_impact']
    
    print(f"\nHigh-impact buttons: {len(high_impact)} (big UI changes)")
    for btn in high_impact[:5]:
        print(f"  • ({btn['location']['center_x']}, {btn['location']['center_y']}) - "
              f"{btn['usage_stats']['click_count']} clicks")
    
    print(f"\nLow-impact buttons: {len(low_impact)} (minor changes)")
    for btn in low_impact[:5]:
        print(f"  • ({btn['location']['center_x']}, {btn['location']['center_y']}) - "
              f"{btn['usage_stats']['click_count']} clicks")
    
    # Most frequent vs impact
    print("\n" + "-"*80)
    print("DECISION INSIGHTS:")
    print("-"*80)
    
    most_used = buttons[0] if buttons else None
    if most_used:
        print(f"\nMost clicked button: ({most_used['location']['center_x']}, "
              f"{most_used['location']['center_y']})")
        print(f"  Clicks: {most_used['usage_stats']['click_count']}")
        print(f"  Frequency: {most_used['usage_stats']['usage_frequency']:.2f} clicks/minute")
        print(f"  Impact: {most_used['effect']['type']}")
        print(f"  → This is a core decision/action you take frequently")
    
    # Click distribution
    click_counts = [b['usage_stats']['click_count'] for b in buttons]
    avg_clicks = sum(click_counts) / len(click_counts) if click_counts else 0
    
    print(f"\nButton usage distribution:")
    print(f"  Average clicks per button: {avg_clicks:.1f}")
    print(f"  Max clicks: {max(click_counts) if click_counts else 0}")
    print(f"  Min clicks: {min(click_counts) if click_counts else 0}")
    
    # Extracted data
    print("\n" + "-"*80)
    print("FILES CREATED:")
    print("-"*80)
    print(f"\n✓ {kb_file.name}")
    print(f"  Structured button data (for AI training)")
    
    viz_file = session_dir / "discovered_buttons.png"
    if viz_file.exists():
        print(f"\n✓ {viz_file.name}")
        print(f"  Visual map of discovered buttons")
    
    patches_dir = session_dir / "button_patches"
    if patches_dir.exists():
        patch_count = len(list(patches_dir.glob("*.png")))
        print(f"\n✓ button_patches/ ({patch_count} images)")
        print(f"  Individual button images for recognition training")
    
    print("\n" + "="*80)
    print("NEXT STEPS:")
    print("="*80)
    print("\n1. ANALYZE DECISION PATTERNS")
    print("   python training/decision_pattern_analyzer.py 20260301_204002")
    print("   → Learn WHEN and WHY you click buttons\n")
    
    print("2. BUILD DECISION-MAKING AI")
    print("   python training/train_decision_advisor.py 20260301_204002")
    print("   → AI learns your decision patterns\n")
    
    print("3. TEST ADVISOR MODE")
    print("   python run_atc_bot.py --mode advisor --advisor-model models/decision_advisor.pth")
    print("   → AI suggests next action based on your patterns\n")


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("\nUsage: python training/view_results.py <session_id>")
        print("\nExample:")
        print("  python training/view_results.py 20260301_204002")
        sys.exit(1)
    
    session_id = sys.argv[1]
    session_dir = Path("training_data/gameplay_recordings") / session_id
    
    if not session_dir.exists():
        print(f"✗ Session not found: {session_dir}")
        sys.exit(1)
    
    view_session_results(session_dir)
