# Database Dump Script (PowerShell)
# Creates a PostgreSQL dump file of the solar_om_db database

# Read .env file
$envFile = Join-Path $PSScriptRoot "..\server\.env"
$dbPassword = "0000"
$dbHost = "localhost"
$dbPort = "5432"
$dbName = "solar_om_db"
$dbUser = "postgres"

if (Test-Path $envFile) {
    Get-Content $envFile | ForEach-Object {
        if ($_ -match "^DB_PASSWORD=(.+)$") {
            $dbPassword = $matches[1].Trim()
        }
        if ($_ -match "^DB_HOST=(.+)$") {
            $dbHost = $matches[1].Trim()
        }
        if ($_ -match "^DB_PORT=(.+)$") {
            $dbPort = $matches[1].Trim()
        }
        if ($_ -match "^DB_NAME=(.+)$") {
            $dbName = $matches[1].Trim()
        }
        if ($_ -match "^DB_USER=(.+)$") {
            $dbUser = $matches[1].Trim()
        }
    }
}

# Create dump directory
$dumpDir = Join-Path $PSScriptRoot "database-dump"
if (-not (Test-Path $dumpDir)) {
    New-Item -ItemType Directory -Path $dumpDir | Out-Null
}

# Generate filename with timestamp
$timestamp = Get-Date -Format "yyyy-MM-dd_HH-mm-ss"
$dumpFile = Join-Path $dumpDir "${dbName}_${timestamp}.backup"

Write-Host "Creating database dump..." -ForegroundColor Cyan
Write-Host "Database: $dbName"
Write-Host "Host: ${dbHost}:${dbPort}"
Write-Host "User: $dbUser"
Write-Host "Output: $dumpFile"
Write-Host ""

# Set password environment variable
$env:PGPASSWORD = $dbPassword

# Try to find pg_dump
$pgDump = "pg_dump"
try {
    $whereResult = Get-Command pg_dump -ErrorAction Stop
    $pgDump = $whereResult.Source
} catch {
    # Try common PostgreSQL paths
    $commonPaths = @(
        "C:\Program Files\PostgreSQL\16\bin\pg_dump.exe",
        "C:\Program Files\PostgreSQL\15\bin\pg_dump.exe",
        "C:\Program Files\PostgreSQL\14\bin\pg_dump.exe",
        "C:\Program Files\PostgreSQL\13\bin\pg_dump.exe",
        "C:\Program Files\PostgreSQL\12\bin\pg_dump.exe"
    )
    
    foreach ($path in $commonPaths) {
        if (Test-Path $path) {
            $pgDump = $path
            break
        }
    }
}

try {
    # Run pg_dump
    & $pgDump -h $dbHost -p $dbPort -U $dbUser -d $dbName -F c -f $dumpFile
    
    $fileSize = (Get-Item $dumpFile).Length / 1MB
    Write-Host ""
    Write-Host "[SUCCESS] Database dump created successfully!" -ForegroundColor Green
    Write-Host "  File: $dumpFile"
    Write-Host "  Size: $([math]::Round($fileSize, 2)) MB"
    Write-Host ""
    Write-Host "Next steps:"
    Write-Host "  1. Copy this file to the other PC"
    Write-Host "  2. On the other PC, run: .\scripts\restore-database.ps1 -DumpFile `"path\to\dump.backup`""
    
} catch {
    Write-Host ""
    Write-Host "[ERROR] Error creating database dump:" -ForegroundColor Red
    Write-Host $_.Exception.Message
    Write-Host ""
    Write-Host "Make sure:"
    Write-Host "  1. PostgreSQL is running"
    Write-Host "  2. pg_dump is accessible (check PATH or use full path)"
    Write-Host "  3. DB credentials in server/.env are correct"
    Write-Host "  4. The database exists and is accessible"
    exit 1
}
