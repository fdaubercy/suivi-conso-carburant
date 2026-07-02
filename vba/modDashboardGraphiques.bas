Attribute VB_Name = "modDashboardGraphiques"
'---------------------------------------------------------------------------
'  modDashboardGraphiques  —  Suivi Conso Carburants
'  Met en page la feuille « Graphiques » en tableau de bord et applique la
'  CHARTE GRAPHIQUE DE L'APP (bleu nuit / vert E85 / bleu SP98 / ambre).
'
'  ? Ce module est NON DESTRUCTIF : il ne modifie AUCUNE cellule ni formule.
'    Il ne fait que (1) recolorer + restyler les 11 graphiques existants,
'    (2) les ranger en grille, (3) poser un bandeau d'en-tête + des cartes KPI
'    sous forme de FORMES flottantes (préfixe "dash_") qu'il recrée à chaque appel.
'  ? Rejouable : relance-le quand tu veux, il efface ses propres formes d'abord.
'
'  UTILISATION :
'    1. Alt+F11 ? Insertion ? Module ? colle ce code (ou importe le .bas).
'    2. Reviens sur Excel, Alt+F8 ? exécute « MAJ_Dashboard_Graphiques ».
'    3. (Option) Appelle MAJ_Dashboard_Graphiques en fin de ta routine de refresh.
'
'  Les paramètres Budget (B2) et Objectif CO2 (B3) restent dans leurs cellules
'  d'origine sur la feuille Graphiques : édite-les, puis relance la macro.
'---------------------------------------------------------------------------
Option Explicit

'---- Onglet du tableau de bord (X36 : ex-"Graphiques", renommé "Tableau de bord") --
Private Const WS_DASH As String = "Tableau de bord"

'---- Sélecteurs X32 (cellules libres : modGraphiques n'utilise que B2/B3/B4) --
Private Const CELL_SEL_VEH  As String = "B5"   ' Véhicule sélectionné
Private Const CELL_SEL_FUEL As String = "B6"   ' Carburant sélectionné
Private Const SEG_BAND As Single = 76          ' X39 : hauteur bande segments par defaut (repli si modFiltres absent)
Private Const COL_LIST_VEH  As Long = 52       ' colonne technique AZ (liste véhicules)
Private Const COL_LIST_FUEL As Long = 53       ' colonne technique BA (liste carburants)

'---- Palette (miroir de css/style.css de l'app) ---------------------------
Private Function cBlueDark() As Long:  cBlueDark = RGB(27, 58, 92):    End Function
Private Function cBlueMid() As Long:   cBlueMid = RGB(46, 117, 182):   End Function
Private Function cBlueLight() As Long: cBlueLight = RGB(230, 241, 251): End Function
Private Function cGreen() As Long:     cGreen = RGB(29, 158, 117):     End Function
Private Function cAmber() As Long:     cAmber = RGB(240, 165, 0):      End Function
Private Function cRed() As Long:       cRed = RGB(226, 75, 74):        End Function
Private Function cText() As Long:      cText = RGB(26, 26, 26):        End Function
Private Function cMuted() As Long:     cMuted = RGB(107, 114, 128):    End Function
Private Function cBorder() As Long:    cBorder = RGB(214, 222, 232):   End Function
Private Function cGrid() As Long:      cGrid = RGB(228, 234, 242):     End Function
Private Function cWhite() As Long:     cWhite = RGB(255, 255, 255):    End Function

'---- Geometrie de la planche (en points) ----
Private Function L0() As Single:      L0 = 10:           End Function   ' marge gauche
Private Function WTOT() As Single
    ' Lit le nb de colonnes de l'onglet WS_DASH dans Reglages et calcule la largeur utile.
    ' Repli sur 1160 si la table Zoom n'est pas configuree.
    On Error Resume Next
    Dim ws As Worksheet: Set ws = ThisWorkbook.Worksheets(WS_DASH)
    If ws Is Nothing Then WTOT = 1160: Exit Function
    Dim nCols As Long: nCols = Affichage.ZoomColsForSheet(WS_DASH)
    If nCols = 0 Then WTOT = 1160: Exit Function
    Dim w As Double: w = 0
    Dim c As Long
    For c = 1 To nCols
        w = w + ws.Columns(c).Width
    Next c
    WTOT = CSng(w) - L0
    On Error GoTo 0
End Function
Private Function gap() As Single:     gap = 12:          End Function
Private Function FONT_UI() As String: FONT_UI = "Segoe UI": End Function

' Retourne le bas de la barre de navigation horizontale (sb_bg) en points
' document. Sert à poser le bandeau titre juste en dessous.
Public Function NavbarBottom(ws As Worksheet) As Single
    Dim sh As Shape
    On Error Resume Next
    For Each sh In ws.Shapes
        If sh.name = "sb_bg" Then
            NavbarBottom = sh.top + sh.Height
            Exit Function
        End If
    Next sh
    On Error GoTo 0
    NavbarBottom = 2    ' repli : pas de navbar trouvée
End Function

