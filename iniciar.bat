@echo off
cd /d "%~dp0"

where py >nul 2>nul
if %errorlevel%==0 (
  py -m http.server 8000 --bind 0.0.0.0
  goto :fin
)

where python >nul 2>nul
if %errorlevel%==0 (
  python -m http.server 8000 --bind 0.0.0.0
  goto :fin
)

echo No se encontro Python en esta PC.
echo Instalalo desde https://www.python.org/downloads/windows/
echo Durante la instalacion marca "Add Python to PATH".
pause

:fin
