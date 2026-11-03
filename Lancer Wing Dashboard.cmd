@echo off
setlocal
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  if exist "C:\pinokio\bin\miniconda\node.exe" (
    set "PATH=C:\pinokio\bin\miniconda;%PATH%"
  ) else (
    echo Node.js 22.12 ou plus recent est requis.
    pause
    exit /b 1
  )
)
where npm >nul 2>nul
if errorlevel 1 (
  echo npm est introuvable. Installer Node.js avec npm.
  pause
  exit /b 1
)
if not exist "node_modules\vite\bin\vite.js" (
  echo Installation des dependances...
  call npm install --no-audit --no-fund
  if errorlevel 1 (
    echo Installation impossible. Consulter les erreurs ci-dessus.
    pause
    exit /b 1
  )
)
echo.
echo Web  : http://127.0.0.1:5173/
echo Kobo : http://127.0.0.1:5173/kobo/?spot=tharon
echo Garder cette fenetre ouverte. Ctrl+C pour arreter.
call npm run dev -- --port 5173 --strictPort --open
if errorlevel 1 pause
