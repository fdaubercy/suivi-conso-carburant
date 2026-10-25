Attribute VB_Name = "modVueDepenses"
' ============================================================
'  modVueDepenses - Onglet visible "Depenses" (couts d'entretien)
' ============================================================
'  Construit (idempotent) une feuille de consultation des depenses
'  enregistrees (entretien, reparation, kit, autre), alimentee par la
'  table technique tblDepenses (feuille masquee _Depenses, cf.
'  modSyncDepenses). Tout est en formules dynamiques (FILTER, SORTBY,
'  UNIQUE, HSTACK, MAP) : la feuille se met a jour seule a chaque
'  synchronisation, sans macro de rafraichissement.
'
'  Vehicule selectionne = 'Suivi Carburant'!B3 (miroir du segment
'  Vehicule du tableau de bord, ou choix local X54). Un segment
'  "Vehicule" partageant le meme cache est pose sur l'onglet.
'
'  Contenu : vehicule, total, nombre ; en B9 le detail des depenses du
'  vehicule (plus recente en haut) ; a droite la repartition par
'  categorie / annee du vehicule, puis le total par vehicule (tous).
'  Les lignes supprimees (supprime = 1) sont ignorees.
'
'  Points d'entree :
'    EnsureVueDepenses           - (re)construit l'onglet (relancable).
'    EnsureTuileAccueilDepenses  - tuile "Depenses" de l'Accueil.
'    NavDepenses                 - cible de la tuile.
'  Source ASCII pur : accents via ChrW (cf. lecon #125).
' ============================================================
Option Explicit

Private Const ROW_HDR   As Long = 9      ' en-tetes des tableaux
Private Const ROW_TOUS  As Long = 20     ' en-tete du recap tous vehicules
Private Const SEL       As String = "'Suivi Carburant'!$B$3"
Private Const SLC_CACHE As String = "Segment_Vehicule"
Private Const SLC_NOM   As String = "dep_slcVehicule"
Private Const TUILE_ACC As String = "btnAccDepenses"

Private Function NomFeuille() As String
    NomFeuille = "D" & ChrW(233) & "penses"
End Function

Private Function FmtEuro() As String
    FmtEuro = "#,##0.00 " & ChrW(8364)
End Function

' Masque des depenses actives du vehicule selectionne ("(tous)" = toutes).
Private Function OkVeh() As String
    OkVeh = "(tblDepenses[supprime]<>1)*(((" & SEL & "=""(tous)"")+(tblDepenses[vehicule]=" & SEL & "))>0)"
End Function

