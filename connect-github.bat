@echo off
title Connect CampusDesk to GitHub
color 0b
echo =========================================================
echo       CampusDesk - GitHub Repository Connection
echo =========================================================
echo.

:: Check if Git is installed
where git >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] Git is not installed or not in your PATH.
    echo Please install Git from https://git-scm.com/downloads and try again.
    pause
    exit /b 1
)

:: Initialize Git if not already initialized in current directory
if not exist .git (
    echo [*] Initializing Git repository in current folder...
    git init
    git branch -M main
) else (
    echo [*] Existing Git repository detected.
)

echo [*] Staging all files (respecting .gitignore to protect secrets)...
git add .

echo [*] Creating commit...
git commit -m "feat: complete three-tier architecture with modern UI, MCP server, Vercel, and Render"

echo.
echo =========================================================
echo STEP 2: Link & Push to GitHub Remote
echo =========================================================
echo.

:: Check if remote origin already exists
git remote get-url origin >nul 2>nul
if %errorlevel% equ 0 (
    for /f "tokens=*" %%a in ('git remote get-url origin') do set CURRENT_ORIGIN=%%a
    echo [*] Existing remote detected: !CURRENT_ORIGIN!
    echo [*] Pushing code to origin main...
    git push -u origin main
    if %errorlevel% equ 0 (
        echo.
        echo [SUCCESS] Your repository has been pushed to GitHub successfully!
        echo.
        pause
        exit /b 0
    )
)

echo Default repository: https://github.com/KartikPrasad05/student-information-management-system.git
set "DEFAULT_URL=https://github.com/KartikPrasad05/student-information-management-system.git"
set /p REPO_URL="Enter GitHub Repository URL [Press Enter for default]: "

if "%REPO_URL%"=="" set "REPO_URL=%DEFAULT_URL%"

echo.
echo [*] Setting remote origin to: %REPO_URL%
git remote remove origin 2>nul
git remote add origin %REPO_URL%

echo [*] Pushing code to GitHub (main branch)...
git push -u origin main --force

echo.
if %errorlevel% equ 0 (
    echo [SUCCESS] Your repository has been pushed to GitHub successfully!
) else (
    echo [NOTE] If prompted, please complete GitHub sign-in in your browser window.
)
echo.
pause
