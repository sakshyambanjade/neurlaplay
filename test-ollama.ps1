# Quick Test Script for Ollama Models

Write-Host "🦙 Starting Ollama Chess Tournament..." -ForegroundColor Cyan
Write-Host ""

# Check if Ollama is running
try {
    $ollamaList = ollama list 2>&1
    if ($LASTEXITCODE -ne 0) {
        Write-Host "❌ Ollama is not running!" -ForegroundColor Red
        Write-Host "   Start it with: ollama serve" -ForegroundColor Yellow
        exit 1
    }
} catch {
    Write-Host "❌ Ollama not found! Please install from https://ollama.ai" -ForegroundColor Red
    exit 1
}

Write-Host "✓ Ollama is running" -ForegroundColor Green

# Check if models are available
$requiredModels = @("qwen3-coder:30b", "llama3.1:8b", "phi3:latest", "tinyllama:latest")
$availableModels = ollama list | Select-String -Pattern "(\S+:\S+)" | ForEach-Object { $_.Matches.Groups[1].Value }

foreach ($model in $requiredModels) {
    if ($availableModels -contains $model) {
        Write-Host "✓ $model available" -ForegroundColor Green
    } else {
        Write-Host "⚠️  $model not found" -ForegroundColor Yellow
        Write-Host "   Pull with: ollama pull $model" -ForegroundColor Gray
    }
}

Write-Host ""
Write-Host "Starting quick test (4 games)..." -ForegroundColor Cyan
Write-Host "This will run:" -ForegroundColor Gray
Write-Host "  - qwen3-coder:30b vs llama3.1:8b (2 games)" -ForegroundColor Gray
Write-Host "  - phi3 vs tinyllama (2 games)" -ForegroundColor Gray
Write-Host ""

# Run the quick test
Set-Location server
npm run batch:ollama:quick

Write-Host ""
Write-Host "✓ Test complete!" -ForegroundColor Green
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Cyan
Write-Host "  1. Check results in server/game-data/" -ForegroundColor Gray
Write-Host "  2. Analyze: python analyze_research.py ../server/game-data/research-match-*.json" -ForegroundColor Gray
Write-Host "  3. Visualize: python visualize_research.py ../server/game-data/research-match-*_paper.json" -ForegroundColor Gray