Public Sub EnsureVueDepenses()
    Dim ev As Boolean: ev = Application.EnableEvents
    Dim su As Boolean: su = Application.ScreenUpdating
    Application.EnableEvents = False
    Application.ScreenUpdating = False
    On Error GoTo done

    modSyncDepenses.EnsureDepensesReady

    Dim ws As Worksheet
    On Error Resume Next
    Set ws = ThisWorkbook.Worksheets(NomFeuille())
    On Error GoTo done
    If ws Is Nothing Then
        Dim apres As Worksheet
        On Error Resume Next
        Set apres = ThisWorkbook.Worksheets("Suivi Carburant")
        On Error GoTo done
        If apres Is Nothing Then
            Set ws = ThisWorkbook.Worksheets.Add(After:=ThisWorkbook.Worksheets(ThisWorkbook.Worksheets.Count))
        Else
            Set ws = ThisWorkbook.Worksheets.Add(After:=apres)
        End If
        ws.name = NomFeuille()
    End If

    Dim j As Long
    For j = ws.Shapes.Count To 1 Step -1
        If Left$(ws.Shapes(j).name, 4) = "dep_" Then ws.Shapes(j).Delete
    Next j
    ws.Cells.Clear

    Dim cPrim As Long: cPrim = modCharte.CharteColor("Primaire")
    Dim cSub As Long:  cSub = modCharte.CharteColor("Subtil")
    ws.Tab.Color = modCharte.CharteColor("Vert")
    ws.Cells.Font.name = "Calibri"
    ws.Cells.Font.Size = 11
    ws.Rows(1).RowHeight = 50

    ColW ws, Array(2, 12, 13, 34, 13, 3, 14, 8, 12, 3, 8, 8, 12)

    ' -- Titre
    With ws.Range("B3")
        .value = "Co" & ChrW(251) & "ts d'entretien & d" & ChrW(233) & "penses"
        .Font.Size = 18: .Font.bold = True: .Font.Color = cPrim
    End With
    With ws.Range("B4")
        .value = "D" & ChrW(233) & "penses enregistr" & ChrW(233) & "es (application et Excel) du v" & ChrW(233) & _
                 "hicule s" & ChrW(233) & "lectionn" & ChrW(233) & ". Mise " & ChrW(224) & " jour automatique."
        .Font.Italic = True: .Font.Color = cSub
    End With

    ' -- Indicateurs du vehicule selectionne
    Lbl ws.Range("B6"), "V" & ChrW(233) & "hicule"
    ws.Range("C6").Formula2 = "=" & SEL
    Lbl ws.Range("B7"), "Total"
    ws.Range("C7").Formula2 = "=SUM(FILTER(tblDepenses[montant]," & OkVeh() & ",0))"
    ws.Range("C7").NumberFormat = FmtEuro()
    ws.Range("D7").Formula2 = "=SUM(--(" & OkVeh() & "))&"" d" & ChrW(233) & "pense(s)"""
    ws.Range("C6:C7").Font.bold = True
    ws.Range("C6:C7").Font.Size = 13
    ws.Range("C6:C7").HorizontalAlignment = xlLeft
    ws.Range("D7").Font.Color = cSub

    ' -- B9 : detail des depenses du vehicule (plus recente en haut)
    Entete ws.Range(ws.Cells(ROW_HDR, 2), ws.Cells(ROW_HDR, 5)), _
        Array("Date", "Cat" & ChrW(233) & "gorie", "Intitul" & ChrW(233), "Montant"), cPrim
    ws.Cells(ROW_HDR + 1, 2).Formula2 = "=IFERROR(LET(ok," & OkVeh() & ",d,tblDepenses[date]," & _
        "dt,IFERROR(DATE(LEFT(d,4),MID(d,6,2),MID(d,9,2)),d)," & _
        "t,FILTER(HSTACK(dt,tblDepenses[categorie],tblDepenses[intitule],tblDepenses[montant]),ok)," & _
        "SORTBY(t,INDEX(t,,1),-1)),""Aucune d" & ChrW(233) & "pense pour ce v" & ChrW(233) & "hicule"")"
    ws.Range(ws.Cells(ROW_HDR + 1, 2), ws.Cells(ROW_HDR + 500, 2)).NumberFormat = "dd/mm/yyyy"
    ws.Range(ws.Cells(ROW_HDR + 1, 2), ws.Cells(ROW_HDR + 500, 2)).HorizontalAlignment = xlLeft
    ws.Range(ws.Cells(ROW_HDR + 1, 5), ws.Cells(ROW_HDR + 500, 5)).NumberFormat = FmtEuro()

    ' -- Repartitions du vehicule (categorie G:I, annee K:M), 9 lignes reservees
    Entete ws.Range(ws.Cells(ROW_HDR, 7), ws.Cells(ROW_HDR, 9)), _
        Array("Cat" & ChrW(233) & "gorie", "Nb", "Total"), cPrim
    ws.Cells(ROW_HDR + 1, 7).Formula2 = RepartitionVeh("tblDepenses[categorie]", "SORT(UNIQUE(FILTER(c,ok)))")
    Entete ws.Range(ws.Cells(ROW_HDR, 11), ws.Cells(ROW_HDR, 13)), _
        Array("Ann" & ChrW(233) & "e", "Nb", "Total"), cPrim
    ws.Cells(ROW_HDR + 1, 11).Formula2 = RepartitionVeh("LEFT(tblDepenses[date],4)", "SORT(UNIQUE(FILTER(c,ok)),,-1)")

    ' -- Recap tous vehicules (G:I)
    With ws.Cells(ROW_TOUS - 1, 7)
        .value = "Tous v" & ChrW(233) & "hicules"
        .Font.bold = True: .Font.Color = cPrim
    End With
    Entete ws.Range(ws.Cells(ROW_TOUS, 7), ws.Cells(ROW_TOUS, 9)), _
        Array("V" & ChrW(233) & "hicule", "Nb", "Total"), cPrim
    ws.Cells(ROW_TOUS + 1, 7).Formula2 = "=IFERROR(LET(ok,tblDepenses[supprime]<>1,c,tblDepenses[vehicule]," & _
        "u,SORT(UNIQUE(FILTER(c,ok)))," & _
        "HSTACK(u,MAP(u,LAMBDA(a,SUM((c=a)*ok))),MAP(u,LAMBDA(a,SUM((c=a)*ok*tblDepenses[montant]))))),""-"")"

    ws.Range(ws.Cells(ROW_HDR + 1, 9), ws.Cells(ROW_TOUS + 15, 9)).NumberFormat = FmtEuro()
    ws.Range(ws.Cells(ROW_HDR + 1, 13), ws.Cells(ROW_HDR + 9, 13)).NumberFormat = FmtEuro()

    ' -- Boutons d'action
    Bouton ws, "dep_btnSync", ChrW(8635) & " Synchroniser", "modSyncDepenses.SyncDepensesManuel", _
           ws.Range("G3"), 0, cPrim
    Bouton ws, "dep_btnAdd", "+ Ajouter une d" & ChrW(233) & "pense", "modSyncDepenses.AjouterDepenseExcel", _
           ws.Range("G3"), 160, modCharte.CharteColor("Vert")

    ' -- Segment "Vehicule" (meme cache que le tableau de bord)
    PoserSegmentVehicule ws, ws.Range("K5").Left, ws.Range("C5").Top

    ' -- Barre de navigation commune
    ws.Activate
    On Error Resume Next
    ActiveWindow.DisplayGridlines = False
    modSidebar.PoserSidebarSurFeuille ws
    On Error GoTo done
    ws.Range("A1").Select

    EnsureTuileAccueilDepenses

