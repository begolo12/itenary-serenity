@echo off
cd /d "F:\project\itenary-serenity"
title Serenity - Itinerary App

if not exist ".next\BUILD_ID" (
    echo [1/2] Membangun production bundle...
    call npx next build
    if %errorlevel% neq 0 (
        echo Build gagal. Perbaiki error lalu coba lagi.
        pause
        exit /b 1
    )
)

echo [1/2] Production build siap.
echo [2/2] Menjalankan server...
npx next start -p 3000
