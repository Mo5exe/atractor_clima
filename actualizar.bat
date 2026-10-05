@echo off
chcp 65001 >nul
title Atractor - Actualizar
cd /d "%~dp0"
echo.
echo  Bajando la ultima version desde GitHub...
echo  ^(Tus presets guardados no se tocan^)
echo.
git pull
if errorlevel 1 (
  echo.
  echo  No se pudo actualizar. Pasale una captura de esta ventana a Claude.
  echo.
  pause
  exit /b 1
)
echo.
echo  Instalando dependencias nuevas si hacen falta...
call npm install --no-audit --no-fund
echo.
echo  Listo. Ahora abri run.bat
echo.
pause
