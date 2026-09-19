param(
  [int]$Port = 8080
)

$ErrorActionPreference = "Stop"
$Root = [System.IO.Path]::GetFullPath((Split-Path -Parent $MyInvocation.MyCommand.Path))
$RootPrefix = $Root.TrimEnd('\') + '\'

function Get-ContentType([string]$Path) {
  switch ([System.IO.Path]::GetExtension($Path).ToLowerInvariant()) {
    ".html" { return "text/html; charset=utf-8" }
    ".htm"  { return "text/html; charset=utf-8" }
    ".js"   { return "application/javascript; charset=utf-8" }
    ".css"  { return "text/css; charset=utf-8" }
    ".json" { return "application/json; charset=utf-8" }
    ".txt"  { return "text/plain; charset=utf-8" }
    ".csv"  { return "text/csv; charset=utf-8" }
    ".svg"  { return "image/svg+xml" }
    ".png"  { return "image/png" }
    ".jpg"  { return "image/jpeg" }
    ".jpeg" { return "image/jpeg" }
    ".gif"  { return "image/gif" }
    ".webp" { return "image/webp" }
    ".ico"  { return "image/x-icon" }
    ".pdf"  { return "application/pdf" }
    ".woff" { return "font/woff" }
    ".woff2"{ return "font/woff2" }
    default { return "application/octet-stream" }
  }
}

function Send-Response($Stream, [int]$Status, [string]$Reason, [byte[]]$Body, [string]$ContentType, [bool]$HeadOnly = $false) {
  $header = "HTTP/1.1 $Status $Reason`r`n" +
            "Content-Type: $ContentType`r`n" +
            "Content-Length: $($Body.Length)`r`n" +
            "Cache-Control: no-cache`r`n" +
            "Connection: close`r`n`r`n"
  $headerBytes = [System.Text.Encoding]::ASCII.GetBytes($header)
  $Stream.Write($headerBytes, 0, $headerBytes.Length)
  if (-not $HeadOnly -and $Body.Length -gt 0) {
    $Stream.Write($Body, 0, $Body.Length)
  }
  $Stream.Flush()
}

function Send-Text($Stream, [int]$Status, [string]$Reason, [string]$Text, [bool]$HeadOnly = $false) {
  $bytes = [System.Text.Encoding]::UTF8.GetBytes($Text)
  Send-Response $Stream $Status $Reason $bytes "text/plain; charset=utf-8" $HeadOnly
}

$listener = $null
$actualPort = $Port

try {
  $listener = New-Object System.Net.Sockets.TcpListener -ArgumentList ([System.Net.IPAddress]::Loopback), $Port
  $listener.Start()
}
catch {
  Write-Host ""
  Write-Host "Could not start the local web server on port $Port." -ForegroundColor Red
  Write-Host "Google Sign-In is configured for http://localhost:$Port" -ForegroundColor Yellow
  Write-Host "Close any program using port $Port and try again."
  Read-Host "Press Enter to close"
  exit 1
}

$url = "http://localhost:$actualPort/login.html"
Write-Host ""
Write-Host "Classroom Administration System V5" -ForegroundColor Cyan
Write-Host "Local server: $url" -ForegroundColor Green
Write-Host "Keep this window OPEN while using the system." -ForegroundColor Yellow
Write-Host "Press Ctrl+C to stop the server."
Write-Host ""

try {
  Start-Process $url
}
catch {
  Write-Host "Open this address in your browser: $url"
}

try {
  while ($true) {
    $client = $listener.AcceptTcpClient()
    try {
      $stream = $client.GetStream()
      $reader = New-Object System.IO.StreamReader -ArgumentList $stream

      $requestLine = $reader.ReadLine()
      if ([string]::IsNullOrWhiteSpace($requestLine)) {
        continue
      }

      while ($true) {
        $line = $reader.ReadLine()
        if ($null -eq $line -or $line -eq "") { break }
      }

      $parts = $requestLine.Split(" ")
      if ($parts.Length -lt 2) {
        Send-Text $stream 400 "Bad Request" "Bad request"
        continue
      }

      $method = $parts[0].ToUpperInvariant()
      $headOnly = ($method -eq "HEAD")
      if ($method -ne "GET" -and -not $headOnly) {
        Send-Text $stream 405 "Method Not Allowed" "Method not allowed" $headOnly
        continue
      }

      $target = $parts[1]
      $pathOnly = ($target -split '\?', 2)[0]
      try {
        $urlPath = [System.Uri]::UnescapeDataString($pathOnly)
      }
      catch {
        Send-Text $stream 400 "Bad Request" "Invalid URL" $headOnly
        continue
      }

      if ($urlPath -eq "/" -or [string]::IsNullOrWhiteSpace($urlPath)) {
        $urlPath = "/login.html"
      }

      $relative = $urlPath.TrimStart('/').Replace('/', [System.IO.Path]::DirectorySeparatorChar)

      try {
        $fullPath = [System.IO.Path]::GetFullPath((Join-Path $Root $relative))
      }
      catch {
        Send-Text $stream 400 "Bad Request" "Invalid path" $headOnly
        continue
      }

      if (-not $fullPath.StartsWith($RootPrefix, [System.StringComparison]::OrdinalIgnoreCase)) {
        Send-Text $stream 403 "Forbidden" "Forbidden" $headOnly
        continue
      }

      if (Test-Path $fullPath -PathType Container) {
        $fullPath = Join-Path $fullPath "index.html"
      }

      if (-not (Test-Path $fullPath -PathType Leaf)) {
        Send-Text $stream 404 "Not Found" "File not found" $headOnly
        continue
      }

      try {
        $bytes = [System.IO.File]::ReadAllBytes($fullPath)
        $contentType = Get-ContentType $fullPath
        Send-Response $stream 200 "OK" $bytes $contentType $headOnly
      }
      catch {
        Send-Text $stream 500 "Internal Server Error" "Could not read file" $headOnly
      }
    }
    catch {
      # Ignore a broken browser connection and keep serving.
    }
    finally {
      try { if ($reader) { $reader.Dispose() } } catch {}
      try { if ($stream) { $stream.Dispose() } } catch {}
      try { $client.Close() } catch {}
    }
  }
}
finally {
  try { $listener.Stop() } catch {}
}
