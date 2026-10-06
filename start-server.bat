@echo off
rem Starts the Expedition's Gate dev server (SvelteKit, port 5173).
rem Run the GM model separately: Model\start-gemma26b-no-thinking.bat (port 8080).
title Expedition's Gate - dev server (port 5173)
cd /d "%~dp0expedition_gate"
if not exist node_modules (
  echo node_modules missing. Run once:
  echo   cd expedition_gate
  echo   npm install
  echo   npm run assets
  pause
  exit /b 1
)
start "" http://localhost:5173
call npm run dev
pause
