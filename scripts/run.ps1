param(
  [string]$ModelPath
)

# Navigate to project root (parent of scripts directory)
$RepoRoot = Split-Path -Parent $PSScriptRoot
Set-Location $RepoRoot

$VenvPy = Join-Path $RepoRoot ".venv/Scripts/python.exe"
if (-not (Test-Path $VenvPy)) {
    Write-Host "[Run][Error] .venv not found. Run scripts/setup.ps1 first." -ForegroundColor Red
    exit 1
}

if ($ModelPath) {
    $env:GESTURE_MODEL_PATH = $ModelPath
    Write-Host "[Run] Using model override: $env:GESTURE_MODEL_PATH" -ForegroundColor Cyan
}

Write-Host "[Run] Starting application..." -ForegroundColor Green
& $VenvPy .\3d-gesture-control.py
