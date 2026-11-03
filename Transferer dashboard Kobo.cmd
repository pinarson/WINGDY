@echo off
setlocal
cd /d "%~dp0"
set "WING_NODE=node"
where node >nul 2>nul
if errorlevel 1 (
  if exist "C:\pinokio\bin\miniconda\node.exe" (
    set "WING_NODE=C:\pinokio\bin\miniconda\node.exe"
  ) else (
    echo Node.js existant introuvable. Aucune copie effectuee.
    pause
    exit /b 1
  )
)
"%WING_NODE%" "%~dp0scripts\transfer-kobo.mjs" %*
set "WING_TRANSFER_RESULT=%ERRORLEVEL%"
if "%~1"=="" pause
exit /b %WING_TRANSFER_RESULT%
