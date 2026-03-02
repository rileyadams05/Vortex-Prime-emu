while ($true) {
    git add .
    git commit -m "Vortex Prime: Auto-Sync"
    git push
    Start-Sleep -Seconds 5
}
