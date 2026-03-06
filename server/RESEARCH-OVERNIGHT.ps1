# 🧠 LLM CHESS PAPER RESEARCH - OVERNIGHT RUN
# This script runs a comprehensive 100-game research batch with full Stockfish analysis

Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "🧠 LLM Chess Research - Overnight Mode" -ForegroundColor Green
Write-Host "========================================`n" -ForegroundColor Cyan

Write-Host "📊 Configuration:" -ForegroundColor Yellow
Write-Host "  - Total games: 100" -ForegroundColor White
Write-Host "  - White model: tinyllama:latest" -ForegroundColor White
Write-Host "  - Black model: phi3:latest" -ForegroundColor White
Write-Host "  - Analysis: Full Stockfish CPL" -ForegroundColor White
Write-Host "  - Estimated time: 50-60 minutes`n" -ForegroundColor White

# Check if Ollama is running
Write-Host "🔍 Checking Ollama server..." -ForegroundColor Yellow
$ollamaRunning = $false
try {
    $response = Invoke-WebRequest -Uri "http://localhost:11434/api/tags" -Method GET -TimeoutSec 2 -ErrorAction SilentlyContinue
    if ($response.StatusCode -eq 200) {
        $ollamaRunning = $true
        Write-Host "✅ Ollama is already running" -ForegroundColor Green
    }
} catch {
    Write-Host "⚠️  Ollama not running, starting now..." -ForegroundColor Yellow
}

# Start Ollama if not running
if (-not $ollamaRunning) {
    Start-Process -FilePath "ollama" -ArgumentList "serve" -WindowStyle Hidden
    Write-Host "⏳ Waiting for Ollama to start..." -ForegroundColor Yellow
    Start-Sleep -Seconds 5
    Write-Host "✅ Ollama started" -ForegroundColor Green
}

Write-Host "`n🚀 Starting 100-game research batch..." -ForegroundColor Green
Write-Host "⏰ Started at: $(Get-Date -Format 'HH:mm:ss')`n" -ForegroundColor Cyan

# Navigate to server and run
Set-Location $PSScriptRoot

# Make POST request to start batch
try {
    $body = @{
        totalGames = 100
        whiteModel = "tinyllama:latest"
        blackModel = "phi3:latest"
    } | ConvertTo-Json

    Write-Host "📡 Sending request to server..." -ForegroundColor Yellow
    $response = Invoke-RestMethod -Uri "http://localhost:3001/api/research/batch-paper" `
        -Method POST `
        -ContentType "application/json" `
        -Body $body `
        -TimeoutSec 7200

    Write-Host "`n✅ Batch started successfully!" -ForegroundColor Green
    Write-Host "💡 Monitor progress at: http://localhost:5173" -ForegroundColor Cyan
    
} catch {
    Write-Host "`n⚠️  Direct API call failed. Using CLI method..." -ForegroundColor Yellow
    npm run research:100games
}

Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "✅ RESEARCH COMPLETE!" -ForegroundColor Green
Write-Host "========================================`n" -ForegroundColor Cyan

Write-Host "📁 Results saved to:" -ForegroundColor Yellow
Write-Host "  📊 ../research/paper-results.json" -ForegroundColor White
Write-Host "  📄 ../research/paper-latex-table3.tex" -ForegroundColor White
Write-Host "  📁 ../research/raw-games.json" -ForegroundColor White
Write-Host "  ♟️  ../research/all-games.pgn`n" -ForegroundColor White

Write-Host "⏰ Completed at: $(Get-Date -Format 'HH:mm:ss')" -ForegroundColor Cyan

# Check if results exist and show summary
$resultsPath = "..\research\paper-results.json"
if (Test-Path $resultsPath) {
    Write-Host "`n📊 Quick Summary:" -ForegroundColor Yellow
    $results = Get-Content $resultsPath | ConvertFrom-Json
    Write-Host "  Total Games: $($results.totalGames)" -ForegroundColor White
    Write-Host "  White Win Rate: $([math]::Round($results.whiteWinRate * 100, 1))%" -ForegroundColor White
    Write-Host "  Avg CPL (White): $([math]::Round($results.avgCPL.white, 2))" -ForegroundColor White
    Write-Host "  Avg CPL (Black): $([math]::Round($results.avgCPL.black, 2))" -ForegroundColor White
    Write-Host "  Total Blunders: $($results.totalBlunders)" -ForegroundColor White
    
    # Auto-open results
    Write-Host "`n📖 Opening results file..." -ForegroundColor Yellow
    Start-Process notepad $resultsPath
} else {
    Write-Host "`n⚠️  Results file not found. Check server logs." -ForegroundColor Yellow
}

Write-Host "`n🎉 Ready for your paper! Good luck! 🎓`n" -ForegroundColor Green
