$ErrorActionPreference = "Stop"

Write-Host "[1/3] Building Paper plugin..." -ForegroundColor Cyan
Push-Location -Path "$PSScriptRoot\..\plugin"
mvn clean package
Pop-Location

$jarPath = "$PSScriptRoot\..\plugin\target\SimpleWhitelist.jar"
if (-not (Test-Path $jarPath)) {
    Write-Error "Build failed: SimpleWhitelist.jar was not found in plugin/target/"
    exit 1
}

$distDir = "$PSScriptRoot\..\dist"
if (-not (Test-Path $distDir)) {
    New-Item -ItemType Directory -Path $distDir | Out-Null
}

Write-Host "[2/3] Packaging plugin artifact..." -ForegroundColor Cyan
Copy-Item -Path $jarPath -Destination "$distDir\SimpleWhitelist.jar" -Force

Write-Host "[3/3] Packaging webapp bundle..." -ForegroundColor Cyan
$webappZip = "$distDir\webapp-dist.zip"
if (Test-Path $webappZip) {
    Remove-Item $webappZip -Force
}

$webappDir = "$PSScriptRoot\..\webapp"
Compress-Archive -Path "$webappDir\package.json", "$webappDir\server.js", "$webappDir\public", "$webappDir\.env.example" -DestinationPath $webappZip

Write-Host "`nRelease build complete!" -ForegroundColor Green
Write-Host "Artifacts are in: $distDir"
Get-ChildItem -Path $distDir
