@echo off
setlocal

REM ##################################################################
REM ## This script converts audio files to WAV files using ffmpeg.
REM ##
REM ## To use it, drag and drop one or more audio files onto this script.
REM ## WAV files with the same names will be created in a "wavconverts" subfolder.
REM ##
REM ## Requirements:
REM ## - ffmpeg must be installed and in your system's PATH.
REM ##################################################################

REM ## Main Script
REM ##################################################################
REM ## Check if any files were dropped on the script.
if [%1]==[] (
    echo "To use this script, drag and drop one or more audio files onto it."
    pause
    exit /b
)

REM ## Create the output directory if it doesn't exist.
if not exist "wavconverts" mkdir "wavconverts"

REM ## Loop through all the dropped files.
for %%f in (%*) do (
    REM ## Get the file name without the extension.
    set "file_name=%%~nf"

    REM ## Set the output file path.
    set "output_file=wavconverts\%file_name%.wav"

    REM ## Run the ffmpeg command to convert the file.
    echo "Converting %%f to %output_file%..."
    ffmpeg -i "%%f" -acodec pcm_s16le -ar 44100 -ac 2 "%output_file%"
)

echo "Conversion complete."
pause
REM ##################################################################
