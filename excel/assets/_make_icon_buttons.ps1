# ============================================================
#  Genere une PLANCHE D'OPTIONS d'icones pour 3 boutons du dashboard
#  (Recreer graphiques / Exporter PDF / Actualiser).
#  Glyphes monochromes blancs (Segoe MDL2 Assets) sur fond vert charte.
#  But : l'utilisateur choisit A/B/C par bouton, puis on genere les PNG finaux.
#  Usage : pwsh -File excel/assets/_make_icon_buttons.ps1
# ============================================================
Add-Type -AssemblyName System.Drawing

$GREEN_TOP = [System.Drawing.Color]::FromArgb(33,176,131)
$GREEN_BOT = [System.Drawing.Color]::FromArgb(29,158,117)
$WHITE     = [System.Drawing.Color]::White
$INK       = [System.Drawing.Color]::FromArgb(40,40,40)

# 3 boutons x 3 options. Glyphes Segoe MDL2 Assets (hex).
$rows = @(
  @{ name='Recreer graphiques'; opts=@(
      @{k='A'; cp=0xE72C; desc='Refresh'},
      @{k='B'; cp=0xE9D2; desc='Bar chart'},
      @{k='C'; cp=0xE149; desc='Repeat all'}) },
  @{ name='Exporter en PDF'; opts=@(
      @{k='A'; cp=0xE8A5; desc='Document'},
      @{k='B'; cp=0xE896; desc='Download'},
      @{k='C'; cp=0xEC50; desc='File PDF'}) },
  @{ name='Actualiser'; opts=@(
      @{k='A'; cp=0xE72C; desc='Refresh'},
      @{k='B'; cp=0xE895; desc='Sync'},
      @{k='C'; cp=0xE117; desc='Sync status'}) }
)

$cell = 130; $btn = 84; $padTop = 30; $rowH = $cell + 34; $labelW = 150
$cols = 3
$W = $labelW + $cols*$cell + 20
$H = $padTop + $rows.Count*$rowH + 10

$bmp = New-Object System.Drawing.Bitmap($W, $H)
$g = [System.Drawing.Graphics]::FromImage($bmp)
$g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
$g.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::ClearTypeGridFit
$g.Clear([System.Drawing.Color]::FromArgb(248,249,251))

$fontIcon = New-Object System.Drawing.Font('Segoe MDL2 Assets', 30, [System.Drawing.GraphicsUnit]::Pixel)
$fontHdr  = New-Object System.Drawing.Font('Segoe UI', 15, [System.Drawing.FontStyle]::Bold, [System.Drawing.GraphicsUnit]::Pixel)
$fontLbl  = New-Object System.Drawing.Font('Segoe UI', 13, [System.Drawing.FontStyle]::Bold, [System.Drawing.GraphicsUnit]::Pixel)
$fontDesc = New-Object System.Drawing.Font('Segoe UI', 11, [System.Drawing.GraphicsUnit]::Pixel)
$sf = New-Object System.Drawing.StringFormat
$sf.Alignment = [System.Drawing.StringAlignment]::Center
$sf.LineAlignment = [System.Drawing.StringAlignment]::Center
$brWhite = New-Object System.Drawing.SolidBrush($WHITE)
$brInk   = New-Object System.Drawing.SolidBrush($INK)

# header col labels
for ($c=0; $c -lt $cols; $c++) {
  $x = $labelW + $c*$cell
  $rc = New-Object System.Drawing.RectangleF([single]$x, 4, [single]$cell, 22)
  $g.DrawString(@('Option A','Option B','Option C')[$c], $fontHdr, $brInk, $rc, $sf)
}

$ri = 0
foreach ($row in $rows) {
  $y = $padTop + $ri*$rowH
  # row label
  $rlc = New-Object System.Drawing.RectangleF(6, [single]($y+10), [single]($labelW-12), [single]($btn))
  $g.DrawString($row.name, $fontLbl, $brInk, $rlc, $sf)
  $ci = 0
  foreach ($o in $row.opts) {
    $cx = $labelW + $ci*$cell + ($cell-$btn)/2
    $cy = $y + 6
    $rect = New-Object System.Drawing.Rectangle([int]$cx, [int]$cy, $btn, $btn)
    # rounded green button
    $gp = New-Object System.Drawing.Drawing2D.GraphicsPath
    $r = 18; $d = $r*2
    $gp.AddArc($rect.X, $rect.Y, $d, $d, 180, 90)
    $gp.AddArc($rect.Right-$d, $rect.Y, $d, $d, 270, 90)
    $gp.AddArc($rect.Right-$d, $rect.Bottom-$d, $d, $d, 0, 90)
    $gp.AddArc($rect.X, $rect.Bottom-$d, $d, $d, 90, 90)
    $gp.CloseFigure()
    $brush = New-Object System.Drawing.Drawing2D.LinearGradientBrush($rect, $GREEN_TOP, $GREEN_BOT, [System.Drawing.Drawing2D.LinearGradientMode]::Vertical)
    $g.FillPath($brush, $gp)
    # glyph
    $glyph = [char]([int]$o.cp)
    $grc = New-Object System.Drawing.RectangleF([single]$rect.X, [single]$rect.Y, [single]$btn, [single]$btn)
    $g.DrawString($glyph, $fontIcon, $brWhite, $grc, $sf)
    # caption k + desc
    $kx = $labelW + $ci*$cell
    $krc = New-Object System.Drawing.RectangleF([single]$kx, [single]($cy+$btn+2), [single]$cell, 18)
    $g.DrawString("$($o.k) — $($o.desc)", $fontDesc, $brInk, $krc, $sf)
    $brush.Dispose(); $gp.Dispose()
    $ci++
  }
  $ri++
}

$out = Join-Path (Split-Path -Parent $MyInvocation.MyCommand.Path) '_icon_options.png'
$bmp.Save($out, [System.Drawing.Imaging.ImageFormat]::Png)
$g.Dispose(); $bmp.Dispose()
Write-Host "OK -> $out"
