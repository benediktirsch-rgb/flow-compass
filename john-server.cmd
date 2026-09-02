@echo off
rem Startet den Cockpit-/John-Server; der Server oeffnet das Dashboard selbst, sobald er lauscht.
rem Schluessel: Umgebungsvariable ANTHROPIC_API_KEY (User-Scope) oder john-api-key.txt neben diesem Skript.
rem Dieses Fenster offen lassen - beim Schliessen stoppt der Server (und spiegelt vorher nach Google Drive).
title John ^& Cockpit - Server (Fenster offen lassen)
cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0john-server.ps1" -OpenBrowser
echo.
echo Server beendet. Fenster kann geschlossen werden.
pause