'---------------------------------------------------------------------------
'  POINT D'ENTRÉE
'---------------------------------------------------------------------------
Public Sub MAJ_Dashboard_Graphiques()
    Dim ws As Worksheet
    On Error Resume Next
    Set ws = ThisWorkbook.Worksheets(WS_DASH)
    On Error GoTo 0
    If ws Is Nothing Then
        Application.StatusBar = "Feuille « " & WS_DASH & " » introuvable."
        Exit Sub
    End If

    Application.ScreenUpdating = False

    CleanupDashShapes ws
    PrepareSheet ws
    StyleAllCharts ws

    Dim topCharts As Single
    topCharts = BuildHeaderAndKPIs(ws)   ' renvoie le Top où commencer la grille
    LayoutCharts ws, topCharts

    ' X39 : segments (filtres) dans la bande reservee sous la banniere, au 1er plan
    On Error Resume Next
    modFiltres.EnsureFilterUI ws, ws.Range("A7").top + 4, L0, WTOT
    On Error GoTo 0

    ' X39 P6 : panneau carburant (modFuelPanel / fup_btn) RETIRE — remplace par le
    '  segment Carburant (slcCarburant). On ne reinstalle plus le bouton.

    ' Remettre au premier plan les boutons de modGraphiques (couverts par le bandeau)
    Dim sBtns As Shape
    For Each sBtns In ws.Shapes
        If sBtns.name = "btnRecreerGraph" Or sBtns.name = "btnExportGraph" Then
            sBtns.ZOrder msoBringToFront
        End If
    Next sBtns

    If Not gSilentOpen Then
        Application.ScreenUpdating = True
        ws.Activate
        ws.Range("A1").Select
    End If
    Application.StatusBar = "Dashboard « Graphiques » mis à jour."
End Sub

'---- X39 : reconstruction COMPLETE (data + mise en page) = rendu identique a l'ouverture ----
Public Sub RecreerDashboardComplet()
    On Error Resume Next
    Application.Run "CreerGraphiquesWeb", False   ' rebuild data + graphiques (modGraphiques)
    MAJ_Dashboard_Graphiques                      ' restyle + layout + KPI + panneaux + boutons
    On Error GoTo 0
End Sub

'---------------------------------------------------------------------------
'  1. Nettoyage des formes générées (idempotence)
'---------------------------------------------------------------------------
Private Sub CleanupDashShapes(ws As Worksheet)
    Dim sh As Shape, i As Long
    For i = ws.Shapes.count To 1 Step -1
        Set sh = ws.Shapes(i)
        ' "dash_*" = formes de CE module ; "kpi*" = ancien bloc "Bilan annuel"
        ' (BuildKPICards de modGraphiques, retiré X36) à purger s'il subsiste.
        If Left$(sh.name, 5) = "dash_" Or Left$(sh.name, 3) = "kpi" _
           Or Left$(sh.name, 4) = "fup_" Then sh.Delete   ' X39 P6 : purge ancien panneau carburant
    Next i
End Sub

'---------------------------------------------------------------------------
'  2. Préparation de la feuille (canvas propre)
'---------------------------------------------------------------------------
Private Sub PrepareSheet(ws As Worksheet)
    ws.Tab.color = cBlueDark
    ws.Activate
    On Error Resume Next
    ActiveWindow.DisplayGridlines = False
    ActiveWindow.DisplayHeadings = False
    ActiveWindow.Zoom = 80
    On Error GoTo 0
End Sub

'---------------------------------------------------------------------------
'  3. Restyle + recoloration de TOUS les graphiques à la charte de l'app
'---------------------------------------------------------------------------
Private Sub StyleAllCharts(ws As Worksheet)
    Dim co As ChartObject
    For Each co In ws.ChartObjects
        On Error Resume Next
        co.RoundedCorners = True      ' coins arrondis : propriété du ChartObject
        On Error GoTo 0
        StyleOneChart co.Chart
    Next co
End Sub

Private Sub StyleOneChart(ch As Chart)
    On Error Resume Next
    ' — Cadre & fond —
    ch.ChartArea.Format.fill.ForeColor.RGB = cWhite
    ch.ChartArea.Format.Line.visible = msoFalse
    ch.ChartArea.Border.LineStyle = xlNone
    ch.PlotArea.Format.fill.visible = msoFalse
    ch.PlotArea.Format.Line.visible = msoFalse

    ' — Police générale —
    ch.ChartArea.Font.name = FONT_UI
    ch.ChartArea.Font.Size = 9
    ch.ChartArea.Font.color = cMuted

    ' — Titre —
    If ch.HasTitle Then
        ch.ChartTitle.Font.name = FONT_UI
        ch.ChartTitle.Font.Size = 11
        ch.ChartTitle.Font.bold = True
        ch.ChartTitle.Font.color = cBlueDark
    End If

    ' — Axes & quadrillage —
    Dim va As Axis, ca As Axis
    Set va = ch.Axes(xlValue)
    If Not va Is Nothing Then
        If va.HasMajorGridlines Then
            va.MajorGridlines.Format.Line.ForeColor.RGB = cGrid
            va.MajorGridlines.Format.Line.Weight = 0.75
        End If
        va.TickLabels.Font.color = cMuted
        va.TickLabels.Font.Size = 9
        va.Format.Line.visible = msoFalse
    End If
    Set ca = ch.Axes(xlCategory)
    If Not ca Is Nothing Then
        ca.TickLabels.Font.color = cMuted
        ca.TickLabels.Font.Size = 9
        ca.Format.Line.ForeColor.RGB = cBorder
        ca.MajorTickMark = xlTickMarkNone
    End If

    ' — Légende —
    If ch.HasLegend Then
        ch.Legend.Position = xlLegendPositionBottom
        ch.Legend.Font.name = FONT_UI
        ch.Legend.Font.Size = 9
        ch.Legend.Font.color = cMuted
        ch.Legend.Format.fill.visible = msoFalse
    End If

    ' — Séries : couleur selon le nom —
    Dim s As Series
    Dim idx As Long: idx = 0
    For Each s In ch.SeriesCollection
        ColorSeries s, idx
        idx = idx + 1
    Next s
    On Error GoTo 0
End Sub

