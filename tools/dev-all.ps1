$serverProcess = $null

function Stop-PortProcess($port) {
  $connections = Get-NetTCPConnection -LocalPort $port -ErrorAction SilentlyContinue

  foreach ($connection in $connections) {
    if ($connection.OwningProcess) {
      $process = Get-Process -Id $connection.OwningProcess -ErrorAction SilentlyContinue
      if ($process) {
        Stop-Process -Id $process.Id -Force -ErrorAction SilentlyContinue
      }
    }
  }
}

function Start-KioskBrowser($url) {
  $candidates = @('msedge', 'chrome')

  foreach ($candidate in $candidates) {
    $command = Get-Command $candidate -ErrorAction SilentlyContinue
    if ($command -and $command.Source) {
      Start-Process -FilePath $command.Source -ArgumentList "--app=$url"
      return $true
    }
  }

  return $false
}

try {
  $projectRoot = Resolve-Path (Join-Path $PSScriptRoot '..')
  Stop-PortProcess 3001
  Stop-PortProcess 5174

  $appUrl = $env:TOTEM_BITE_FRONTEND_URL
  if (-not $appUrl) {
    $appUrl = 'http://localhost:5174'
  }

  $serverCommand = "Set-Location '$projectRoot'; npm.cmd run server"
  $serverProcess = Start-Process powershell.exe -ArgumentList "-NoLogo", "-NoProfile", "-Command", $serverCommand -PassThru

  Start-Sleep -Seconds 2

  Set-Location $projectRoot
  Start-KioskBrowser $appUrl | Out-Null
  npm.cmd run dev -- --host
}
finally {
  if ($serverProcess -and (Get-Process -Id $serverProcess.Id -ErrorAction SilentlyContinue)) {
    Stop-Process -Id $serverProcess.Id -Force
  }
}
