# Connect CampusDesk to GitHub PowerShell Script
Write-Host "=========================================================" -ForegroundColor Cyan
Write-Host "       CampusDesk - GitHub Repository Connection" -ForegroundColor Cyan
Write-Host "=========================================================`n" -ForegroundColor Cyan

# Check if git is available
if (-not (Get-Command git -ErrorAction SilentlyContinue)) {
    Write-Host "[ERROR] Git was not found on your system." -ForegroundColor Red
    Write-Host "Please install Git from https://git-scm.com/downloads and rerun this script." -ForegroundColor Yellow
    Read-Host "Press Enter to exit"
    exit 1
}

# Initialize Git
if (-not (Test-Path ".git")) {
    Write-Host "[*] Initializing local Git repository..." -ForegroundColor Green
    git init
    git branch -M main
} else {
    Write-Host "[*] Existing Git repository detected." -ForegroundColor Green
}

# Stage & Commit
Write-Host "[*] Staging files (.env files are excluded by .gitignore)..." -ForegroundColor Green
git add .

Write-Host "[*] Creating commit..." -ForegroundColor Green
git commit -m "feat: modern UI/UX redesign, deployment configs, and fullstack integration"

Write-Host "`n=========================================================" -ForegroundColor Cyan
Write-Host "STEP 2: Link with GitHub Remote" -ForegroundColor Cyan
Write-Host "=========================================================`n" -ForegroundColor Cyan
Write-Host "Create a new empty repo at: https://github.com/new" -ForegroundColor Yellow
Write-Host "(Do NOT check 'Add README', '.gitignore', or 'license')`n" -ForegroundColor Yellow

$repoUrl = Read-Host "Paste your GitHub Repo URL (e.g. https://github.com/username/repo.git)"

if ([string]::IsNullOrWhiteSpace($repoUrl)) {
    Write-Host "`n[!] No URL provided. You can push manually whenever you're ready:" -ForegroundColor Yellow
    Write-Host "    git remote add origin <your-repo-url>"
    Write-Host "    git push -u origin main`n"
    Read-Host "Press Enter to finish"
    exit 0
}

# Add remote & Push
git remote remove origin 2>$null
git remote add origin $repoUrl.Trim()

Write-Host "[*] Pushing to GitHub main branch..." -ForegroundColor Green
git push -u origin main

if ($LASTEXITCODE -eq 0) {
    Write-Host "`n[SUCCESS] Successfully pushed to GitHub!" -ForegroundColor Green
} else {
    Write-Host "`n[!] Push completed or prompted for GitHub authentication. Check browser / credential helper." -ForegroundColor Yellow
}

Read-Host "Press Enter to close"