' Couleur d'une série d'après son nom (E85?vert, SP98?bleu, objectif/kit?ambre…)
Private Sub ColorSeries(s As Series, idx As Long)
    On Error Resume Next
    Dim nm As String: nm = LCase$(s.name)
    Dim c As Long, dashed As Boolean
    dashed = False

    If InStr(nm, "e85") > 0 Then
        c = cGreen
    ElseIf InStr(nm, "sp98") > 0 Or InStr(nm, "s98") > 0 Then
        c = cBlueMid
    ElseIf InStr(nm, "gazole") > 0 Or InStr(nm, "diesel") > 0 Then
        c = cBlueDark
    ElseIf InStr(nm, "sp95") > 0 Or InStr(nm, "e10") > 0 Then
        c = RGB(96, 165, 250)
    ElseIf InStr(nm, "objectif") > 0 Or InStr(nm, "cible") > 0 Then
        c = cAmber: dashed = True
    ElseIf InStr(nm, "kit") > 0 Then
        c = cAmber: dashed = True
    ElseIf InStr(nm, "economie") > 0 Or InStr(nm, "économie") > 0 Then
        c = cGreen
    ElseIf InStr(nm, "conso") > 0 Then
        c = cGreen
    ElseIf InStr(nm, "co2") > 0 Or InStr(nm, "co2") > 0 Then
        c = cGreen
    ElseIf InStr(nm, "cout") > 0 Or InStr(nm, "coût") > 0 Or _
           InStr(nm, "depense") > 0 Or InStr(nm, "dépense") > 0 Or _
           InStr(nm, "realise") > 0 Or InStr(nm, "réalisé") > 0 Then
        c = cBlueMid
    Else
        c = ChoosePalette(idx)
    End If

    ' Remplissage (barres / aires / parts) ET trait (courbes)
    s.Format.fill.ForeColor.RGB = c
    s.Format.fill.visible = msoTrue
    s.Format.Line.ForeColor.RGB = c
    s.Format.Line.Weight = 2.25
    If dashed Then s.Format.Line.DashStyle = msoLineDash

    ' Marqueurs de courbe
    s.MarkerForegroundColor = c
    s.MarkerBackgroundColor = cWhite
    s.MarkerStyle = xlMarkerStyleCircle
    s.MarkerSize = 5
    On Error GoTo 0
End Sub

Private Function ChoosePalette(idx As Long) As Long
    Select Case (idx Mod 4)
        Case 0: ChoosePalette = cGreen
        Case 1: ChoosePalette = cBlueMid
        Case 2: ChoosePalette = cAmber
        Case 3: ChoosePalette = cBlueDark
    End Select
End Function

