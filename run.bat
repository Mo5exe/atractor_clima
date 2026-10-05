@echo off
chcp 65001 >nul
title Atractor
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 goto :sin_node

if not exist "node_modules\@mediapipe\tasks-vision" goto :instalar
goto :modelo

:instalar
echo.
echo  Instalando lo necesario (solo la primera vez, puede tardar un minuto)...
echo.
call npm install --no-audit --no-fund

:modelo
if exist "public\models\hand_landmarker.task" goto :chrome
echo  Descargando el modelo de deteccion de manos (solo la primera vez)...
if not exist "public\models" mkdir "public\models"
curl -f -L -s -o "public\models\hand_landmarker.tmp" "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task" && move /y "public\models\hand_landmarker.tmp" "public\models\hand_landmarker.task" >nul

:chrome
rem Buscar Google Chrome para abrir el panel en una pestana nueva.
set "CHROME_PATH="
if exist "%ProgramFiles%\Google\Chrome\Application\chrome.exe" set "CHROME_PATH=%ProgramFiles%\Google\Chrome\Application\chrome.exe"
if exist "%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe" set "CHROME_PATH=%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe"
if exist "%LocalAppData%\Google\Chrome\Application\chrome.exe" set "CHROME_PATH=%LocalAppData%\Google\Chrome\Application\chrome.exe"
set "ABRIR_NAVEGADOR=1"

echo.
echo  Iniciando Atractor...
echo.
node server.js
pause
exit /b 0

:sin_node
echo.
echo  No se encontro Node.js. Instalalo desde https://nodejs.org (version LTS) y volve a abrir run.bat
echo.
pause
exit /b 1
