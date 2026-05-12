$ErrorActionPreference = 'Stop'

$root = 'C:\app_compras'

function Test-LocalUrl($url) {
  try {
    $response = Invoke-WebRequest -UseBasicParsing -Uri $url -TimeoutSec 5
    return $response.StatusCode -ge 200 -and $response.StatusCode -lt 500
  } catch {
    return $false
  }
}

function Start-HiddenPowerShell($name, $command, $pidFile) {
  $existingPid = $null
  if (Test-Path $pidFile) {
    $rawPid = (Get-Content $pidFile -ErrorAction SilentlyContinue | Select-Object -First 1)
    if ([int]::TryParse($rawPid, [ref]$existingPid)) {
      if (Get-Process -Id $existingPid -ErrorAction SilentlyContinue) {
        Write-Output "$name ja esta rodando no PID $existingPid"
        return
      }
    }
  }

  $process = Start-Process powershell.exe `
    -WindowStyle Hidden `
    -ArgumentList '-NoLogo', '-NoProfile', '-Command', $command `
    -PassThru

  Set-Content -Path $pidFile -Value $process.Id -Encoding ASCII
  Write-Output "$name iniciado no PID $($process.Id)"
}

Set-Location $root

if (-not (Test-LocalUrl 'http://127.0.0.1:3001/api/health')) {
  Start-HiddenPowerShell `
    -name 'API Totem Bite' `
    -pidFile "$root\totembite-api.pid" `
    -command "Set-Location $root; npm.cmd run server *> $root\totembite-api.log"
} else {
  Write-Output 'API Totem Bite ja responde na porta 3001'
}

Start-HiddenPowerShell `
  -name 'Tunnel Totem Bite' `
  -pidFile "$root\totembite-cloudflared.pid" `
  -command "Set-Location $root; cloudflared.exe tunnel --config $root\cloudflared-totembite.yml run *> $root\totembite-cloudflared.log"

Write-Output 'URL publica: https://app-totembite.yamasoft.com.br/'
Write-Output 'Healthcheck: https://app-totembite.yamasoft.com.br/api/health'