'---------------------------------------------------------------------------
'  4. En-tête + cartes KPI + bandeau méta (formes flottantes)
'  Renvoie le Top (pt) où la grille de graphiques doit commencer.
'---------------------------------------------------------------------------
Private Function BuildHeaderAndKPIs(ws As Worksheet) As Single
    ' -- Panneau Paramètres + sélecteurs ÉDITABLES (cellules A1:B6) --
    StyleParamsPanel ws
    EnsureSelectors ws        ' X32 : listes véhicule (B5) / carburant (B6)

    ' -- Paramètres budget / objectif CO2 (cellules éditables de CE dashboard) --
    Dim vBudget As Double, vObjCo2 As Double
    On Error Resume Next
    vBudget = ws.Range("B2").value
    vObjCo2 = ws.Range("B3").value
    On Error GoTo 0

    ' -- X36/X37 : TOUTES les valeurs calculées en direct depuis GS_Pleins,
    '    FILTRÉES par véhicule + carburant. Plus aucune dépendance à un autre
    '    onglet (l'ex-"Tableau de bord" peut être supprimé). --
    Dim selVeh As String, selFuel As String
    selVeh = CStr(ws.Range(CELL_SEL_VEH).value)
    selFuel = CStr(ws.Range(CELL_SEL_FUEL).value)
    Dim ds As DashStats
    modDashboardKPI.ComputeDashboardStats selVeh, selFuel, ds

    Dim vConso As Double, vCoutKm As Double, vCo2 As Double
    Dim vPleins As Double, vKm As Double, vLitres As Double, vPctE85 As Double
    vConso = ds.conso
    vCoutKm = ds.coutKm100 / 100          ' la carte COÛT multiplie par 100
    vCo2 = ds.co2
    vPleins = ds.nbPleins
    vKm = ds.km
    vLitres = ds.litres
    vPctE85 = ds.pctE85

    ' -- Bandeau d'en-tête (pleine largeur, juste sous la navbar horizontale) --
    Dim rowsBottom As Single: rowsBottom = ws.Range("A7").top
    Dim ht As Single: ht = NavbarBottom(ws) + 3   ' +10px ecart blanc sous navbar
    Dim hH As Single: hH = rowsBottom - ht - 2
    Dim bnLeft As Single: bnLeft = 0      ' aligné sur le bord gauche de la navbar
    Dim bnW As Single: bnW = L0 + WTOT   ' même largeur que le contenu de la page
    AddBanner ws, bnLeft + 6, ht, bnW - 12, hH
    ' Bouton « Actualiser » — décalé sous la navbar (ht + 80 pts depuis son bord haut)
    AddButton ws, 16, ht + hH - 40, 26, 26
    ' Infos B7/B8 en bas à droite du bandeau (petite police)
    AddBannerParamsInfo ws, bnLeft, ht, bnW, hH, ws.Range("B7").value, ws.Range("B8").value
    ' X39 : mini-titres (role) sous les 3 boutons d'action
    AddButtonLabels ws, ht + hH

    ' -- Cartes KPI --
    Dim bandH As Single: bandH = SEG_BAND
    On Error Resume Next
    bandH = modFiltres.SegBandHeight()                          ' X39 : hauteur auto selon items
    On Error GoTo 0
    Dim kpiTop As Single: kpiTop = rowsBottom + 2 + bandH   ' X39 : reserve la bande segments
    Dim kpiH As Single: kpiH = 78
    Dim cardW As Single: cardW = (WTOT - 3 * gap) / 4
    Dim x As Single: x = L0

    ' Sous-titre commun : périmètre de filtrage (X33)
    Dim sScope As String
    sScope = SelLabel(selVeh, "tous véhicules") & " · " & SelLabel(selFuel, "tous carburants")

    AddKpiCard ws, x, kpiTop, cardW, kpiH, cGreen, "CONSO MOYENNE", _
               Format(vConso, "0.0"), "L / 100 km · " & sScope
    x = x + cardW + gap
    AddKpiCard ws, x, kpiTop, cardW, kpiH, cBlueMid, "COÛT AUX 100 KM", _
               Format(vCoutKm * 100, "0.00") & " €", sScope
    x = x + cardW + gap
    ' RENTABILITÉ KIT E85 (X47) : reprend les indicateurs de « Suivi Carburant »
    '  (éco cumulée B11, coût kit B6, progression J13) — filtrés par véhicule via #4.
    Dim ecoCumul As Double, kitCost As Double, progKit As Double
    ReadKitStats ecoCumul, kitCost, progKit
    AddKpiCardKit ws, x, kpiTop, cardW, kpiH, cGreen, "RENTABILITÉ KIT E85", _
                  ecoCumul, kitCost, progKit, SelLabel(selVeh, "tous véhicules")
    x = x + cardW + gap
    AddKpiCard ws, x, kpiTop, cardW, kpiH, cAmber, "CO2 ÉVITÉ", _
               Format(vCo2, "0") & " kg", "vs essence · objectif " & Format(vObjCo2, "0") & " kg"

    ' -- Bandeau méta (ligne 1 : volumétrie) --
    Dim metaTop As Single: metaTop = kpiTop + kpiH + gap
    Dim metaTxt As String
    metaTxt = "Pleins : " & Format(vPleins, "0") & "      ·      " & _
              "Distance : " & Format(vKm, "# ##0") & " km      ·      " & _
              "Carburant : " & Format(vLitres, "#0.0") & " L      ·      " & _
              "% pleins E85 : " & Format(vPctE85, "0 %")
    AddMetaStrip ws, L0, metaTop, WTOT, 26, metaTxt

    ' -- Bandeau méta (ligne 2 : valeurs fusionnées de l'ancien tableau de bord) --
    Dim metaTop2 As Single: metaTop2 = metaTop + 26 + 4
    Dim sDate As String
    If ds.dateDernier > DateSerial(1900, 1, 1) Then sDate = Format(ds.dateDernier, "dd/mm/yyyy") Else sDate = "—"
    Dim sStation As String
    If Len(Trim$(ds.stationTop)) > 0 Then sStation = ds.stationTop Else sStation = "—"
    Dim metaTxt2 As String
    metaTxt2 = "Dépense totale : " & Format(ds.depense, "# ##0") & " €      ·      " & _
               "Prix moyen " & SelLabel(selFuel, "E85") & " : " & Format(ds.prixMoyen, "0.000") & " €/L      ·      " & _
               "Dernier plein : " & sDate & "      ·      " & _
               "Station préférée : " & sStation
    AddMetaStrip ws, L0, metaTop2, WTOT, 26, metaTxt2

    BuildHeaderAndKPIs = metaTop2 + 26 + gap
End Function

'---- Bandeau d'en-tête bleu nuit -------------------------------------------
Private Sub AddBanner(ws As Worksheet, x As Single, y As Single, w As Single, h As Single)
    Dim bg As Shape
    Set bg = ws.Shapes.AddShape(msoShapeRoundedRectangle, x, y, w, h)
    bg.name = "dash_banner"
    StyleRect bg, cBlueDark, -1, 6
    bg.Shadow.visible = msoFalse

    ' Titre — GRAND, GRAS, CENTRE dans toute la largeur du bandeau
    Dim T As Shape
    Set T = ws.Shapes.AddTextbox(msoTextOrientationHorizontal, x, y + h / 2 - 26, w, 30)
    T.name = "dash_title"
    SetText T, "Suivi Consommation Carburant", FONT_UI, 22, True, cWhite, msoAlignCenter
    ' Sous-titre — centre sous le titre
    Dim st As Shape
    Set st = ws.Shapes.AddTextbox(msoTextOrientationHorizontal, x, y + h / 2 + 7, w, 16)
    st.name = "dash_subtitle"
    SetText st, "Tableau de bord — vue d'ensemble", FONT_UI, 10, False, RGB(150, 175, 200), msoAlignCenter
End Sub

' X39 : bord droit du rail d'icones de la sidebar (toujours visible) -> debut du bandeau.
Private Function SidebarRailRight(ws As Worksheet) As Single
    Dim r As Single, sh As Shape
    On Error Resume Next
    For Each sh In ws.Shapes
        If Left$(sh.name, 7) = "sb_ico_" Or sh.name = "sb_ham" Or Left$(sh.name, 7) = "sb_sep_" Then
            If sh.Left + sh.Width > r Then r = sh.Left + sh.Width
        End If
    Next sh
    On Error GoTo 0
    If r < 10 Then r = 41    ' garde-fou si sidebar absente
    SidebarRailRight = r
