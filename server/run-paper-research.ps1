$ErrorActionPreference = 'Stop'

Write-Host 'Starting autonomous paper research run...'

Set-Location $PSScriptRoot
npm run research:paper

Write-Host 'Research run finished. Artifacts are in ../paper/runs/'
