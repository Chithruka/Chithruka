<#
  KODEX Zero-Dependency Local Web Server & CORS Proxy (Windows PowerShell)
  Serves static files on http://localhost:8080 and exposes /proxy?url=...
  so MangaDex chapter images and Gutendex/Archive.org EPUB/CBZ streams work seamlessly.
#>

param(
  [int]$Port = 8080
)

[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
Add-Type -AssemblyName System.Net.Http

$Root = Split-Path -Parent $MyInvocation.MyCommand.Path
$Prefix = "http://localhost:$Port/"

$Listener = New-Object System.Net.HttpListener
$Listener.Prefixes.Add($Prefix)
$Listener.Start()

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "  KODEX Server & CORS Proxy running at $Prefix" -ForegroundColor Green
Write-Host "  Serving directory: $Root" -ForegroundColor Gray
Write-Host "  Press Ctrl+C to stop." -ForegroundColor Yellow
Write-Host "==========================================================" -ForegroundColor Cyan

$MimeTypes = @{
  '.html' = 'text/html; charset=utf-8'
  '.css'  = 'text/css; charset=utf-8'
  '.js'   = 'application/javascript; charset=utf-8'
  '.json' = 'application/json; charset=utf-8'
  '.svg'  = 'image/svg+xml'
  '.png'  = 'image/png'
  '.jpg'  = 'image/jpeg'
  '.jpeg' = 'image/jpeg'
  '.webp' = 'image/webp'
  '.woff2'= 'font/woff2'
}

$HttpClient = New-Object System.Net.Http.HttpClient
$HttpClient.DefaultRequestHeaders.UserAgent.ParseAdd("KODEX-Local-Reader/1.0")
$HttpClient.Timeout = [TimeSpan]::FromSeconds(35)

try {
  while ($Listener.IsListening) {
    $Context = $Listener.GetContext()
    $Req = $Context.Request
    $Res = $Context.Response

    try {
      $Res.Headers.Add("Access-Control-Allow-Origin", "*")
      $Res.Headers.Add("Access-Control-Allow-Methods", "GET, OPTIONS")
      $Res.Headers.Add("Access-Control-Allow-Headers", "*")

      if ($Req.HttpMethod -eq "OPTIONS") {
        $Res.StatusCode = 204
        $Res.Close()
        continue
      }

      $Path = $Req.Url.AbsolutePath

      if ($Path -eq "/health") {
        $Bytes = [Text.Encoding]::UTF8.GetBytes('{"status":"ok","proxy":true}')
        $Res.ContentType = "application/json"
        $Res.OutputStream.Write($Bytes, 0, $Bytes.Length)
        $Res.Close()
        continue
      }

      if ($Path -eq "/proxy") {
        $TargetUrl = $Req.QueryString["url"]
        if (-not $TargetUrl -or ($TargetUrl -notmatch '^https?://')) {
          $Res.StatusCode = 400
          $Err = [Text.Encoding]::UTF8.GetBytes("Missing or invalid url parameter")
          $Res.OutputStream.Write($Err, 0, $Err.Length)
          $Res.Close()
          continue
        }

        try {
          $RemoteRes = $HttpClient.GetAsync($TargetUrl).GetAwaiter().GetResult()
          $Res.StatusCode = [int]$RemoteRes.StatusCode
          if ($RemoteRes.Content.Headers.ContentType) {
            $Res.ContentType = $RemoteRes.Content.Headers.ContentType.ToString()
          }
          $Payload = $RemoteRes.Content.ReadAsByteArrayAsync().GetAwaiter().GetResult()
          $Res.ContentLength64 = $Payload.Length
          $Res.OutputStream.Write($Payload, 0, $Payload.Length)
        } catch {
          $Res.StatusCode = 502
          $Msg = [Text.Encoding]::UTF8.GetBytes("Proxy fetch failed: $($_.Exception.Message)")
          $Res.OutputStream.Write($Msg, 0, $Msg.Length)
        }
        $Res.Close()
        continue
      }

      # Static File Serving
      $RelPath = if ($Path -eq "/") { "index.html" } else { $Path.TrimStart('/') -replace '/', '\' }
      $FullPath = [IO.Path]::GetFullPath((Join-Path $Root $RelPath))

      if (-not $FullPath.StartsWith($Root, [StringComparison]::OrdinalIgnoreCase) -or -not (Test-Path $FullPath -PathType Leaf)) {
        $Res.StatusCode = 404
        $NotFound = [Text.Encoding]::UTF8.GetBytes("404 Not Found")
        $Res.OutputStream.Write($NotFound, 0, $NotFound.Length)
        $Res.Close()
        continue
      }

      $Ext = [IO.Path]::GetExtension($FullPath).ToLowerInvariant()
      $Res.ContentType = if ($MimeTypes.ContainsKey($Ext)) { $MimeTypes[$Ext] } else { "application/octet-stream" }
      $FileBytes = [IO.File]::ReadAllBytes($FullPath)
      $Res.ContentLength64 = $FileBytes.Length
      $Res.OutputStream.Write($FileBytes, 0, $FileBytes.Length)
      $Res.Close()
    } catch {
      try { $Res.Abort() } catch {}
    }
  }
} finally {
  $Listener.Stop()
  $Listener.Close()
}
