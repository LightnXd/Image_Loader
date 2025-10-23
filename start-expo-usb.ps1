# Add Android SDK platform-tools to PATH
$env:Path += ";C:\Users\User\AppData\Local\Android\sdk\platform-tools"

# Check if phone is connected
Write-Host "Checking for connected Android devices..." -ForegroundColor Cyan
adb devices

Write-Host "`nIf you see your device listed above, Expo will use USB connection." -ForegroundColor Green
Write-Host "If not, make sure:" -ForegroundColor Yellow
Write-Host "  1. USB debugging is enabled on your phone" -ForegroundColor Yellow
Write-Host "  2. Phone is connected via USB cable" -ForegroundColor Yellow
Write-Host "  3. You allowed USB debugging popup on your phone`n" -ForegroundColor Yellow

# Start Expo
Write-Host "Starting Expo with USB support..." -ForegroundColor Cyan
npx expo start --clear