End Function

' X39 : mini-titres (role) sous les 3 boutons d'action — police mini blanche centree.
Private Sub AddButtonLabels(ws As Worksheet, ht As Single)
    Dim yLbl As Single: yLbl = ht - 13  ' même offset relatif que les boutons (80) + 29 pts
    AddBtnLabel ws, "dash_btnlbl_0", "Actualiser", 7, yLbl, 44
    AddBtnLabel ws, "dash_btnlbl_1", "Recr" & ChrW(233) & "er", 57, yLbl, 44
    AddBtnLabel ws, "dash_btnlbl_2", "Export", 107, yLbl, 44
End Sub
Private Sub AddBtnLabel(ws As Worksheet, nm As String, txt As String, x As Single, y As Single, w As Single)
    Dim s As Shape
    Set s = ws.Shapes.AddTextbox(msoTextOrientationHorizontal, x, y, w, 11)
    s.name = nm
    SetText s, txt, FONT_UI, 7, False, cWhite, msoAlignCenter
    s.Placement = xlFreeFloating
    On Error Resume Next
    With s.TextFrame2
        .MarginLeft = 0: .MarginRight = 0: .MarginTop = 0: .MarginBottom = 0
    End With
    On Error GoTo 0
End Sub

'---- Bouton « Actualiser » : relance la macro d'un clic ------------------
Private Sub AddButton(ws As Worksheet, x As Single, y As Single, w As Single, h As Single)
    ' Bouton-icone "Actualiser" (PNG sync vert) ; repli carre vert si image absente.
    Dim p As String
    p = ThisWorkbook.path & Application.PathSeparator & "assets" & _
        Application.PathSeparator & "btn_actualiser.png"
    Dim ok As Boolean: ok = False
    On Error Resume Next
    If Dir(p) <> "" Then
        Dim pic As Shape
        Set pic = ws.Shapes.AddPicture(p, msoFalse, msoTrue, x, y, w, h)
        If Not pic Is Nothing Then
            pic.name = "dash_btn"
            pic.OnAction = "MAJ_Dashboard_Graphiques"
            pic.AlternativeText = "Actualiser"
            pic.Placement = xlFreeFloating
            ok = True
        End If
    End If
    On Error GoTo 0
    If Not ok Then
        Dim b As Shape
        Set b = ws.Shapes.AddShape(msoShapeRoundedRectangle, x, y, w, h)
        b.name = "dash_btn"
        b.fill.ForeColor.RGB = RGB(29, 158, 117)
        b.Line.visible = msoFalse
        b.OnAction = "MAJ_Dashboard_Graphiques"
        b.AlternativeText = "Actualiser"
        b.Placement = xlFreeFloating
    End If
End Sub

