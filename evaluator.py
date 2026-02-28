class SessionEvaluator:
    def evaluate(self, session_log):
        total = len(session_log)
        safe_landings = sum(1 for e in session_log if e.get('outcome') == 'safe_landing')
        conflicts = sum(1 for e in session_log if e.get('outcome') == 'conflict')
        hold_rate = sum(1 for e in session_log if e.get('action') == 'HOLD POSITION') / total if total else 0
        return {
            "safety_rate": safe_landings / total if total else 0,
            "conflict_rate": conflicts / total if total else 0,
            "hold_rate": hold_rate,
            "total_decisions": total
        }

    def load_log(self, log_path):
        import json
        with open(log_path, 'r', encoding='utf-8') as f:
            return [json.loads(line) for line in f]

    def evaluate_log_file(self, log_path):
        session_log = self.load_log(log_path)
        return self.evaluate(session_log)
