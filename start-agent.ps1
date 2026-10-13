$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot
if (-not (Test-Path "node_modules")) { npm install }
if (-not (Test-Path "$env:USERPROFILE\AppData\Local\ms-playwright")) { npx playwright install chromium }
npm run dev
