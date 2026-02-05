<#
.SYNOPSIS
  Fire and Forget Script: Pulls latest Git branch, cleans, builds, and runs the executable.
.DESCRIPTION
  This script is designed to run automatically. It checks out the latest remote branch,
  cleans the 'build' directory (preserving 'build/Data'), runs 'npm run build', and
  starts the specified executable. Includes retry logic for critical steps.
#>

# --- Configuration ---
$MaxRetries = 9
$ExecutablePath = "build/TavernTones.exe"
$DataDirToKeep = "build/Data"
# ---------------------

# Function to execute a command and handle retries
function Invoke-WithRetry {
    param(
        [Parameter(Mandatory=$true)]
        [string]$Command,
        [Parameter(Mandatory=$true)]
        [string[]]$Arguments, 
        [Parameter(Mandatory=$true)]
        [string]$ErrorName,
        [Parameter(Mandatory=$false)]
        [string]$WorkingDirectory
    )
    
    $Attempt = 0
    $Succeeded = $false
    $LogArguments = $Arguments -join ' '
    # No need for $FullArguments = @($Arguments) if $Arguments is already a string array
    
    $CurrentMaxRetries = $global:MaxRetries
    
    $ContinueLoop = $true
    while ($ContinueLoop) {
        $Attempt++
        
        if ($CurrentMaxRetries -ge 0 -and $Attempt -gt $CurrentMaxRetries) {
            $ContinueLoop = $false
            break
        }
        
        $RetryDisplay = if ($CurrentMaxRetries -lt 0) {"(Indefinite Retry)"} else {"$Attempt of $CurrentMaxRetries"}
        Write-Host "Attempt ${RetryDisplay}: Running '$Command $LogArguments' for ${ErrorName}..." -ForegroundColor Yellow
        
        try {
            if ($WorkingDirectory) {
                Set-Location $WorkingDirectory
            }
            
            # THE CRITICAL FIX: Use the comma and @ array notation to ensure arguments are passed correctly.
            # We must use @Arguments to correctly pass the array of strings to the external command.
            # THE ROBUST FIX: Use a sub-expression to guarantee proper argument parsing for native executables.
            $CommandString = "$Command " + ($Arguments -join ' ')
            Invoke-Expression -Command $CommandString
            
            if ($LASTEXITCODE -eq 0) {
                Write-Host "SUCCESS: $ErrorName completed successfully." -ForegroundColor Green
                $Succeeded = $true
                $ContinueLoop = $false
                break
            } else {
                Write-Host "ERROR: '$Command' failed with exit code $LASTEXITCODE. Retrying..." -ForegroundColor Red
            }
        }
        catch {
            Write-Host "EXCEPTION: An exception occurred while running '$Command': $($_.Exception.Message). Retrying..." -ForegroundColor Red
        }
        
        if ($ContinueLoop) {
            Start-Sleep -Seconds 5 
        }
    }
    
    Set-Location $ScriptBaseDir

    if (-not $Succeeded) {
        Write-Host "FATAL ERROR: $ErrorName failed after $($CurrentMaxRetries) attempts. Aborting script." -ForegroundColor Red
        return $false
    }
    return $true
}


# Function to determine the latest branch from remote
function Get-LatestRemoteBranch {
    param(
        [Parameter(Mandatory=$true)]
        [string]$WorkingDirectory
    )
    Write-Host "Fetching all remote branches to find the most recent commit..." -ForegroundColor Magenta
    
    # 1. Fetch all remote data (Output suppressed to prevent the 'True' output bug)
    if (-not (Invoke-WithRetry -Command "git" -Arguments @("fetch", "--all") -ErrorName "Git Fetch All" -WorkingDirectory $WorkingDirectory)) {
        return $null
    }
    
    # 2. List all remote branches and their last commit date, then find the newest.
    Set-Location $WorkingDirectory
    $LatestCommitBranch = git for-each-ref --sort=-committerdate --format='%(committerdate:iso):%(refname:short)' refs/remotes/origin | 
                            Select-Object -First 1
    Set-Location $ScriptBaseDir # Restore location
                            
    if (-not $LatestCommitBranch) {
        Write-Host "ERROR: Could not determine the latest remote branch." -ForegroundColor Red
        return $null
    }

    # Extract the branch name (after the colon)
    $BranchToCheckout = ($LatestCommitBranch -split ':')[-1] -replace 'origin/', ''
    
    Write-Host "Found remote branch with latest commit: '$BranchToCheckout'" -ForegroundColor Green
    return $BranchToCheckout
}

