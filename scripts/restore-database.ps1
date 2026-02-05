# Database Restore Script (PowerShell)
# Restores a PostgreSQL dump file to the solar_om_db database

param(
    [Parameter(Mandatory=$true)]
    [string]$DumpFile
)

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

# Check if dump file exists
if (-not (Test-Path $DumpFile)) {
    Write-Host "Error: Dump file not found: $DumpFile" -ForegroundColor Red
    exit 1
}

Write-Host "Restoring database from dump..." -ForegroundColor Cyan
Write-Host "Dump file: $DumpFile"
Write-Host "Database: $dbName"
Write-Host "Host: ${dbHost}:${dbPort}"
Write-Host "User: $dbUser"
Write-Host ""
Write-Host "⚠️  WARNING: This will replace all data in the database!" -ForegroundColor Yellow
Write-Host "   Press Ctrl+C to cancel, or wait 5 seconds to continue..."
Write-Host ""

Start-Sleep -Seconds 5

# Set password environment variable
$env:PGPASSWORD = $dbPassword

# Try to find psql and pg_restore
$psql = "psql"
$pgRestore = "pg_restore"

try {
    $psqlCmd = Get-Command psql -ErrorAction Stop
    $psql = $psqlCmd.Source
} catch {
    $commonPaths = @(
        "C:\Program Files\PostgreSQL\16\bin\psql.exe",
        "C:\Program Files\PostgreSQL\15\bin\psql.exe",
        "C:\Program Files\PostgreSQL\14\bin\psql.exe"
    )
    foreach ($path in $commonPaths) {
        if (Test-Path $path) {
            $psql = $path
            break
        }
    }
}

try {
    $restoreCmd = Get-Command pg_restore -ErrorAction Stop
    $pgRestore = $restoreCmd.Source
} catch {
    $commonPaths = @(
        "C:\Program Files\PostgreSQL\16\bin\pg_restore.exe",
        "C:\Program Files\PostgreSQL\15\bin\pg_restore.exe",
        "C:\Program Files\PostgreSQL\14\bin\pg_restore.exe"
    )
    foreach ($path in $commonPaths) {
        if (Test-Path $path) {
            $pgRestore = $path
            break
        }
    }
}

try {
    Write-Host "Dropping existing database (if exists)..." -ForegroundColor Yellow
    & $psql -h $dbHost -p $dbPort -U $dbUser -d postgres -c "DROP DATABASE IF EXISTS `"$dbName`";" 2>&1 | Out-Null
    
    Write-Host "Creating database $dbName..." -ForegroundColor Yellow
    & $psql -h $dbHost -p $dbPort -U $dbUser -d postgres -c "CREATE DATABASE `"$dbName`";"
    
    Write-Host "Restoring data from dump file..." -ForegroundColor Yellow
    & $pgRestore -h $dbHost -p $dbPort -U $dbUser -d $dbName -c $DumpFile
    
    Write-Host ""
    Write-Host "[SUCCESS] Database restored successfully!" -ForegroundColor Green
    Write-Host "  Database: $dbName"
    Write-Host ""
    Write-Host "You can now start the application with: npm run dev"
    
} catch {
    Write-Host ""
    Write-Host "[ERROR] Error restoring database:" -ForegroundColor Red
    Write-Host $_.Exception.Message
    Write-Host ""
    Write-Host "Make sure:"
    Write-Host "  1. PostgreSQL is running"
    Write-Host "  2. psql and pg_restore are accessible"
    Write-Host "  3. DB credentials in server/.env are correct"
    Write-Host "  4. The dump file is valid and not corrupted"
    exit 1
}
