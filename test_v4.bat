@echo off
set "ARGS_TRIMMED=%*"
echo RAW: [%ARGS_TRIMMED%]
set "LAST_CHAR=%ARGS_TRIMMED:~-1%"
echo LAST: [%LAST_CHAR%]
if "%LAST_CHAR%"==""" (
    set "ARGS_TRIMMED=%ARGS_TRIMMED:~0,-1%"
)
echo FINAL: [%ARGS_TRIMMED%]
