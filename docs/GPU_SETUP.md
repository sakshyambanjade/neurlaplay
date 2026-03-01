# GPU Setup Guide

## Problem
You're getting this error:
```
RuntimeError: DefaultCPUAllocator: not enough memory: you tried to allocate 411041792 bytes.
```

This happens because:
- EasyOCR needs ~400MB RAM just to initialize
- Your system is running out of RAM
- **Solution: Use your GPU instead of CPU**

## Your Hardware
✓ **GPU**: NVIDIA GeForce GTX 1650 (4GB VRAM)  
✓ **CUDA**: 12.8 installed  
✗ **PyTorch**: CPU-only version (needs GPU version)

## Quick Fix

### Option 1: Automatic (Recommended)
```bash
# Run this script - it does everything automatically
install_gpu_support.bat
```

### Option 2: Manual
```bash
# 1. Uninstall CPU-only PyTorch
pip uninstall torch torchvision torchaudio

# 2. Install CUDA-enabled PyTorch
pip install torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cu124

# 3. Verify GPU is detected
python -c "import torch; print(torch.cuda.is_available())"
```

## After Installation

Run the bot:
```bash
python run_atc_bot.py --mode interactive
```

You should see:
```
✓ GPU detected: NVIDIA GeForce GTX 1650
  CUDA version: 12.4
  GPU memory: 4 GB
```

Instead of:
```
⚠ No GPU detected - using CPU (slower)
```

## Performance Difference

**Before (CPU):**
- ✗ Crashes with memory error
- ✗ Would be 10-20x slower if it worked

**After (GPU):**
- ✓ No memory issues
- ✓ 10-20x faster OCR processing
- ✓ Real-time performance

## Troubleshooting

### "CUDA Available: False" after installation
1. Restart terminal/VSCode
2. Make sure you're in virtual environment: `.venv\Scripts\Activate.ps1`
3. Run: `python -c "import torch; print(torch.version.cuda)"`

### "RuntimeError: no kernel image available"
Your GPU is too old for CUDA 12.4. Install older CUDA version:
```bash
pip uninstall torch torchvision torchaudio
pip install torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cu118
```

### Still getting memory errors
1. Close other GPU-heavy programs (games, Chrome with hardware acceleration)
2. Check GPU memory: `nvidia-smi`
3. Your GPU is currently at 68% usage (3849MB/4096MB) - close some apps

## Technical Details

**Download size:** ~2.4 GB  
**Installation time:** 5-10 minutes  
**Disk space required:** ~5 GB  

**What changes:**
- PyTorch 2.10.0+cpu → PyTorch 2.5.1+cu124
- vision_bot.py now auto-detects GPU
- EasyOCR will use CUDA instead of CPU

**What doesn't change:**
- All other dependencies
- Your code/models
- Training data
