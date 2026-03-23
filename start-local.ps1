$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$serverDir = Join-Path $root 'server'
$clientDir = Join-Path $root 'client'

Start-Process powershell -ArgumentList @(
  '-NoExit',
  '-Command',
  "Set-Location '$serverDir'; npm run dev"
)

Start-Sleep -Seconds 2

Start-Process powershell -ArgumentList @(
  '-NoExit',
  '-Command',
  "Set-Location '$clientDir'; npm run dev"
)

Write-Host 'Local backend and frontend launch commands started.'
Write-Host 'Backend: http://localhost:3001/health'
Write-Host 'Frontend: http://localhost:5173'
