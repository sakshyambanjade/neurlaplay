Write-Host "🧠 Starting 100-game LLM chess research..." -ForegroundColor Cyan

# Start Ollama in background
Write-Host "Starting Ollama server..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList "ollama serve" -WindowStyle Minimized

# Wait for Ollama to start
Start-Sleep -Seconds 5

Write-Host "Starting research batch..." -ForegroundColor Green

# Run 100 game batch
$body = @{
    totalGames = 100
    whiteModel = "tinyllama:latest"
    blackModel = "phi3:latest"
} | ConvertTo-Json

Invoke-RestMethod -Uri "http://localhost:3001/api/research/batch-paper" `
    -Method POST `
    -ContentType "application/json" `
    -Body $body

Write-Host "✅ PAPER COMPLETE! Check research/ folder" -ForegroundColor Green
Write-Host "Results: ../research/paper-results.json" -ForegroundColor Cyan
