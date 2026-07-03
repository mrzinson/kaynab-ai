# Setup script to download MySql.Data DLL from NuGet and run the database schema
$ProgressPreference = 'SilentlyContinue'
[System.Net.ServicePointManager]::SecurityProtocol = [System.Net.SecurityProtocolType]::Tls12

$workDir = "C:\Users\Admin\.gemini\antigravity\scratch\kaynab-ai\backend\scratch"
$nupkgPath = Join-Path $workDir "mysql.data.zip"
$extractPath = Join-Path $workDir "mysql_extracted"

# Ensure scratch directory exists
if (-not (Test-Path $workDir)) {
    New-Item -ItemType Directory -Path $workDir -Force | Out-Null
}

try {
    # 1. Download NuGet Package
    Write-Host "[1/6] Downloading MySQL connector DLL from NuGet..."
    $url = "https://www.nuget.org/api/v2/package/MySql.Data/8.0.32"
    $webClient = New-Object System.Net.WebClient
    $webClient.DownloadFile($url, $nupkgPath)
    Write-Host "Success: Download complete."

    # 2. Extract DLL
    Write-Host "[2/6] Extracting files..."
    if (Test-Path $extractPath) { Remove-Item -Recurse -Force $extractPath }
    Expand-Archive -Path $nupkgPath -DestinationPath $extractPath -Force
    Write-Host "Success: Extraction complete."

    # Search for all MySql.Data.dll files in the extracted package
    $dlls = Get-ChildItem $extractPath -Filter "MySql.Data.dll" -Recurse
    Write-Host "Found the following DLL options:"
    foreach ($d in $dlls) {
        Write-Host "  - $($d.FullName)"
    }

    # Select the .NET Framework one (usually net6.0/net7.0 are for PowerShell Core, netstandard is for standard, net461/net48 are for Windows PowerShell)
    # Let's search for net48 or net461, then netstandard, then net6.0
    $dllPath = $null
    
    # Try net48 / net461 / net462 first (compatible with Windows PowerShell v5.1)
    $netFrameworkDll = $dlls | Where-Object { $_.FullName -like "*net4*" } | Select-Object -First 1
    if ($netFrameworkDll) {
        $dllPath = $netFrameworkDll.FullName
        Write-Host "Selecting .NET Framework version: $dllPath"
    } else {
        # Fallback to standard
        $netStandardDll = $dlls | Where-Object { $_.FullName -like "*standard*" } | Select-Object -First 1
        if ($netStandardDll) {
            $dllPath = $netStandardDll.FullName
            Write-Host "Selecting .NET Standard version: $dllPath"
        } else {
            $dllPath = $dlls[0].FullName
            Write-Host "Selecting default version: $dllPath"
        }
    }

    # 3. Load Assembly
    Write-Host "[3/6] Loading assembly into PowerShell..."
    [System.Reflection.Assembly]::LoadFrom($dllPath) | Out-Null
    Write-Host "Success: Assembly loaded successfully!"

    # 4. Connect to Hostinger MySQL
    Write-Host "[4/6] Connecting to Hostinger MySQL (31.97.2.37)..."
    $connStr = "Server=31.97.2.37;Port=3306;Database=u909186836_kaynabAi;Uid=u909186836_kaynabAi;Pwd=H.zinson.11;Connection Timeout=30;Allow User Variables=True;AllowZeroDateTime=True;"
    $conn = New-Object MySql.Data.MySqlClient.MySqlConnection($connStr)
    $conn.Open()
    Write-Host "Success: Connected!"

    # 5. Read and run the SQL schema
    $schemaPath = "C:\Users\Admin\.gemini\antigravity\scratch\kaynab-ai\backend\kaynab_full_schema.sql"
    $sql = Get-Content $schemaPath -Raw -Encoding UTF8

    # Split SQL into individual statements
    # Simple split by semicolon followed by newline
    $statements = $sql -split "(?<=;)\s*\n" | Where-Object { $_.Trim() -match '\S' }

    Write-Host "[5/6] Importing schema ($($statements.Count) statements)..."
    $success = 0
    $skipped = 0
    
    foreach ($stmt in $statements) {
        $clean = $stmt.Trim()
        if ($clean -eq "" -or $clean -eq ";") { continue }
        try {
            $cmd = $conn.CreateCommand()
            $cmd.CommandText = $clean
            $cmd.CommandTimeout = 30
            $cmd.ExecuteNonQuery() | Out-Null
            $success++
        } catch {
            $msg = $_.Exception.Message
            if ($msg -like "*already exists*" -or $msg -like "*Duplicate*") {
                $skipped++
            } else {
                Write-Host "  Warning: Statement Error: $msg"
            }
        }
    }

    Write-Host ""
    Write-Host "Summary:"
    Write-Host "   Success: $success statements"
    Write-Host "   Skipped: $skipped (already exist)"

    # 6. Verify Tables
    $cmd2 = $conn.CreateCommand()
    $cmd2.CommandText = "SHOW TABLES"
    $reader = $cmd2.ExecuteReader()
    $tables = @()
    while ($reader.Read()) { $tables += $reader.GetString(0) }
    $reader.Close()

    Write-Host ""
    Write-Host "[6/6] Tables in database ($($tables.Count) total):"
    foreach ($t in $tables) {
        Write-Host "   * $t"
    }

    $conn.Close()
    Write-Host ""
    Write-Host "Success: Schema setup completed successfully!"

} catch {
    Write-Host "Error: $_"
} finally {
    # Cleanup downloaded files to save space
    if (Test-Path $nupkgPath) { Remove-Item $nupkgPath -Force -ErrorAction SilentlyContinue }
    if (Test-Path $extractPath) { Remove-Item -Recurse -Force $extractPath -ErrorAction SilentlyContinue }
}
