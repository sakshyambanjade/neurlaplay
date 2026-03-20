$ErrorActionPreference = 'Stop'

Write-Host 'Starting autonomous paper research run...'

Start-Process -FilePath 'ollama' -ArgumentList 'serve' -WindowStyle Minimized

Set-Location $PSScriptRoot
npx tsx src/research/paper-cli.ts --config ../paper/configs/paper/groq_llama8b_constrained.json

Write-Host 'Research run finished. Artifacts are in ../paper/runs/'
