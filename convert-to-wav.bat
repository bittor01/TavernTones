@echo off
setlocal EnableDelayedExpansion

REM ##################################################################
REM ## Batch Audio Converter using Audacity
REM ## Converts all dropped audio files (.mp3, .ogg, etc.) to WAV format.
REM ## Creates WAV files in the same directory as each input file.
REM ## Requires Audacity and the correct path set below.
REM ##################################################################

REM ## Configuration
set "audacity_path=C:\Program Files (x86)\Audacity\audacity.exe"

REM ## Check if Audacity exists
if not exist "%audacity_path%" (
    echo Audacity not found at:
    echo %audacity_path%
    echo Please update the script with the correct path.
    pause
    exit /b
)

REM ## Check if any files were dropped
if [%1]==[] (
    echo Drag and drop one or more audio files onto this script to convert.
    pause
    exit /b
)

REM ## Loop through all dropped files
for %%F in (%*) do (
    set "input_file=%%~fF"
    set "file_name=%%~nF"
    set "file_dir=%%~dpF"
    set "output_file=!file_dir!!file_name!.wav"

    echo.
    echo Converting !input_file! to !output_file!...
    "%audacity_path%" -b "!input_file!" -export "!output_file!,type=wav"
)

echo.
echo All conversions complete.
pause