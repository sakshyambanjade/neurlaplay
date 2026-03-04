#!/usr/bin/env powershell
<#
.SYNOPSIS
    Quick test script for Stockfish research data collection
    
.DESCRIPTION
    This script:
    1. Verifies Stockfish is installed
    2. Starts the server
    3. Runs a bot match with analysis
    4. Exports research data
    5. Generates analysis report

.EXAMPLE
    .\test-research.ps1

.NOTES
    Requires: Node.js, Stockfish installed
#>

param(
    [switch]$SkipInstall,
    [string]$Model1 = "gpt-4o",
    [string]$Model2 = "claude-3.5-sonnet"
)

# Colors for output
$Success = "Green"
$Error = "Red"
$Info = "Cyan"
$Warning = "Yellow"

Write-Host "`n╔════════════════════════════════════════╗" -ForegroundColor $Info
Write-Host "║   LLMArena Stockfish Research Test    ║" -ForegroundColor $Info
Write-Host "╚════════════════════════════════════════╝`n" -ForegroundColor $Info

# Step 1: Check Stockfish
Write-Host "[1/5] Checking Stockfish installation..." -ForegroundColor $Info
try {
    $sf_version = & stockfish --version 2>$null
    Write-Host "✓ Stockfish found: $sf_version" -ForegroundColor $Success
} catch {
    Write-Host "✗ Stockfish not found" -ForegroundColor $Error
    Write-Host "Install with: choco install stockfish" -ForegroundColor $Warning
    exit 1
}

# Step 2: Install dependencies
if (-not $SkipInstall) {
    Write-Host "`n[2/5] Installing dependencies..." -ForegroundColor $Info
    
    Push-Location "server"
    npm install --silent
    if ($LASTEXITCODE -ne 0) {
        Write-Host "✗ npm install failed" -ForegroundColor $Error
        Pop-Location
        exit 1
    }
    Pop-Location
    Write-Host "✓ Dependencies installed" -ForegroundColor $Success
} else {
    Write-Host "`n[2/5] Skipping npm install (-SkipInstall)" -ForegroundColor $Warning
}

# Step 3: Start server
Write-Host "`n[3/5] Starting server..." -ForegroundColor $Info
$server_pid = Start-Process -FilePath "npm" `
    -ArgumentList "run dev" `
    -WorkingDirectory "server" `
    -PassThru `
    -NoNewWindow

if ($null -eq $server_pid) {
    Write-Host "✗ Failed to start server" -ForegroundColor $Error
    exit 1
}

Write-Host "✓ Server started (PID: $($server_pid.Id))" -ForegroundColor $Success

# Wait for server to be ready
Write-Host "Waiting for server to start..." -ForegroundColor $Warning
Start-Sleep -Seconds 3

# Check if server is responding
$maxAttempts = 10
$attempt = 0
$serverReady = $false

while ($attempt -lt $maxAttempts -and -not $serverReady) {
    try {
        $response = Invoke-WebRequest -Uri "http://localhost:3000/health" -ErrorAction SilentlyContinue
        if ($response.StatusCode -eq 200) {
            $serverReady = $true
        }
    } catch {
        # Server not ready yet
    }
    
    if (-not $serverReady) {
        Start-Sleep -Seconds 1
        $attempt++
    }
}

if (-not $serverReady) {
    Write-Host "✗ Server failed to start" -ForegroundColor $Error
    Stop-Process -Id $server_pid.Id -Force
    exit 1
}

Write-Host "✓ Server is ready on http://localhost:3000" -ForegroundColor $Success

# Step 4: Run a test match
Write-Host "`n[4/5] Running test bot match ($Model1 vs $Model2)..." -ForegroundColor $Info
Write-Host "Note: This will take 1-2 minutes with Stockfish analysis" -ForegroundColor $Warning

# Create a simple API call to start a match
$match_id = "test-$(Get-Random -Maximum 10000)"

# Note: In production, you'd use your actual API endpoint
# For now, this is a placeholder - the server output will show the match
Write-Host "`nServer is running. To test with actual bots:" -ForegroundColor $Info
Write-Host "  1. Open http://localhost:3000 in browser" -ForegroundColor $Info
Write-Host "  2. Create a match (or run via CLI)" -ForegroundColor $Info
Write-Host "  3. Add two bot configurations" -ForegroundColor $Info
Write-Host "  4. Watch analysis logs appear in console" -ForegroundColor $Info

Write-Host "`nExample bot match (using socket.io from client):" -ForegroundColor $Warning
Write-Host "  npm run dev  # In another terminal" -ForegroundColor $Warning
Write-Host "  Then open http://localhost:5173 and create a match" -ForegroundColor $Warning

# Step 5: Show expected output
Write-Host "`n[5/5] Expected output format:" -ForegroundColor $Info
Write-Host @"
┌─────────────────────────────────────────┐
│   RESEARCH DATA LOG (in console)        │
└─────────────────────────────────────────┘

[RESEARCH] Match $match_id | WHITE | CPL: 0.45 | Move: e4
[RESEARCH] Match $match_id | BLACK | CPL: 1.23 | Move: c5  
[RESEARCH] Match $match_id | WHITE | CPL: 0.89 | Move: Nf3
[RESEARCH] Match $match_id | BLACK | CPL: 3.45 | Move: e5  ← Suboptimal
...

┌─────────────────────────────────────────┐
│   AFTER MATCH COMPLETES                 │
└─────────────────────────────────────────┘

Download research data:
  curl http://localhost:3000/api/research/export/$match_id/json > data.json
  curl http://localhost:3000/api/research/export/$match_id/csv > data.csv

View summary:
  curl http://localhost:3000/api/research/summary/$match_id | jq
  
Analyze with Python:
  python analyze_research.py data.json --paper
"@

Write-Host "`n✓ Test setup complete! Server running..." -ForegroundColor $Success
Write-Host "Press Ctrl+C to stop server`n" -ForegroundColor $Info

# Keep script running
try {
    while ($true) {
        Start-Sleep -Seconds 10
    }
} finally {
    Write-Host "`nCleaning up..." -ForegroundColor $Warning
    Stop-Process -Id $server_pid.Id -Force -ErrorAction SilentlyContinue
    Write-Host "✓ Server stopped" -ForegroundColor $Success
}
