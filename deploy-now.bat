@echo off
title Student Management System Multi-Platform Deployment (Vercel + Render + MongoDB)
color 0b
echo ========================================================
echo   Deploying to Vercel and Render...
echo ========================================================
echo.

set "PATH=C:\Program Files\nodejs;%PATH%"

if exist "C:\Program Files\nodejs\node.exe" (
    "C:\Program Files\nodejs\node.exe" deploy-now.js
) else (
    node deploy-now.js
)

echo.
pause
