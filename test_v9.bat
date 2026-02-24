@echo off
setlocal enabledelayedexpansion
set "CMD_ARGS="
for %%x in (%*) do (
    set "CMD_ARGS=!CMD_ARGS! %%x"
)
echo FINAL: [!CMD_ARGS!]
