# Finish Supabase → Vercel wiring after you create the project.
# Usage (PowerShell):
#   .\scripts\finish-supabase-setup.ps1 `
#     -Url "https://xxxx.supabase.co" `
#     -AnonKey "eyJ..." `
#     -AllowedEmails "you@mail.com:Jeeva,sriram@mail.com:Sriram,sneha@mail.com:Sneha"

param(
  [Parameter(Mandatory = $true)][string]$Url,
  [Parameter(Mandatory = $true)][string]$AnonKey,
  [Parameter(Mandatory = $true)][string]$AllowedEmails,
  [string]$UploadPassword = 'Nasta998#'
)

$ErrorActionPreference = 'Stop'
$root = Split-Path $PSScriptRoot -Parent
Set-Location $root

if ($Url -notmatch '^https://.*\.supabase\.co/?$') {
  throw "Url should look like https://xxxx.supabase.co"
}
if ($AnonKey.Length -lt 40) {
  throw "AnonKey looks too short"
}

# Local .env for npm run dev
@"
VITE_SUPABASE_URL=$Url
VITE_SUPABASE_ANON_KEY=$AnonKey
VITE_UPLOAD_PASSWORD="$UploadPassword"
VITE_ALLOWED_EMAILS="$AllowedEmails"
"@ | Set-Content -Path (Join-Path $root '.env') -Encoding utf8

Write-Host "Wrote .env"

function Set-VercelEnv([string]$name, [string]$value) {
  Write-Host "Setting $name on Vercel (production)..."
  $value | npx --yes vercel@latest env add $name production --force 2>&1 | Out-Host
}

Set-VercelEnv 'VITE_SUPABASE_URL' $Url
Set-VercelEnv 'VITE_SUPABASE_ANON_KEY' $AnonKey
Set-VercelEnv 'VITE_UPLOAD_PASSWORD' $UploadPassword
Set-VercelEnv 'VITE_ALLOWED_EMAILS' $AllowedEmails

Write-Host "Redeploying production..."
npx --yes vercel@latest deploy --prod --yes 2>&1 | Out-Host

Write-Host ""
Write-Host "Done. Open https://nasta-dashboard.vercel.app and log in with email + password."
Write-Host "Remember: run supabase/schema.sql in SQL Editor and create the 3 users first."
