# ============================================================
#  Genere les 3 boutons-ICONE carres du bandeau dashboard.
#  Glyphe blanc (Segoe MDL2 Assets) sur carre arrondi vert charte (#1D9E75).
#  Rendu 2x (56px) -> affiche ~28pt par la macro VBA (AddPicture).
#  Choix utilisateur 2026-06-09 :
#    Recreer   = B (graphique)  E9D2
#    Exporter  = C (fichier PDF) EC50
#    Actualiser= B (sync)        E895
#  Usage : pwsh -File excel/assets/_make_final_icons.ps1
# ============================================================
Add-Type -AssemblyName System.Drawing

function New-IconButton {
    param([string]$Path, [int]$Cp, [int]$S = 56)
    $bmp = New-Object System.Drawing.Bitmap($S, $S)
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $g.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::ClearTypeGridFit
    $g.Clear([System.Drawing.Color]::Transparent)

    $pad = 1; $r = 12; $d = $r * 2
    $rect = New-Object System.Drawing.Rectangle($pad, $pad, ($S - 2*$pad - 1), ($S - 2*$pad - 1))
    $gp = New-Object System.Drawing.Drawing2D.GraphicsPath
    $gp.AddArc($rect.X, $rect.Y, $d, $d, 180, 90)
    $gp.AddArc($rect.Right - $d, $rect.Y, $d, $d, 270, 90)
    $gp.AddArc($rect.Right - $d, $rect.Bottom - $d, $d, $d, 0, 90)
    $gp.AddArc($rect.X, $rect.Bottom - $d, $d, $d, 90, 90)
    $gp.CloseFigure()
    $brush = New-Object System.Drawing.Drawing2D.LinearGradientBrush($rect,
        [System.Drawing.Color]::FromArgb(33,176,131),
        [System.Drawing.Color]::FromArgb(29,158,117),
        [System.Drawing.Drawing2D.LinearGradientMode]::Vertical)
    $g.FillPath($brush, $gp)

    $font = New-Object System.Drawing.Font('Segoe MDL2 Assets', 30, [System.Drawing.GraphicsUnit]::Pixel)
    $sf = New-Object System.Drawing.StringFormat
    $sf.Alignment = [System.Drawing.StringAlignment]::Center
    $sf.LineAlignment = [System.Drawing.StringAlignment]::Center
    $white = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::White)
    $glyph = [char]$Cp
    $rf = New-Object System.Drawing.RectangleF(0, 0, [single]$S, [single]$S)
    $g.DrawString($glyph, $font, $white, $rf, $sf)

    $bmp.Save($Path, [System.Drawing.Imaging.ImageFormat]::Png)
    $g.Dispose(); $bmp.Dispose(); $brush.Dispose(); $white.Dispose(); $font.Dispose(); $gp.Dispose()
    Write-Host "OK -> $Path"
}

$dir = Split-Path -Parent $MyInvocation.MyCommand.Path
New-IconButton -Path (Join-Path $dir 'btn_recreer.png')    -Cp 0xE9D2   # graphique
New-IconButton -Path (Join-Path $dir 'btn_export_pdf.png') -Cp 0xEC50   # fichier PDF
New-IconButton -Path (Join-Path $dir 'btn_actualiser.png') -Cp 0xE895   # sync
