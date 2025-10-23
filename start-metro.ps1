# Ensure adb is in PATH
$env:Path += ";C:\Users\User\AppData\Local\Android\sdk\platform-tools"

Write-Host "Starting Metro Bundler..." -ForegroundColor Cyan
Write-Host "Keep this window open while developing!" -ForegroundColor Yellow
Write-Host ""

# Start Metro and keep it running
npx expo start
