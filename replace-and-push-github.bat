@echo off
title Replace and Push Clean Code to GitHub
color 0b
echo ====================================================================
echo   CampusDesk · Clean Force Push to GitHub Repository
echo   Target: https://github.com/KartikPrasad05/student-information-management-system
echo ====================================================================
echo.
echo [!] NOTE: This will completely replace and overwrite all old files in
echo     your GitHub repository with the new, clean, 100%% complete project.
echo.

:: Ensure we are in the script's directory (D:\AgriNet\AWS\P1\P1)
cd /d "%~dp0"
set "PATH=C:\Program Files\Git\cmd;C:\Program Files\nodejs;%PATH%"

:: 1. Reinitialize git repository cleanly
echo [*] Step 1/4: Reinitializing clean local Git repository...
if exist .git (
    attrib -h .git /s /d >nul 2>nul
    rmdir /s /q .git
)
git init
git branch -M main

:: 2. Set origin remote
echo [*] Step 2/4: Setting remote repository...
git remote add origin https://github.com/KartikPrasad05/student-information-management-system.git

:: 3. Stage all files (protecting secrets via .gitignore)
echo [*] Step 3/4: Staging all updated project files...
git add .

echo [*] Creating fresh production commit...
git commit -m "feat: complete modern three-tier student information system (Vercel, Render, Atlas, MCP)"

:: 4. Force push to overwrite remote
echo.
echo [*] Step 4/4: Force-pushing to GitHub (wiping old files and replacing with new)...
git push -u origin main --force

echo.
if %errorlevel% equ 0 (
    echo ====================================================================
    echo   [SUCCESS] Old files deleted and new project pushed successfully!
    echo   Check your repo: https://github.com/KartikPrasad05/student-information-management-system
    echo ====================================================================
) else (
    echo ====================================================================
    echo   [!] If prompted by Git Credential Manager, complete sign-in in browser.
    echo   Once authenticated, re-run this script to finish pushing.
    echo ====================================================================
)
echo.
pause
