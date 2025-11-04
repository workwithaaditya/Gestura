param()

Write-Host "[Pre-deployment Check] Verifying web app is ready for Vercel..." -ForegroundColor Cyan

$WebRoot = Split-Path -Parent $PSScriptRoot
$ModelPath = Join-Path $WebRoot "public\models\gesture_recognizer.task"
$AllGood = $true

# 1. Check if model file exists
Write-Host "`n1. Checking for model file..." -ForegroundColor Yellow
if (Test-Path $ModelPath) {
    $SizeMB = [math]::Round((Get-Item $ModelPath).Length / 1MB, 2)
    Write-Host "   [OK] Model file found: $ModelPath ($SizeMB MB)" -ForegroundColor Green
    
    if ($SizeMB -gt 100) {
        Write-Host "   [WARN] File is over 100MB. Consider using Git LFS." -ForegroundColor Yellow
        Write-Host "     Run: git lfs track 'public/models/*.task'" -ForegroundColor Gray
    }
} else {
    Write-Host "   [FAIL] Model file NOT found at: $ModelPath" -ForegroundColor Red
    Write-Host "     Download from: https://developers.google.com/mediapipe/solutions/vision/gesture_recognizer" -ForegroundColor Gray
    $AllGood = $false
}

# 2. Check if node_modules exists (dependencies installed)
Write-Host "`n2. Checking dependencies..." -ForegroundColor Yellow
if (Test-Path (Join-Path $WebRoot "node_modules")) {
    Write-Host "   [OK] Dependencies installed (node_modules found)" -ForegroundColor Green
} else {
    Write-Host "   [FAIL] Dependencies NOT installed" -ForegroundColor Red
    Write-Host "     Run: npm install" -ForegroundColor Gray
    $AllGood = $false
}

# 3. Check package.json for vulnerabilities
Write-Host "`n3. Checking for npm vulnerabilities..." -ForegroundColor Yellow
$AuditOutput = & npm audit --json 2>$null | ConvertFrom-Json
if ($AuditOutput.metadata.vulnerabilities.total -eq 0) {
    Write-Host "   [OK] No vulnerabilities found" -ForegroundColor Green
} else {
    $Critical = $AuditOutput.metadata.vulnerabilities.critical
    $High = $AuditOutput.metadata.vulnerabilities.high
    if ($Critical -gt 0 -or $High -gt 0) {
        Write-Host "   [WARN] Found $Critical critical and $High high vulnerabilities" -ForegroundColor Yellow
        Write-Host "     Run: npm audit fix" -ForegroundColor Gray
    } else {
        Write-Host "   [OK] Only low/moderate vulnerabilities (acceptable)" -ForegroundColor Green
    }
}

# 4. Check git status
Write-Host "`n4. Checking git status..." -ForegroundColor Yellow
$GitRoot = Split-Path -Parent $WebRoot
Push-Location $GitRoot
$GitStatus = git status --porcelain 2>$null
Pop-Location

if ($LASTEXITCODE -ne 0) {
    Write-Host "   [WARN] Not a git repository or git not available" -ForegroundColor Yellow
} else {
    $ModelInGit = git ls-files --error-unmatch "web/public/models/gesture_recognizer.task" 2>$null
    if ($LASTEXITCODE -eq 0) {
        Write-Host "   [OK] Model file is tracked in git" -ForegroundColor Green
    } else {
        Write-Host "   [FAIL] Model file NOT committed to git" -ForegroundColor Red
        Write-Host "     Run: git add web/public/models/gesture_recognizer.task" -ForegroundColor Gray
        Write-Host "           git commit -m 'Add gesture model'" -ForegroundColor Gray
        $AllGood = $false
    }
    
    if ($GitStatus) {
        Write-Host "   [WARN] Uncommitted changes detected" -ForegroundColor Yellow
        Write-Host "     Commit changes before deploying" -ForegroundColor Gray
    }
}

# 5. Summary
Write-Host "`n" -NoNewline
if ($AllGood) {
    Write-Host "============================================" -ForegroundColor Green
    Write-Host "[OK] All checks passed! Ready to deploy." -ForegroundColor Green
    Write-Host "============================================" -ForegroundColor Green
    Write-Host "`nDeploy with:" -ForegroundColor Cyan
    Write-Host "  npx vercel" -ForegroundColor White
    Write-Host "or push to GitHub and deploy via Vercel dashboard.`n" -ForegroundColor Gray
} else {
    Write-Host "============================================" -ForegroundColor Red
    Write-Host "[FAIL] Pre-deployment checks failed." -ForegroundColor Red
    Write-Host "============================================" -ForegroundColor Red
    Write-Host "`nFix the issues above before deploying.`n" -ForegroundColor Yellow
    exit 1
}
