# PowerShell script to replace hardcoded backend URL with dynamic environment variable in frontend files
$frontendDir = "C:\Users\Admin\.gemini\antigravity\scratch\kaynab-ai\frontend\app"
$files = Get-ChildItem -Path $frontendDir -Filter "*.tsx" -Recurse

Write-Host "Updating frontend files to use NEXT_PUBLIC_API_URL..."

# Single quoted strings to prevent PowerShell parsing of || operator
$oldStr1 = '''https://darkpen-backend.onrender.com'
$newStr1 = '(process.env.NEXT_PUBLIC_API_URL || ''https://kaynab-ai-backend.onrender.com'') + '''

$oldStr2 = '"https://darkpen-backend.onrender.com'
$newStr2 = '(process.env.NEXT_PUBLIC_API_URL || "https://kaynab-ai-backend.onrender.com") + "'

foreach ($file in $files) {
    $content = [System.IO.File]::ReadAllText($file.FullName)
    
    $newContent = $content.Replace($oldStr1, $newStr1).Replace($oldStr2, $newStr2)

    if ($newContent -ne $content) {
        [System.IO.File]::WriteAllText($file.FullName, $newContent)
        Write-Host "   ✔ Updated: $($file.Name)"
    }
}

# Also update the root page.tsx
$rootPage = "C:\Users\Admin\.gemini\antigravity\scratch\kaynab-ai\frontend\app\page.tsx"
if (Test-Path $rootPage) {
    $content = [System.IO.File]::ReadAllText($rootPage)
    $newContent = $content.Replace($oldStr1, $newStr1).Replace($oldStr2, $newStr2)
    if ($newContent -ne $content) {
        [System.IO.File]::WriteAllText($rootPage, $newContent)
        Write-Host "   ✔ Updated root: page.tsx"
    }
}

Write-Host "Done!"
