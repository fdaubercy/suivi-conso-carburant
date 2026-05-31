# ============================================================
#  Genere les boutons PNG cliquables du tableau de bord Excel
#  (onglet "Graphiques"). Charte app : vert #1D9E75 / bleu fonce #1B3A5C.
#  Rendu 2x (retina) puis affiche a 190x30 / 170x30 pt par la macro VBA.
#
#  Usage :  pwsh -File excel/assets/_make_buttons.ps1
# ============================================================
Add-Type -AssemblyName System.Drawing

function New-Button {
    param(
        [string]$Path,
        [string]$Text,
        [System.Drawing.Color]$Fill,
        [System.Drawing.Color]$FillBottom,
        [int]$W = 380,
        [int]$H = 60
    )
    $bmp = New-Object System.Drawing.Bitmap($W, $H)
    $g   = [System.Drawing.Graphics]::FromImage($bmp)
    $g.SmoothingMode     = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $g.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::ClearTypeGridFit
    $g.Clear([System.Drawing.Color]::Transparent)

    $radius = 16
    $pad    = 2
    $rect   = New-Object System.Drawing.Rectangle($pad, $pad, ($W - 2*$pad - 1), ($H - 2*$pad - 1))

    # chemin arrondi
    $gp = New-Object System.Drawing.Drawing2D.GraphicsPath
    $d  = $radius * 2
    $gp.AddArc($rect.X, $rect.Y, $d, $d, 180, 90)
    $gp.AddArc($rect.Right - $d, $rect.Y, $d, $d, 270, 90)
    $gp.AddArc($rect.Right - $d, $rect.Bottom - $d, $d, $d, 0, 90)
    $gp.AddArc($rect.X, $rect.Bottom - $d, $d, $d, 90, 90)
    $gp.CloseFigure()

    # degrade vertical (haut clair -> bas legerement plus fonce)
    $brush = New-Object System.Drawing.Drawing2D.LinearGradientBrush(
        $rect, $Fill, $FillBottom, [System.Drawing.Drawing2D.LinearGradientMode]::Vertical)
    $g.FillPath($brush, $gp)

    # texte blanc centre
    $font = New-Object System.Drawing.Font('Segoe UI', 20, [System.Drawing.FontStyle]::Bold,
        [System.Drawing.GraphicsUnit]::Pixel)
    $sf = New-Object System.Drawing.StringFormat
    $sf.Alignment     = [System.Drawing.StringAlignment]::Center
    $sf.LineAlignment = [System.Drawing.StringAlignment]::Center
    $white = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::White)
    $rectF = New-Object System.Drawing.RectangleF(
        [single]$rect.X, [single]$rect.Y, [single]$rect.Width, [single]$rect.Height)
    $g.DrawString($Text, $font, $white, $rectF, $sf)

    $bmp.Save($Path, [System.Drawing.Imaging.ImageFormat]::Png)

    $g.Dispose(); $bmp.Dispose(); $brush.Dispose(); $white.Dispose(); $font.Dispose(); $gp.Dispose()
    Write-Host "OK -> $Path"
}

$dir = Split-Path -Parent $MyInvocation.MyCommand.Path

# Vert --green #1D9E75
New-Button -Path (Join-Path $dir 'btn_recreer.png') `
    -Text 'Recreer les graphiques' `
    -Fill ([System.Drawing.Color]::FromArgb(33,176,131)) `
    -FillBottom ([System.Drawing.Color]::FromArgb(29,158,117))

# Bleu fonce --blue-dark #1B3A5C
New-Button -Path (Join-Path $dir 'btn_export_pdf.png') `
    -Text 'Exporter en PDF' `
    -Fill ([System.Drawing.Color]::FromArgb(36,74,114)) `
    -FillBottom ([System.Drawing.Color]::FromArgb(27,58,92)) `
    -W 340
