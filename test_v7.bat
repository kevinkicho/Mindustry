@echo off
setlocal enabledelayedexpansion
set "FINAL_ARGS="
for %%a in (%*) do (
    set "FINAL_ARGS=!FINAL_ARGS! %%a"
)
echo FINAL: [!FINAL_ARGS!]
