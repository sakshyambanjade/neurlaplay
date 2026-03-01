@echo off
echo ========================================
echo Lightweight OCR Setup (No GPU Required)
echo ========================================
echo.
echo This solution uses pytesseract instead of EasyOCR
echo Advantages:
echo - No PyTorch (saves 5GB disk space)
echo - No GPU required  
echo - Fast enough for ATC (200-500ms per frame)
echo - Already installed: pytesseract package
echo.
echo Still needed: Tesseract OCR binary (~60MB)
echo.
echo ========================================
pause

echo.
echo Downloading Tesseract OCR installer to D:\...
powershell -Command "Invoke-WebRequest -Uri 'https://digi.bib.uni-mannheim.de/tesseract/tesseract-ocr-w64-setup-5.3.3.20231005.exe' -OutFile 'D:\tesseract-installer.exe'"

echo.
echo Starting installer...
echo IMPORTANT: Install to D:\Tesseract-OCR (not C:, you're out of space!)
echo.
pause

D:\tesseract-installer.exe

echo.
echo ========================================
echo Installation Complete!
echo ========================================
echo.
echo Testing...
python run_atc_bot.py --mode interactive

pause
