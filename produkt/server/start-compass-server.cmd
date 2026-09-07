@echo off
rem Startet den Compass-Server auf diesem Rechner und oeffnet die Statusseite im Browser.
rem Dieses Fenster offen lassen - beim Schliessen stoppt der Server.
rem Einrichtung (Claude-Abo, API-Schluessel oder ohne KI): README.md im selben Ordner.
title Compass-Server (Fenster offen lassen)
cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0compass-server.ps1" -OpenBrowser
echo.
echo Server beendet. Fenster kann geschlossen werden.
pause
