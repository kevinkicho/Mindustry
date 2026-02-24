@echo off
set "ARGS_TRIMMED=%*"
set "LAST_CHAR=%ARGS_TRIMMED:~-1%"
if x%LAST_CHAR% == x" (
    set "ARGS_TRIMMED=%ARGS_TRIMMED:~0,-1%"
)
echo FINAL: [%ARGS_TRIMMED%]
