# neurlaplay

## Project Overview
Neurlaplay is an autonomous AI bot for Tower3D Pro, designed for research in imitation learning, reinforcement learning, and neuro-symbolic reasoning. The bot sees the game, logs actions, learns from your decisions, and acts in real time.

## Setup
1. Clone the repo and navigate to Tower3D_AI_Bot.
2. Install dependencies:
	```bash
	pip install -r requirements.txt
	```
3. Configure settings in `config.yaml` (screen regions, OCR engine, commands).
4. Run the bot:
	```bash
	python main.py --mode collect --config config.yaml
	```

## Modular Structure
- `vision_bot.py`: Screen reading, OCR (EasyOCR), region cropping.
- `atc_world_model.py`: Game state tracking, state vector for ML.
- `reasoning_engine.py`: Hybrid ML + rule-based decision logic.
- `action_module.py`: Command input with retry/error handling.
- `training_logger.py`: Logs actions, screenshots, outcomes.
- `dataset_analyser.py`: Data analysis, auto-retrain trigger.
- `evaluator.py`: Session metrics for research.

## Research Features
- Structured logging for MDP datasets.
- ML-ready state vectors and imitation learning pipeline.
- Auto-retrain after each session.
- Safety fallback and robust error handling.
- Experiment tracking and metrics for publication.

## Contributing
Add unit tests, docstrings, and modular improvements. See improvement.txt for roadmap.
