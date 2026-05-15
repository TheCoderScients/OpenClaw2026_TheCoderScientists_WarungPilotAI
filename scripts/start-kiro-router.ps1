$ErrorActionPreference = "Stop"

$router = "F:\Proyek Koding\Lomba\.tools\node-v24.15.0-win-x64\9router.cmd"
$workdir = "D:\Proyek_Koding\9Router"
$port = 20128
$modelsUrl = "http://127.0.0.1:$port/v1/models"

if (-not (Test-Path -LiteralPath $router)) {
  throw "9Router CLI not found at $router"
}

if (-not (Test-Path -LiteralPath $workdir)) {
  New-Item -ItemType Directory -Path $workdir | Out-Null
}

$existing = Get-NetTCPConnection -LocalPort $port -ErrorAction SilentlyContinue |
  Where-Object { $_.State -eq "Listen" } |
  Select-Object -First 1

if (-not $existing) {
  Start-Process `
    -FilePath $router `
    -ArgumentList @("--port", "$port", "--host", "127.0.0.1", "--no-browser", "--skip-update") `
    -WorkingDirectory $workdir `
    -RedirectStandardOutput (Join-Path $workdir "9router-out.log") `
    -RedirectStandardError (Join-Path $workdir "9router-err.log") `
    -WindowStyle Hidden
}

$deadline = (Get-Date).AddSeconds(25)
$lastError = $null

do {
  try {
    $models = Invoke-RestMethod -Uri $modelsUrl -TimeoutSec 5
    $kiro = $models.data | Where-Object { $_.id -eq "kr/claude-sonnet-4.5" } | Select-Object -First 1

    if ($kiro) {
      Write-Host "Kiro/9Router ready: kr/claude-sonnet-4.5"
      Write-Host $modelsUrl
      exit 0
    }

    $lastError = "9Router is running, but kr/claude-sonnet-4.5 was not listed."
  } catch {
    $lastError = $_.Exception.Message
  }

  Start-Sleep -Seconds 2
} while ((Get-Date) -lt $deadline)

throw "Kiro/9Router is not ready: $lastError"

