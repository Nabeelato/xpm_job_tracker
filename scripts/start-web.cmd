@echo off
cd /d "%~dp0.."
set "NODE_ENV=production"
node server.js > next-task.log 2> next-task-err.log
