param()

# Navigate to project root (parent of scripts directory)
$RepoRoot = Split-Path -Parent $PSScriptRoot
Set-Location $RepoRoot

Write-Host "[Setup] Project root: $RepoRoot" -ForegroundColor Cyan

# Check Python
try {
    $pyv = python --version 2>$null
    if (-not $LASTEXITCODE -eq 0) { throw "python not found" }
    Write-Host "[Setup] $(python --version) detected" -ForegroundColor Green
} catch {
    Write-Host "[Setup][Error] Python not found on PATH. Install Python 3.10+ and retry." -ForegroundColor Red
    Write-Host "Visit https://www.python.org/downloads/ (ensure 'Add python.exe to PATH' is checked)" -ForegroundColor Yellow
    exit 1
}

# Create venv if missing
if (-not (Test-Path ".\.venv")) {
    Write-Host "[Setup] Creating virtual environment (.venv)..." -ForegroundColor Cyan
    python -m venv .venv
}

$VenvPy = Join-Path $RepoRoot ".venv/Scripts/python.exe"
if (-not (Test-Path $VenvPy)) {
    Write-Host "[Setup][Error] Virtual environment not created successfully." -ForegroundColor Red
    exit 1
}

# Upgrade pip and install requirements
& $VenvPy -m pip install --upgrade pip
& $VenvPy -m pip install -r .\requirements.txt

# Ensure model folder exists
$ModelDir = Join-Path $RepoRoot "assets/models"
New-Item -ItemType Directory -Force -Path $ModelDir | Out-Null

$ModelPath = Join-Path $ModelDir "gesture_recognizer.task"
if (-not (Test-Path $ModelPath)) {
    Write-Host "[Setup] Place the model at: $ModelPath" -ForegroundColor Yellow
    Write-Host "        Or set GESTURE_MODEL_PATH before running." -ForegroundColor Yellow
    Write-Host "        Get the model: https://developers.google.com/mediapipe/solutions/vision/gesture_recognizer" -ForegroundColor Yellow
}

Write-Host "[Setup] Done. Use scripts/run.ps1 to start the app." -ForegroundColor Green
