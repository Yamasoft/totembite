@echo off
cd /d %~dp0

echo.
echo ===== ATUALIZANDO PROJETO =====
echo.

git add .

set /p msg=Digite a mensagem do commit: 

git commit -m "%msg%"
git push

echo.
echo ===== FINALIZADO! =====
pause