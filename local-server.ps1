param(
  [int]$Port = 8080
)

$ErrorActionPreference = "Stop"
$RootDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$EnvPath = Join-Path $RootDir ".env"

function Load-DotEnv {
  param([string]$Path)
  $vars = @{}
  if (Test-Path $Path) {
    Get-Content $Path | ForEach-Object {
      $line = $_.Trim()
      if ($line -and -not $line.StartsWith("#") -and $line.Contains("=")) {
        $idx = $line.IndexOf("=")
        $key = $line.Substring(0, $idx).Trim()
        $val = $line.Substring($idx + 1).Trim().Trim('"').Trim("'")
        $vars[$key] = $val
      }
    }
  }
  return $vars
}

$envVars = Load-DotEnv -Path $EnvPath
$ApiKey = $envVars["GEMINI_API_KEY"]
$DefaultModel = if ($envVars["GEMINI_MODEL"]) { $envVars["GEMINI_MODEL"] } else { "gemini-4-hydrogen" }

if (-not $ApiKey -or $ApiKey -eq "your_gemini_api_key_here") {
  Write-Warning "GEMINI_API_KEY is not set in .env. Copy .env.example to .env and add your key."
}

$MimeTypes = @{
  ".html" = "text/html; charset=utf-8"
  ".css"  = "text/css; charset=utf-8"
  ".js"   = "application/javascript; charset=utf-8"
  ".json" = "application/json; charset=utf-8"
  ".svg"  = "image/svg+xml"
  ".png"  = "image/png"
  ".ico"  = "image/x-icon"
}

$Listener = New-Object System.Net.HttpListener
$Prefix = "http://localhost:$Port/"
$Listener.Prefixes.Add($Prefix)
$Listener.Start()

Write-Host "GlobalMark AI local server running at $Prefix" -ForegroundColor Green
Write-Host "Press Ctrl+C to stop." -ForegroundColor DarkGray

try {
  while ($Listener.IsListening) {
    $Context = $Listener.GetContext()
    $Request = $Context.Request
    $Response = $Context.Response

    try {
      $Path = $Request.Url.AbsolutePath

      if ($Request.HttpMethod -eq "POST" -and $Path -eq "/api/chat") {
        if (-not $ApiKey -or $ApiKey -eq "your_gemini_api_key_here") {
          $errBytes = [System.Text.Encoding]::UTF8.GetBytes('{"error":{"message":"GEMINI_API_KEY missing in .env file."}}')
          $Response.StatusCode = 500
          $Response.ContentType = "application/json; charset=utf-8"
          $Response.OutputStream.Write($errBytes, 0, $errBytes.Length)
          $Response.Close()
          continue
        }

        $reader = New-Object System.IO.StreamReader($Request.InputStream, [System.Text.Encoding]::UTF8)
        $rawBody = $reader.ReadToEnd()
        $reader.Close()

        $bodyObj = $rawBody | ConvertFrom-Json
        $model = if ($bodyObj.model) { [string]$bodyObj.model } else { $DefaultModel }

        # Build clean Gemini request body without the extra "model" property
        $geminiPayload = @{
          systemInstruction = $bodyObj.systemInstruction
          contents          = $bodyObj.contents
          generationConfig  = $bodyObj.generationConfig
        } | ConvertTo-Json -Depth 20 -Compress

        $geminiUrl = "https://generativelanguage.googleapis.com/v1beta/models/$([Uri]::EscapeDataString($model)):generateContent"
        $headers = @{
          "Content-Type"   = "application/json"
          "x-goog-api-key" = $ApiKey
        }

        try {
          $apiResp = Invoke-WebRequest -Uri $geminiUrl -Method Post -Headers $headers -Body ([System.Text.Encoding]::UTF8.GetBytes($geminiPayload)) -UseBasicParsing
          $outBytes = [System.Text.Encoding]::UTF8.GetBytes($apiResp.Content)
          $Response.StatusCode = [int]$apiResp.StatusCode
          $Response.ContentType = "application/json; charset=utf-8"
          $Response.OutputStream.Write($outBytes, 0, $outBytes.Length)
        } catch [System.Net.WebException] {
          $errResp = $_.Exception.Response
          $statusCode = 502
          $errText = '{"error":{"message":"Failed to reach Gemini API."}}'
          if ($errResp) {
            $statusCode = [int]$errResp.StatusCode
            $errStream = $errResp.GetResponseStream()
            $errReader = New-Object System.IO.StreamReader($errStream, [System.Text.Encoding]::UTF8)
            $errText = $errReader.ReadToEnd()
            $errReader.Close()
          }
          $outBytes = [System.Text.Encoding]::UTF8.GetBytes($errText)
          $Response.StatusCode = $statusCode
          $Response.ContentType = "application/json; charset=utf-8"
          $Response.OutputStream.Write($outBytes, 0, $outBytes.Length)
        }

        $Response.Close()
        continue
      }

      # Static file serving
      if ($Path -eq "/") { $Path = "/index.html" }
      $relPath = $Path.TrimStart("/").Replace("/", [System.IO.Path]::DirectorySeparatorChar)
      $fullPath = [System.IO.Path]::GetFullPath((Join-Path $RootDir $relPath))

      # Prevent directory traversal and never serve .env files
      if (-not $fullPath.StartsWith($RootDir) -or (Split-Path -Leaf $fullPath).StartsWith(".env")) {
        $Response.StatusCode = 403
        $Response.Close()
        continue
      }

      if (Test-Path $fullPath -PathType Leaf) {
        $ext = [System.IO.Path]::GetExtension($fullPath).ToLowerInvariant()
        $Response.ContentType = if ($MimeTypes.ContainsKey($ext)) { $MimeTypes[$ext] } else { "application/octet-stream" }
        $bytes = [System.IO.File]::ReadAllBytes($fullPath)
        $Response.StatusCode = 200
        $Response.OutputStream.Write($bytes, 0, $bytes.Length)
      } else {
        $Response.StatusCode = 404
      }
      $Response.Close()
    } catch {
      try {
        $Response.StatusCode = 500
        $Response.Close()
      } catch {}
    }
  }
} finally {
  $Listener.Stop()
}
