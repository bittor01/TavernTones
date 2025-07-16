@echo off
setlocal

REM ##################################################################
REM ## This script converts an audio file to a WAV file using Audacity.
REM ##
REM ## To use it, drag and drop an audio file (.mp3, .ogg, etc.) onto this script.
REM ## A WAV file with the same name will be created in the same directory.
REM ##
REM ## Requirements:
REM ## - Audacity must be installed.
REM ## - The script assumes Audacity is installed in the default location.
REM ##   If not, you will need to edit the audacity_path variable below.
REM ##################################################################

REM ## Configuration
REM ##################################################################
REM ## Set the path to the Audacity executable.
REM ## If Audacity is in your system's PATH, you can just use "audacity".
set "audacity_path=C:\Program Files\Audacity\audacity.exe"
REM ##################################################################

REM ## Main Script
REM ##################################################################
REM ## Check if a file was dropped on the script.
if [%1]==[] (
    echo "To use this script, drag and drop an audio file onto it."
    pause
    exit /b
)

REM ## Get the full path of the dropped file.
set "input_file=%~1"

REM ## Get the file name without the extension.
set "file_name=%~n1"

REM ## Get the directory of the dropped file.
set "file_dir=%~dp1"

REM ## Set the output file path.
set "output_file=%file_dir%%file_name%.wav"

REM ## Check if Audacity is installed at the specified path.
if not exist "%audacity_path%" (
    echo "Audacity not found at the specified path:"
    echo "%audacity_path%"
    echo "Please edit this script to set the correct path to Audacity."
    pause
    exit /b
)

REM ## Run the Audacity command to convert the file.
echo "Converting %input_file% to %output_file%..."
"%audacity_path%" -batch "%input_file%" -export "%output_file%,type=wav"

echo "Conversion complete."
pause
REM ##################################################################
