$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$serverDir = Join-Path $root 'server'

Set-Location $serverDir
& '.\node_modules\.bin\tsc.cmd' -p .
if ($LASTEXITCODE -ne 0) {
  Write-Error 'Server build failed.'
  exit $LASTEXITCODE
}

& 'C:\Program Files\nodejs\node.exe' '.\dist\index.js'
