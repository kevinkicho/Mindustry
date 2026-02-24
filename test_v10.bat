@echo off
set "FINAL_ARGS="
:argLoop
if "%~1" == "" goto finish
@rem If it's a quote, it might be the trailing one. 
@rem But Gradle tasks don't usually start with quotes unless quoted.
set "FINAL_ARGS=%FINAL_ARGS% %1"
shift
goto argLoop
:finish
echo FINAL: [%FINAL_ARGS%]
