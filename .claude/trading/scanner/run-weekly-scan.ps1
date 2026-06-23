$scannerPath = "C:\Users\cjmil\OneDrive\Documents\claude trade\.claude\trading\scanner\scanner.js"
$logDir = "C:\Users\cjmil\OneDrive\Documents\claude trade\.claude\trading\scanner\logs"

if (-not (Test-Path $logDir)) {
    New-Item -ItemType Directory -Path $logDir | Out-Null
}

$timestamp = Get-Date -Format "yyyy-MM-dd_HHmm"
$runLog = "$logDir\task-run-$timestamp.log"

"Weekly stock scan started at $(Get-Date)" | Out-File $runLog -Encoding utf8
node $scannerPath weekly 2>&1 | Out-File $runLog -Append -Encoding utf8
"Scan completed at $(Get-Date)" | Out-File $runLog -Append -Encoding utf8
