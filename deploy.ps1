# deploy.ps1 — Farmavet → pet.yamasoft.workers.dev
# Uso: .\deploy.ps1
# Requer: npm, wrangler (instalados), wrangler login feito

$ErrorActionPreference = "Stop"

Write-Host "`n🐾 Farmavet — Deploy para Cloudflare Workers" -ForegroundColor Cyan
Write-Host "   URL: https://pet.yamasoft.workers.dev`n" -ForegroundColor Gray

# 1. Build de producao
Write-Host "1/2  Gerando build de producao..." -ForegroundColor Yellow
npm run build
if ($LASTEXITCODE -ne 0) { Write-Host "Erro no build." -ForegroundColor Red; exit 1 }
Write-Host "     Build OK." -ForegroundColor Green

# 2. Deploy
Write-Host "2/2  Publicando no Cloudflare..." -ForegroundColor Yellow
npx wrangler deploy
if ($LASTEXITCODE -ne 0) { Write-Host "Erro no deploy." -ForegroundColor Red; exit 1 }

Write-Host "`nDeploy concluido!" -ForegroundColor Green
Write-Host "https://pet.yamasoft.workers.dev`n" -ForegroundColor Cyan