'---- Panneau Paramètres ÉDITABLE (formate les cellules A1:B3 en carte) -----
'  Les cellules B2 (Budget) et B3 (Objectif CO2) restent les VRAIES entrées :
'  l'utilisateur les édite directement ici, puis clique « Actualiser ».
Private Sub StyleParamsPanel(ws As Worksheet)
    On Error Resume Next
    ' X39 P6 : la barre A (segments + chronologie) remplace les selecteurs visibles.
    '  On CONSERVE la geometrie — largeurs A/B (-> Range("C1").Left de la banniere)
    '  et hauteurs des lignes 1..6 (-> Range("A7").Top de la bande segments) — mais on
    '  rend le bloc d'etat INVISIBLE. B2..B10 gardent leurs valeurs (budget, CO2,
    '  annee, vehicule, carburant, periode) : cellules d'etat cachees lues par le moteur.
    ws.Columns("A").ColumnWidth = 27
    ws.Columns("B").ColumnWidth = 13
    ws.rows(1).RowHeight = 22
    Dim rr As Long
    For rr = 2 To 6: ws.rows(rr).RowHeight = 21: Next rr
    With ws.Range("A1:B10")
        .Interior.color = cWhite
        .Font.color = cWhite
        .Borders.LineStyle = xlNone
    End With
    ws.Range("B2:B4").NumberFormat = "0"        ' Budget / CO2 / Annee
    ws.Range("B5:B6").NumberFormat = "@"        ' Vehicule / Carburant (texte)
    On Error GoTo 0
End Sub

'---- Sélecteurs Véhicule (B5) / Carburant (B6) — X32 -----------------------
'  Listes alimentées par les valeurs distinctes de GS_Pleins (modDashboardKPI).
'  Valeurs écrites dans des colonnes techniques masquées (AZ/BA) servant de
'  source de validation. Défaut = véhicule & carburant du dernier plein.
Private Sub EnsureSelectors(ws As Worksheet)
    On Error Resume Next

    ws.Range("A5").value = "Véhicule"
    ws.Range("A6").value = "Carburant"

    ws.Columns(COL_LIST_VEH).ClearContents
    ws.Columns(COL_LIST_FUEL).ClearContents

    Dim vehs() As String, fuels() As String
    vehs = modDashboardKPI.KPIVehiculeList()
    fuels = modDashboardKPI.KPICarburantList()

    Dim nVeh As Long, nFuel As Long, i As Long
    ws.Cells(1, COL_LIST_VEH).value = modDashboardKPI.KPI_TOUS
    nVeh = 1
    For i = LBound(vehs) To UBound(vehs)
        If Len(vehs(i)) > 0 Then
            nVeh = nVeh + 1
            ws.Cells(nVeh, COL_LIST_VEH).value = vehs(i)
        End If
    Next i
    ' ---- FUEL : liste fixe exhaustive + valeurs distinctes de GS_Pleins ----
    Dim FIXED_FUELS(5) As String
    FIXED_FUELS(0) = "E85":    FIXED_FUELS(1) = "SP95": FIXED_FUELS(2) = "SP98"
    FIXED_FUELS(3) = "Gazole": FIXED_FUELS(4) = "GPL":  FIXED_FUELS(5) = "E10"

    ws.Cells(1, COL_LIST_FUEL).value = modDashboardKPI.KPI_TOUS
    nFuel = 1
    Dim fi As Long
    For fi = 0 To 5
        nFuel = nFuel + 1
        ws.Cells(nFuel, COL_LIST_FUEL).value = FIXED_FUELS(fi)
    Next fi
    ' Ajouter valeurs distinctes de GS_Pleins absentes de la liste fixe
    For i = LBound(fuels) To UBound(fuels)
        If Len(fuels(i)) > 0 Then
            Dim alreadyIn As Boolean: alreadyIn = False
            For fi = 0 To 5
                If StrComp(fuels(i), FIXED_FUELS(fi), vbTextCompare) = 0 Then
                    alreadyIn = True: Exit For
                End If
            Next fi
            If Not alreadyIn Then
                nFuel = nFuel + 1
                ws.Cells(nFuel, COL_LIST_FUEL).value = fuels(i)
            End If
        End If
    Next i
    ' ---- FIN liste carburants ----

    ' Colonnes techniques masquées (sources de validation)
    ws.Columns(COL_LIST_VEH).Hidden = True
    ws.Columns(COL_LIST_FUEL).Hidden = True

    ' X39 P6 : les segments slcVehicule/slcCarburant remplacent les listes B5/B6.
    '  On retire toute validation (plus de fleche de liste deroulante visible).
    ws.Range(CELL_SEL_VEH).Validation.Delete
    ws.Range(CELL_SEL_FUEL).Validation.Delete

    ' Défauts (dernier plein) si cellule vide ou hors liste
    If Not InTechList(ws, COL_LIST_VEH, nVeh, CStr(ws.Range(CELL_SEL_VEH).value)) Then
        Dim dv As String: dv = modDashboardKPI.KPIDefautVehicule()
        If Len(dv) = 0 Then dv = modDashboardKPI.KPI_TOUS
        ws.Range(CELL_SEL_VEH).value = dv
    End If
    Dim fuelVal As String: fuelVal = CStr(ws.Range(CELL_SEL_FUEL).value)
    If InStr(fuelVal, ",") = 0 Then
        If Not InTechList(ws, COL_LIST_FUEL, nFuel, fuelVal) Then
            Dim df As String: df = modDashboardKPI.KPIDefautCarburant()
            If Len(df) = 0 Then df = modDashboardKPI.KPI_TOUS
            ws.Range(CELL_SEL_FUEL).value = df
        End If
    End If

    On Error GoTo 0
End Sub

Private Sub ApplyListValidation(Target As Range, ws As Worksheet, col As Long, count As Long)
    On Error Resume Next
    If count < 1 Then Exit Sub
    Dim addr As String
    ' X36 : quotes simples autour du nom de feuille — indispensable depuis le
    ' renommage en « Tableau de bord » (nom AVEC espaces) ; sinon la formule de
    ' validation est invalide et la liste déroulante ne se crée pas.
    addr = "='" & ws.name & "'!" & ws.Range(ws.Cells(1, col), ws.Cells(count, col)).Address
    With Target.Validation
        .Delete
        .Add Type:=xlValidateList, AlertStyle:=xlValidAlertStop, Formula1:=addr
        .IgnoreBlank = True
        .InCellDropdown = True
    End With
    On Error GoTo 0
End Sub

Private Function InTechList(ws As Worksheet, col As Long, count As Long, val As String) As Boolean
    Dim i As Long
    If Len(Trim$(val)) = 0 Then Exit Function
    For i = 1 To count
        If StrComp(CStr(ws.Cells(i, col).value), val, vbTextCompare) = 0 Then
            InTechList = True
            Exit Function
        End If
    Next i
End Function

' Libellé court d'une sélection ("(tous)" -> texte par défaut fourni).
Private Function SelLabel(sel As String, allLabel As String) As String
    If Len(Trim$(sel)) = 0 Or sel = modDashboardKPI.KPI_TOUS Then
        SelLabel = allLabel
    Else
        SelLabel = sel
    End If
End Function

'---- Carte KPI : rect blanc + barre d'accent + 3 lignes de texte -----------
Private Sub AddKpiCard(ws As Worksheet, x As Single, y As Single, w As Single, h As Single, _
                       accent As Long, label As String, value As String, unit As String)
    Dim card As Shape
    Set card = ws.Shapes.AddShape(msoShapeRoundedRectangle, x, y, w, h)
    card.name = "dash_kpi"
    StyleRect card, cWhite, cBorder, 5

    ' Barre d'accent à gauche
    Dim bar As Shape
    Set bar = ws.Shapes.AddShape(msoShapeRectangle, x + 2, y + 6, 4, h - 12)
    bar.name = "dash_kpibar"
    StyleRect bar, accent, -1, 0

    ' Label
    Dim lab As Shape
    Set lab = ws.Shapes.AddTextbox(msoTextOrientationHorizontal, x + 16, y + 10, w - 24, 14)
    lab.name = "dash_kpilabel"
    SetText lab, label, FONT_UI, 9, True, cMuted, msoAlignLeft

    ' Valeur
    Dim val As Shape
    Set val = ws.Shapes.AddTextbox(msoTextOrientationHorizontal, x + 15, y + 26, w - 24, 30)
    val.name = "dash_kpivalue"
    SetText val, value, FONT_UI, 24, True, accent, msoAlignLeft

    ' Unité
    Dim un As Shape
    Set un = ws.Shapes.AddTextbox(msoTextOrientationHorizontal, x + 16, y + 56, w - 24, 14)
    un.name = "dash_kpiunit"
    SetText un, unit, FONT_UI, 9, False, cMuted, msoAlignLeft
End Sub

' Lit les indicateurs de rentabilite du kit depuis « Suivi Carburant » (X47).
'  B11 = economie cumulee (EUR) ; B6 = cout du kit (EUR) ; J13 = progression (0..1).
'  Source unique = la feuille (formules) -> coherent et sans le bug surconso VBA ;
'  devient filtre par vehicule une fois « Suivi Carburant » rendu reactif (X48).
Private Sub ReadKitStats(ByRef ecoCumul As Double, ByRef kitCost As Double, ByRef prog As Double)
    ecoCumul = 0: kitCost = 0: prog = 0
    On Error Resume Next
    Dim wsC As Worksheet: Set wsC = ThisWorkbook.Worksheets("Suivi Carburant")
    If wsC Is Nothing Then Exit Sub
    If IsNumeric(wsC.Range("B11").value) Then ecoCumul = CDbl(wsC.Range("B11").value)
    If IsNumeric(wsC.Range("B6").value) Then kitCost = CDbl(wsC.Range("B6").value)
    If IsNumeric(wsC.Range("J13").value) Then prog = CDbl(wsC.Range("J13").value)
    If prog < 0 Then prog = 0
    If prog > 1 Then prog = 1
    On Error GoTo 0
End Sub

'---- Carte KPI « Rentabilite kit » : eco cumulee / cout kit + barre de progression
Private Sub AddKpiCardKit(ws As Worksheet, x As Single, y As Single, w As Single, h As Single, _
                          accent As Long, label As String, _
                          ecoCumul As Double, kitCost As Double, prog As Double, scope As String)
    Dim card As Shape
    Set card = ws.Shapes.AddShape(msoShapeRoundedRectangle, x, y, w, h)
    card.name = "dash_kpi"
    StyleRect card, cWhite, cBorder, 5

    Dim bar As Shape
    Set bar = ws.Shapes.AddShape(msoShapeRectangle, x + 2, y + 6, 4, h - 12)
    bar.name = "dash_kpibar"
    StyleRect bar, accent, -1, 0

    Dim lab As Shape
    Set lab = ws.Shapes.AddTextbox(msoTextOrientationHorizontal, x + 16, y + 8, w - 24, 14)
    lab.name = "dash_kpilabel"
    SetText lab, label, FONT_UI, 9, True, cMuted, msoAlignLeft

    Dim val As Shape
    Set val = ws.Shapes.AddTextbox(msoTextOrientationHorizontal, x + 15, y + 22, w - 24, 24)
    val.name = "dash_kpivalue"
    SetText val, Format(ecoCumul, "0") & " " & ChrW(8364) & " / " & Format(kitCost, "0") & " " & ChrW(8364), FONT_UI, 17, True, accent, msoAlignLeft

    ' Barre de progression : piste grise + remplissage proportionnel a prog (0..1)
    Dim barW As Single: barW = w - 32
    Dim trk As Shape
    Set trk = ws.Shapes.AddShape(msoShapeRoundedRectangle, x + 16, y + h - 22, barW, 8)
    trk.name = "dash_kpitrack"
    StyleRect trk, cGrid, -1, 2
    trk.Shadow.visible = msoFalse
    Dim fillW As Single: fillW = barW * prog
    If fillW < 2 And prog > 0 Then fillW = 2
    If fillW > barW Then fillW = barW
    If fillW > 0 Then
        Dim fl As Shape
        Set fl = ws.Shapes.AddShape(msoShapeRoundedRectangle, x + 16, y + h - 22, fillW, 8)
        fl.name = "dash_kpifill"
        StyleRect fl, accent, -1, 2
        fl.Shadow.visible = msoFalse
    End If

    Dim un As Shape
    Set un = ws.Shapes.AddTextbox(msoTextOrientationHorizontal, x + 16, y + h - 13, w - 24, 12)
    un.name = "dash_kpiunit"
    SetText un, "amorti " & Format(prog, "0 %") & " " & ChrW(183) & " " & scope, FONT_UI, 8, False, cMuted, msoAlignLeft
End Sub

'---- Infos parametres (B7/B8) dans le bandeau — bas droite, petite police ---
Private Sub AddBannerParamsInfo(ws As Worksheet, bx As Single, by As Single, _
                                bw As Single, bH As Single, _
                                graphAuto As Variant, lastGen As Variant)
    Dim sAuto As String
    sAuto = Trim$(CStr(graphAuto))
    If Len(sAuto) = 0 Then sAuto = "Oui"
    Dim sGen As String
    On Error Resume Next
    If IsDate(lastGen) And CDate(lastGen) > CDate("01/01/1900") Then
        sGen = Format(CDate(lastGen), "dd/mm hh:mm")
    Else
        sGen = "—"
    End If
    On Error GoTo 0
    Dim txt As Shape
    Set txt = ws.Shapes.AddTextbox(msoTextOrientationHorizontal, _
        bx + bw - 220, by + bH - 20, 215, 16)
    txt.name = "dash_meta_params"
    On Error Resume Next
    With txt.TextFrame2
        .TextRange.text = "Mise " & ChrW(224) & " jour: " & sGen
        .TextRange.Font.name = FONT_UI
        .TextRange.Font.Size = 8
        .TextRange.Font.fill.ForeColor.RGB = RGB(140, 170, 200)
        .TextRange.ParagraphFormat.Alignment = msoAlignRight
        .VerticalAnchor = msoAnchorBottom
        .MarginLeft = 0: .MarginRight = 4: .MarginTop = 0: .MarginBottom = 2
    End With
    txt.fill.visible = msoFalse
    txt.Line.visible = msoFalse
    On Error GoTo 0
End Sub

'---- Bandeau méta (bleu clair) ---------------------------------------------
Private Sub AddMetaStrip(ws As Worksheet, x As Single, y As Single, w As Single, h As Single, txt As String)
    Dim bg As Shape
    Set bg = ws.Shapes.AddShape(msoShapeRoundedRectangle, x, y, w, h)
    bg.name = "dash_meta"
    StyleRect bg, cBlueLight, -1, 5
    Dim T As Shape
    Set T = ws.Shapes.AddTextbox(msoTextOrientationHorizontal, x + 16, y + 4, w - 32, h - 8)
    T.name = "dash_metatxt"
    SetText T, txt, FONT_UI, 10.5, False, cBlueDark, msoAlignLeft
End Sub

'---------------------------------------------------------------------------
'  5. Disposition des 11 graphiques en grille 3 colonnes
'---------------------------------------------------------------------------
Private Sub LayoutCharts(ws As Worksheet, topStart As Single)
    Dim cols As Long: cols = 3
    Dim chartW As Single: chartW = (WTOT - (cols - 1) * gap) / cols
    Dim chartH As Single: chartH = 196
    Dim pitchY As Single: pitchY = chartH + gap

    ' Ordre logique souhaité (par mot-clé du titre)
    Dim order As Variant
    order = Array( _
        "consommation (l/100", "cout mensuel", "evolution du prix", _
        "comparaison vehicules", "tendance depenses", "co2 evite - cumul", _
        "rentabilite du kit : economie", "cout au km (c", "projection de rentabilite", _
        "objectif co2 annuel", "budget annuel")

    Dim placed As Object: Set placed = CreateObject("Scripting.Dictionary")
    Dim slot As Long: slot = 0
    Dim k As Long, co As ChartObject

    ' 1) place dans l'ordre voulu
    For k = LBound(order) To UBound(order)
        Set co = FindChartByTitle(ws, CStr(order(k)))
        If Not co Is Nothing Then
            PlaceChart co, topStart, chartW, chartH, pitchY, slot, cols
            placed(co.name) = True
            slot = slot + 1
        End If
    Next k
    ' 2) place les éventuels graphiques restants
    For Each co In ws.ChartObjects
        If Not placed.Exists(co.name) Then
            PlaceChart co, topStart, chartW, chartH, pitchY, slot, cols
            slot = slot + 1
        End If
    Next co
End Sub

Private Sub PlaceChart(co As ChartObject, topStart As Single, w As Single, h As Single, _
                       pitchY As Single, slot As Long, cols As Long)
    Dim r As Long: r = slot \ cols
    Dim cIdx As Long: cIdx = slot Mod cols
    co.Left = L0 + cIdx * (w + gap)
    co.top = topStart + r * pitchY
    co.Width = w
    co.Height = h
    co.Placement = xlMove
End Sub

Private Function FindChartByTitle(ws As Worksheet, keyword As String) As ChartObject
    Dim co As ChartObject, ttl As String
    For Each co In ws.ChartObjects
        ttl = ""
        On Error Resume Next
        If co.Chart.HasTitle Then ttl = LCase$(co.Chart.ChartTitle.text)
        On Error GoTo 0
        If Len(keyword) > 0 And InStr(ttl, keyword) > 0 Then
            Set FindChartByTitle = co
            Exit Function
        End If
    Next co
    Set FindChartByTitle = Nothing
End Function

'---------------------------------------------------------------------------
'  Helpers de mise en forme des formes
'---------------------------------------------------------------------------
Private Sub StyleRect(sh As Shape, fillColor As Long, lineColor As Long, radius As Single)
    On Error Resume Next
    sh.fill.ForeColor.RGB = fillColor
    sh.fill.Solid
    If lineColor = -1 Then
        sh.Line.visible = msoFalse
    Else
        sh.Line.visible = msoTrue
        sh.Line.ForeColor.RGB = lineColor
        sh.Line.Weight = 1
    End If
    ' Rayon des coins arrondis (0..0.5)
    If sh.AutoShapeType = msoShapeRoundedRectangle And radius > 0 Then
        sh.Adjustments(1) = radius / (Application.Min(sh.Width, sh.Height))
    End If
    sh.Shadow.visible = msoFalse
    On Error GoTo 0
End Sub

Private Sub SetText(sh As Shape, txt As String, fontName As String, sz As Single, _
                    bold As Boolean, color As Long, align As Long)
    On Error Resume Next
    With sh.TextFrame2
        .TextRange.text = txt
        .TextRange.Font.name = fontName
        .TextRange.Font.Size = sz
        .TextRange.Font.bold = bold
        .TextRange.Font.fill.ForeColor.RGB = color
        .TextRange.ParagraphFormat.Alignment = IIf(align = msoAlignRight, msoAlignRight, IIf(align = msoAlignCenter, msoAlignCenter, msoAlignLeft))
        .VerticalAnchor = msoAnchorTop
        .MarginLeft = 0: .MarginRight = 0: .MarginTop = 0: .MarginBottom = 0
        .WordWrap = msoTrue
        .AutoSize = msoAutoSizeNone
    End With
    sh.Line.visible = msoFalse
    sh.fill.visible = msoFalse
    On Error GoTo 0
End Sub







