param(
  [Parameter(Mandatory = $true)]
  [ValidateSet("x86", "x64", "arm64")]
  [string]$Arch
)

# Per-user Node LTS fallback for ForgeDeck. It needs no administrator rights.
$ErrorActionPreference = "Stop"
$ProgressPreference = "SilentlyContinue"

$release = (
  Invoke-RestMethod "https://nodejs.org/dist/index.json" |
    Where-Object { $_.lts } |
    Select-Object -First 1
).version
if (-not $release) {
  throw "Could not determine the current Node.js LTS release."
}

$file = "node-$release-win-$Arch.zip"
$baseUrl = "https://nodejs.org/dist/$release"
$archive = Join-Path $env:TEMP "ForgeDeck-$file"
$root = Join-Path $env:LOCALAPPDATA "ForgeDeck\node"
$staging = Join-Path $root "staging"
$current = Join-Path $root "current"

New-Item -ItemType Directory -Force -Path $root | Out-Null
try {
  Write-Host "[Node] Downloading $file from nodejs.org..."
  Invoke-WebRequest -UseBasicParsing "$baseUrl/$file" -OutFile $archive

  $checksums = (Invoke-WebRequest -UseBasicParsing "$baseUrl/SHASUMS256.txt").Content
  $pattern = "(?m)^([A-Fa-f0-9]{64})\s+" + [regex]::Escape($file) + "$"
  $match = [regex]::Match($checksums, $pattern)
  if (-not $match.Success) {
    throw "No SHA-256 checksum was published for $file."
  }
  $actual = (Get-FileHash -Algorithm SHA256 -Path $archive).Hash
  if ($actual -ne $match.Groups[1].Value.ToUpperInvariant()) {
    throw "Downloaded Node archive checksum does not match nodejs.org."
  }

  Remove-Item -Recurse -Force -ErrorAction SilentlyContinue $staging
  New-Item -ItemType Directory -Force -Path $staging | Out-Null
  Expand-Archive -Force -Path $archive -DestinationPath $staging
  $expanded = Join-Path $staging "node-$release-win-$Arch"
  if (-not (Test-Path (Join-Path $expanded "node.exe"))) {
    throw "The verified Node archive did not contain node.exe."
  }

  Remove-Item -Recurse -Force -ErrorAction SilentlyContinue $current
  Move-Item -Force $expanded $current
  Write-Host "[Node] Installed Node $release for this Windows user: $current"
}
finally {
  Remove-Item -Force -ErrorAction SilentlyContinue $archive
  Remove-Item -Recurse -Force -ErrorAction SilentlyContinue $staging
}