done:
    Application.ScreenUpdating = su
    Application.EnableEvents = ev
End Sub

' Cible de la tuile "Depenses" de l'Accueil.
Public Sub NavDepenses()
    Dim ws As Worksheet
    On Error Resume Next
    Set ws = ThisWorkbook.Worksheets(NomFeuille())
    On Error GoTo 0
    If ws Is Nothing Then
        EnsureVueDepenses
        Set ws = ThisWorkbook.Worksheets(NomFeuille())
    End If
    ws.Visible = xlSheetVisible
    ws.Activate
    ws.Range("A1").Select
End Sub

' Tuile "Depenses" de l'Accueil : copie du style de la tuile Reglages,
' posee a sa droite (idempotent).
Public Sub EnsureTuileAccueilDepenses()
    On Error GoTo fin
    Dim ws As Worksheet: Set ws = ThisWorkbook.Worksheets("Accueil")
    Dim shp As Shape, src As Shape
    On Error Resume Next
    ws.Shapes(TUILE_ACC).Delete
    On Error GoTo fin
    For Each shp In ws.Shapes
        If LCase$(shp.OnAction) Like "*navreglages" Then Set src = shp: Exit For
    Next shp
    If src Is Nothing Then Exit Sub

    ' Forme neuve + PickUp/Apply : une forme Duplicate refuse Name/Left/Top
    ' (-2146777998, cf. lecon #61).
    Dim t As Shape
    Set t = ws.Shapes.AddShape(msoShapeRoundedRectangle, src.Left + src.Width + 12, src.Top, src.Width, src.Height)
    t.name = TUILE_ACC
    src.PickUp
    t.Apply
    t.Placement = src.Placement
    t.OnAction = "modVueDepenses.NavDepenses"
    t.fill.ForeColor.RGB = RGB(14, 116, 144)
    ' Icone cle a molette (U+1F527, paire de substitution UTF-16).
    t.TextFrame2.TextRange.text = ChrW(&HD83D) & ChrW(&HDD27) & Chr(13) & "D" & ChrW(233) & "penses"
fin:
End Sub

' Repartition (valeur | nombre | total) des depenses du vehicule selectionne
' selon une expression de colonne ; ordre = expression de tri sur c / ok.
Private Function RepartitionVeh(ByVal col As String, ByVal ordre As String) As String
    RepartitionVeh = "=IFERROR(LET(ok," & OkVeh() & ",c," & col & ",u," & ordre & "," & _
        "HSTACK(u,MAP(u,LAMBDA(a,SUM((c=a)*ok))),MAP(u,LAMBDA(a,SUM((c=a)*ok*tblDepenses[montant]))))),""-"")"
End Function

Private Sub PoserSegmentVehicule(ws As Worksheet, ByVal x As Double, ByVal y As Double)
    On Error GoTo fin
    Dim sc As SlicerCache: Set sc = ThisWorkbook.SlicerCaches(SLC_CACHE)
    Dim sl As Slicer
    Set sl = sc.Slicers.Add(ws, , SLC_NOM, "V" & ChrW(233) & "hicule", y, x, 200, 56)
    On Error Resume Next
    Dim sh As Shape: Set sh = ws.Shapes(SLC_NOM)
    sh.Placement = xlFreeFloating
    sh.IncrementLeft x - sh.Left
    sh.IncrementTop y - sh.Top
    sh.Width = 200: sh.Height = 56
fin:
End Sub

Private Sub ColW(ws As Worksheet, w As Variant)
    Dim i As Long
    For i = LBound(w) To UBound(w)
        ws.Columns(i - LBound(w) + 1).ColumnWidth = w(i)
    Next i
End Sub

Private Sub Lbl(c As Range, ByVal txt As String)
    c.value = txt
    c.Font.Color = modCharte.CharteColor("Subtil")
End Sub

Private Sub Entete(rng As Range, titres As Variant, ByVal fond As Long)
    rng.value = titres
    rng.Font.bold = True
    rng.Font.Color = RGB(255, 255, 255)
    rng.Interior.Color = fond
End Sub

Private Sub Bouton(ws As Worksheet, ByVal nom As String, ByVal txt As String, _
                   ByVal macro As String, ancre As Range, ByVal dx As Single, ByVal fond As Long)
    Dim sh As Shape
    Set sh = ws.Shapes.AddShape(msoShapeRoundedRectangle, ancre.Left + dx, ancre.Top, 150, 26)
    sh.name = nom
    sh.Placement = xlFreeFloating
    sh.fill.ForeColor.RGB = fond
    sh.Line.visible = msoFalse
    sh.OnAction = macro
    With sh.TextFrame2
        .WordWrap = msoFalse
        .TextRange.text = txt
        .TextRange.Font.Size = 11
        .TextRange.Font.bold = msoTrue
        .TextRange.Font.fill.ForeColor.RGB = RGB(255, 255, 255)
        .TextRange.ParagraphFormat.Alignment = msoAlignCenter
        .VerticalAnchor = msoAnchorMiddle
    End With
End Sub
