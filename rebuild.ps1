<#
.SYNOPSIS
  Fire and Forget Script: Pulls latest Git branch, cleans, builds, and runs the executable.
.DESCRIPTION
  This script is designed to run automatically. It checks out the latest remote branch,
  cleans the 'build' directory (preserving 'build/Data'), runs 'npm run build', and
  starts the specified executable. Includes retry logic for critical steps.
#>

# --- Configuration ---
$MaxRetries = 3
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
        [string]$ErrorName
    )
    
    $Attempt = 0
    $Succeeded = $false
    $LogArguments = $Arguments -join ' '
    $FullArguments = @($Arguments)
    
    $CurrentMaxRetries = $MaxRetries
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
            # Execute the command directly to stream output
            & $Command @FullArguments
            
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

    if (-not $Succeeded) {
        Write-Host "FATAL ERROR: $ErrorName failed after $($CurrentMaxRetries) attempts. Aborting script." -ForegroundColor Red
        exit 1
    }
    return $true
}

# Function to determine the latest branch from remote
function Get-LatestRemoteBranch {
    Write-Host "Fetching all remote branches to find the most recent commit..." -ForegroundColor Magenta
    
    # 1. Fetch all remote data (Output suppressed to prevent the 'True' output bug)
    if (-not (Invoke-WithRetry -Command "git" -Arguments @("fetch", "--all") -ErrorName "Git Fetch All")) {
        return $null
    }
    
    # 2. List all remote branches and their last commit date, then find the newest.
    $LatestCommitBranch = git for-each-ref --sort=-committerdate --format='%(committerdate:iso):%(refname:short)' refs/remotes/origin | 
                          Select-Object -First 1

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

Write-Host "=============================================" -ForegroundColor Cyan
Write-Host "     Starting Automated Build and Run" -ForegroundColor Cyan
Write-Host "=============================================" -ForegroundColor Cyan

# 1. GIT PULL/CHECKOUT
# ----------------------
Write-Host "`n--- Git Update ---" -ForegroundColor Yellow

$TargetBranch = Get-LatestRemoteBranch
if (-not $TargetBranch) { exit 1 } 

# Checkout the determined branch
Invoke-WithRetry -Command "git" -Arguments @("checkout", $TargetBranch) -ErrorName "Git Checkout"

# Pull the latest code for that branch
Invoke-WithRetry -Command "git" -Arguments @("pull") -ErrorName "Git Pull"


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