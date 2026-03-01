@echo off
echo ===================================
echo Installing GPU Support for Tower3D AI Bot
echo ===================================
echo.
echo Your GPU: NVIDIA GeForce GTX 1650
echo CUDA Version: 12.8
echo.
echo This will:
echo 1. Uninstall CPU-only PyTorch
echo 2. Install CUDA-enabled PyTorch
echo 3. This will take ~2GB download
echo.
pause

echo.
echo [1/2] Uninstalling CPU-only PyTorch...
python -m pip uninstall -y torch torchvision torchaudio

echo.
echo [2/2] Installing CUDA-enabled PyTorch (CUDA 12.4)...
python -m pip install torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cu124

echo.
echo ===================================
echo Installation Complete!
echo ===================================
echo.
echo Testing GPU availability...
python -c "import torch; print('PyTorch:', torch.__version__); print('CUDA Available:', torch.cuda.is_available()); print('GPU:', torch.cuda.get_device_name(0) if torch.cuda.is_available() else 'Not detected')"

echo.
echo If you see "CUDA Available: True" above, you're ready!
echo.
echo Now run: python run_atc_bot.py --mode interactive
echo.
pause
