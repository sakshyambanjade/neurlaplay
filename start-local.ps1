$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$serverDir = Join-Path $root 'server'
$clientDir = Join-Path $root 'client'

Start-Process powershell -ArgumentList @(
  '-NoExit',
  '-Command',
  "Set-Location '$serverDir'; & '.\\node_modules\\.bin\\tsc.cmd' -p .; if (`$LASTEXITCODE -eq 0) { & 'C:\\Program Files\\nodejs\\node.exe' '.\\dist\\index.js' }"
)

Start-Sleep -Seconds 2

Start-Process powershell -ArgumentList @(
  '-NoExit',
  '-Command',
  "Set-Location '$clientDir'; & '.\\node_modules\\.bin\\vite.cmd'"
)

Write-Host 'Local backend and frontend launch commands started.'
Write-Host 'Backend: http://localhost:3001/health'
Write-Host 'Frontend: http://localhost:5173'
