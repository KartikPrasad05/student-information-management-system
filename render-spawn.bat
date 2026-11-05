@echo off
title Render Container Duplicator
color 0b
echo ========================================================
echo   Spawning duplicate container service on Render...
echo ========================================================
echo.

set "PATH=C:\Program Files\nodejs;%PATH%"

if exist "C:\Program Files\nodejs\node.exe" (
    "C:\Program Files\nodejs\node.exe" render-spawn.js
) else (
    node render-spawn.js
)

echo.
pause
