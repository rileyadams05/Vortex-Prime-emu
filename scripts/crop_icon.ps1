Add-Type -AssemblyName System.Drawing

$src = "m:\my project\my-emu\frontend\public\assets\AppIcon\icon.png"
if (-not (Test-Path $src)) {
    Write-Host "icon.png not found"
    exit 1
}

$fs = New-Object System.IO.FileStream($src, [System.IO.FileMode]::Open, [System.IO.FileAccess]::Read)
$img = [System.Drawing.Image]::FromStream($fs)
$bmp = New-Object System.Drawing.Bitmap($img)
$fs.Close()

$xMin = $bmp.Width
$xMax = 0
$yMin = $bmp.Height
$yMax = 0

Write-Host "Scanning pixels to crop transparent padding..."

for ($y = 0; $y -lt $bmp.Height; $y++) {
    for ($x = 0; $x -lt $bmp.Width; $x++) {
        $color = $bmp.GetPixel($x, $y)
        if ($color.A -gt 15) { # threshold
            if ($x -lt $xMin) { $xMin = $x }
            if ($x -gt $xMax) { $xMax = $x }
            if ($y -lt $yMin) { $yMin = $y }
            if ($y -gt $yMax) { $yMax = $y }
        }
    }
}

Write-Host "Bounding box: $xMin, $yMin to $xMax, $yMax"

$boxW = $xMax - $xMin + 1
$boxH = $yMax - $yMin + 1
$size = [math]::Max($boxW, $boxH)
$cX = $xMin + ($boxW / 2.0)
$cY = $yMin + ($boxH / 2.0)

$targetX = [math]::Round($cX - ($size / 2.0))
$targetY = [math]::Round($cY - ($size / 2.0))

$squareRect = New-Object System.Drawing.Rectangle($targetX, $targetY, $size, $size)

$bmpCropped = New-Object System.Drawing.Bitmap($size, $size)
$g = [System.Drawing.Graphics]::FromImage($bmpCropped)

# High quality rendering
$g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
$g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality

$destRect = New-Object System.Drawing.Rectangle(0, 0, $size, $size)
$g.DrawImage($bmp, $destRect, $squareRect, [System.Drawing.GraphicsUnit]::Pixel)
$g.Dispose()

$dest = "m:\my project\my-emu\frontend\public\assets\AppIcon\icon_cropped.png"
$bmpCropped.Save($dest, [System.Drawing.Imaging.ImageFormat]::Png)

$bmp.Dispose()
$img.Dispose()
$bmpCropped.Dispose()

Write-Host "Saved cropped image!"
