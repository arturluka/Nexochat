@echo off
cd /d "%~dp0"
if not exist .env copy .env.example .env >nul
if not exist node_modules (
  call npm install
  if errorlevel 1 exit /b 1
)
echo NexoChat: abra http://localhost:5173 quando os servidores iniciarem.
call npm run dev
