@echo off
setlocal enabledelayedexpansion

if "%~1"=="" goto usage
if "%~1"=="help" goto usage
if "%~1"=="-h" goto usage
if "%~1"=="--help" goto usage

if "%~1"=="status" (
    powershell -NoProfile -Command "Invoke-RestMethod -Uri 'http://127.0.0.1:45454/status' -Method Get"
    goto :eof
)

if "%~1"=="notify" (
    set "TITLE=%~2"
    set "MSG=%~3"
    if "!TITLE!"=="" set "TITLE=KumaNotch"
    powershell -NoProfile -Command "Invoke-RestMethod -Uri 'http://127.0.0.1:45454/notify' -Method Post -ContentType 'application/json' -Body (ConvertTo-Json @{ title = '!TITLE!'; message = '!MSG!'; status = 'success' })" >nul 2>&1
    echo [kuma] Notifikasi terkirim: !TITLE!
    goto :eof
)

if "%~1"=="run" (
    shift
    set "FULL_CMD=%*"
    if "!FULL_CMD!"=="" (
        echo [kuma] Perintah tidak boleh kosong. Contoh: kuma run npm run build
        exit /b 1
    )
    echo [kuma] Menjalankan: !FULL_CMD!
    powershell -NoProfile -Command "Invoke-RestMethod -Uri 'http://127.0.0.1:45454/run' -Method Post -ContentType 'application/json' -Body (ConvertTo-Json @{ command = '!FULL_CMD!'; cwd = (Get-Location).Path })" >nul 2>&1
    goto :eof
)

:usage
echo KumaNotch CLI (kuma)
echo.
echo Penggunaan:
echo   kuma run ^<perintah^>           Jalankan perintah dan pantau di Dynamic Island
echo   kuma notify ^<judul^> [pesan]   Kirim notifikasi instan ke Dynamic Island
echo   kuma status                    Periksa status koneksi KumaNotch
echo.
echo Contoh:
echo   kuma run npm run build
echo   kuma run cargo check
echo   kuma notify "Build Selesai" "Semua test lulus"
echo.
