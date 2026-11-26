@echo off
title KODEX Local Server & CORS Proxy
echo Starting KODEX on http://localhost:8080 ...
start "" "http://localhost:8080"
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0start-server.ps1"
pause
