@echo off
set "ARGS_TRIMMED=%*"
if not defined ARGS_TRIMMED goto finish
set "LAST_CHAR=%ARGS_TRIMMED:~-1%"
if x%LAST_CHAR% == x" goto strip
goto finish
:strip
set "ARGS_TRIMMED=%ARGS_TRIMMED:~0,-1%"
:finish
echo FINAL: [%ARGS_TRIMMED%]
