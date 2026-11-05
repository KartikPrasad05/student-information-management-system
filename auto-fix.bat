@echo off
set "PATH=C:\Program Files\nodejs;%PATH%"

if exist "C:\Program Files\nodejs\node.exe" (
    "C:\Program Files\nodejs\node.exe" auto-fix-all-replicas.js
) else (
    node auto-fix-all-replicas.js
)
pause
