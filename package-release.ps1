$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot
npm run build
$releaseRoot = Join-Path $PSScriptRoot "release"
$archive = Join-Path $PSScriptRoot "job-application-agent-release.zip"
if (Test-Path $releaseRoot) { Remove-Item -LiteralPath $releaseRoot -Recurse -Force }
if (Test-Path $archive) { Remove-Item -LiteralPath $archive -Force }
New-Item -ItemType Directory -Path $releaseRoot | Out-Null
$include = @("src", "public", "prisma", "package.json", "package-lock.json", "next.config.ts", "tsconfig.json", "vitest.config.ts", "eslint.config.mjs", "README.md", ".env.example", "start-agent.bat", "start-agent.ps1")
foreach ($item in $include) { Copy-Item -LiteralPath $item -Destination (Join-Path $releaseRoot $item) -Recurse -Force }
Compress-Archive -Path (Join-Path $releaseRoot "*") -DestinationPath $archive -CompressionLevel Optimal
Remove-Item -LiteralPath $releaseRoot -Recurse -Force
Write-Output "Created $archive"
