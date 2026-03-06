$ErrorActionPreference = 'Stop'

Write-Host 'Starting autonomous paper research run...'

Start-Process -FilePath 'ollama' -ArgumentList 'serve' -WindowStyle Minimized

Set-Location $PSScriptRoot
npm run research:100games

Write-Host 'Research run finished. Artifacts are in ../research/'
