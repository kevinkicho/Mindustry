@echo off
echo Starting Mindustry Asset Dashboard...

start cmd /k "cd scripts\dashboard && node server.js"
start cmd /k "cd scripts\dashboard\client && npm run dev"

echo.
echo Dashboard is starting.
echo 1. Backend: http://localhost:3001
echo 2. Frontend: http://localhost:5173 (Open this one in your browser!)
echo.
pause
