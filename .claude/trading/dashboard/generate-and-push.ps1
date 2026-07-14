# generate-and-push.ps1
# Regenerates the trading dashboard then pushes dashboard-view/ to GitHub
# so it is immediately live at the GitHub Pages URL.
# Called by Windows Task Scheduler at 9:00 AM daily.

$ErrorActionPreference = "Stop"
$RepoRoot = "I:\My Drive\claude trade"
$LogFile  = "$RepoRoot\.claude\trading\dashboard\logs\push-log.txt"

function Log($msg) {
    $line = "[$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')] $msg"
    Write-Output $line
    Add-Content -Path $LogFile -Value $line
}

Log "=== Dashboard generate-and-push started ==="

# 1. Generate dashboard
Log "Running dashboard.js..."
& "C:\Program Files\nodejs\node.exe" "$RepoRoot\.claude\trading\dashboard\dashboard.js"
if ($LASTEXITCODE -ne 0) {
    Log "ERROR: dashboard.js failed with exit code $LASTEXITCODE"
    exit 1
}
Log "Dashboard generated OK"

# 2. Stage dashboard-view/
Log "Staging dashboard-view/..."
Set-Location $RepoRoot
& git add dashboard-view/
if ($LASTEXITCODE -ne 0) { Log "ERROR: git add failed"; exit 1 }

# 3. Check if anything changed before committing
$status = & git status --porcelain dashboard-view/
if (-not $status) {
    Log "No changes in dashboard-view/ — skipping commit"
    exit 0
}

# 4. Commit
$dateStr = Get-Date -Format "yyyy-MM-dd HH:mm"
& git commit -m "Dashboard update $dateStr"
if ($LASTEXITCODE -ne 0) { Log "ERROR: git commit failed"; exit 1 }
Log "Committed"

# 5. Push
Log "Pushing to GitHub..."
& git push origin master
if ($LASTEXITCODE -ne 0) { Log "ERROR: git push failed"; exit 1 }
Log "Pushed OK — GitHub Pages will update in ~30 seconds"
Log "=== Done ==="