# --- Main Script Execution ---

# Global variable to hold the script's original location (make sure this is still defined)
$ScriptBaseDir = Split-Path -Parent $MyInvocation.MyCommand.Definition

Write-Host "=============================================" -ForegroundColor Cyan
Write-Host "     Starting Automated Build and Run" -ForegroundColor Cyan
Write-Host "=============================================" -ForegroundColor Cyan


# 1. GIT PULL/CHECKOUT
# ----------------------
Write-Host "`n--- Git Update ---" -ForegroundColor Yellow

# Global variable to hold the script's original location (define at the top if not already)
$ScriptBaseDir = Split-Path -Parent $MyInvocation.MyCommand.Definition

$GitWorkingDir = "."

$TargetBranch = Get-LatestRemoteBranch -WorkingDirectory $GitWorkingDir
if (-not $TargetBranch) { exit 1 } 

# Checkout the determined branch
# FIX: Use if ( -not (...) ) to both check for success and suppress the $true output
if (-not (Invoke-WithRetry -Command "git" -Arguments @("checkout", $TargetBranch) -ErrorName "Git Checkout" -WorkingDirectory $GitWorkingDir)) { exit 1 }

# Pull the latest code for that branch
# FIX: Use if ( -not (...) ) to both check for success and suppress the $true output
if (-not (Invoke-WithRetry -Command "git" -Arguments @("pull") -ErrorName "Git Pull" -WorkingDirectory $GitWorkingDir)) { exit 1 }


# 2. CLEANUP BUILD DIRECTORY (Excluding /build/Data)
# ---------------------------------------------------
Write-Host "`n--- Cleaning Build Directory ---" -ForegroundColor Yellow

if (Test-Path ".\build") {
    Write-Host "Cleaning 'build' directory, preserving '$DataDirToKeep'..." -ForegroundColor DarkGray
    
    # Get all items in 'build'
    Get-ChildItem -Path ".\build" -Force | ForEach-Object {
        # Check if the item is NOT the /Data directory
        if ($_.FullName -ne (Resolve-Path $DataDirToKeep).Path) {
            try {
                Remove-Item -Path $_.FullName -Recurse -Force
            } catch {
                Write-Host "WARNING: Failed to delete $($_.Name): $($_.Exception.Message)" -ForegroundColor Magenta
            }
        }
    }
    Write-Host "Cleanup complete." -ForegroundColor Green
} else {
    Write-Host "'build' directory not found. Skipping cleanup." -ForegroundColor DarkGray
}

# 3. RUN NPM BUILD
# -----------------
Write-Host "`n--- Running NPM Build ---" -ForegroundColor Yellow
Invoke-WithRetry -Command "npm" -Arguments @("run", "build") -ErrorName "NPM Build"
Invoke-WithRetry -Command "npm" -Arguments @("run", "installer") -ErrorName "NPM Installer"

# 4. START EXECUTABLE (Fire and Forget)
# ---------------------------------------
Write-Host "`n--- Starting Executable ---" -ForegroundColor Yellow

if (Test-Path $ExecutablePath) {
    # 'Start-Process' is the standard way to launch an executable and detach from the script.
    Start-Process -FilePath $ExecutablePath
    Write-Host "Successfully launched '$ExecutablePath'." -ForegroundColor Green
} else {
    Write-Host "FATAL ERROR: Executable not found at '$ExecutablePath'. Build failed or path is wrong." -ForegroundColor Red
    exit 1
}

Write-Host "`n=============================================" -ForegroundColor Cyan
Write-Host "     Script Finished Successfully" -ForegroundColor Cyan
Write-Host "=============================================" -ForegroundColor Cyan