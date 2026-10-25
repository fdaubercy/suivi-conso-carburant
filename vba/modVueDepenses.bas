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
'  Contenu : total + nombre + derniere depense, repartition par
'  categorie / vehicule / annee, liste detaillee (plus recente en haut).
'  Les lignes supprimees (supprime = 1) sont ignorees.
'
'  Point d'entree : EnsureVueDepenses (relancable sans risque).
'  Source ASCII pur : accents via ChrW (cf. lecon #125).
' ============================================================
Option Explicit

Private Const TOP_SUMMARY As Long = 10   ' 1re ligne des repartitions
Private Const HDR_DETAIL  As Long = 21   ' en-tete de la liste detaillee

Private Function NomFeuille() As String
    NomFeuille = "D" & ChrW(233) & "penses"
End Function

Private Function FmtEuro() As String
    FmtEuro = "#,##0.00 " & ChrW(8364)
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

    ColW ws, Array(2, 13, 14, 14, 36, 14, 8, 12, 3, 8, 8, 12)

    ' -- Titre
    With ws.Range("B3")
        .value = "Co" & ChrW(251) & "ts d'entretien & d" & ChrW(233) & "penses"
        .Font.Size = 18: .Font.bold = True: .Font.Color = cPrim
    End With
    With ws.Range("B4")
        .value = "Toutes les d" & ChrW(233) & "penses enregistr" & ChrW(233) & "es (application et Excel). " & _
                 "Mise " & ChrW(224) & " jour automatique " & ChrW(224) & " chaque synchronisation."
        .Font.Italic = True: .Font.Color = cSub
    End With

    ' -- Indicateurs
    Lbl ws.Range("B6"), "Total"
    ws.Range("C6").Formula2 = "=SUMIFS(tblDepenses[montant],tblDepenses[supprime],""<>1"")"
    ws.Range("C6").NumberFormat = FmtEuro()
    Lbl ws.Range("D6"), "Nombre"
    ws.Range("E6").Formula2 = "=COUNTIFS(tblDepenses[supprime],""<>1"",tblDepenses[id],""<>"")"
    ws.Range("E6").HorizontalAlignment = xlLeft
    ws.Range("C6,E6").Font.bold = True
    ws.Range("C6,E6").Font.Size = 14
    Lbl ws.Range("B7"), "Derni" & ChrW(232) & "re"
    ws.Range("C7").Formula2 = "=IFERROR(INDEX(" & ListeTriee() & ",1,1),""-"")"
    ws.Range("C7").NumberFormat = "dd/mm/yyyy"
    ws.Range("C7").HorizontalAlignment = xlLeft
    ws.Range("D7").Formula2 = "=IFERROR(INDEX(" & ListeTriee() & ",1,4)&"" - ""&FIXED(INDEX(" & ListeTriee() & ",1,5),2)&"" " & ChrW(8364) & ""","""")"

    ' -- Repartitions (spill vers le bas, 10 lignes reservees)
    Dim r0 As Long: r0 = TOP_SUMMARY
    Entete ws, ws.Range(ws.Cells(r0 - 1, 2), ws.Cells(r0 - 1, 4)), _
        Array("Cat" & ChrW(233) & "gorie", "Nb", "Total"), cPrim
    ws.Cells(r0, 2).Formula2 = Repartition("tblDepenses[categorie]")
    Entete ws, ws.Range(ws.Cells(r0 - 1, 6), ws.Cells(r0 - 1, 8)), _
        Array("V" & ChrW(233) & "hicule", "Nb", "Total"), cPrim
    ws.Cells(r0, 6).Formula2 = Repartition("tblDepenses[vehicule]")
    Entete ws, ws.Range(ws.Cells(r0 - 1, 10), ws.Cells(r0 - 1, 12)), _
        Array("Ann" & ChrW(233) & "e", "Nb", "Total"), cPrim
    ws.Cells(r0, 10).Formula2 = "=IFERROR(LET(ok,tblDepenses[supprime]<>1," & _
        "y,LEFT(tblDepenses[date],4),u,SORT(UNIQUE(FILTER(y,ok)),,-1)," & _
        "HSTACK(u,MAP(u,LAMBDA(a,SUM((y=a)*ok)))," & _
        "MAP(u,LAMBDA(a,SUM((y=a)*ok*tblDepenses[montant]))))),""-"")"
    ws.Range(ws.Cells(r0, 4), ws.Cells(r0 + 9, 4)).NumberFormat = FmtEuro()
    ws.Range(ws.Cells(r0, 8), ws.Cells(r0 + 9, 8)).NumberFormat = FmtEuro()
    ws.Range(ws.Cells(r0, 12), ws.Cells(r0 + 9, 12)).NumberFormat = FmtEuro()

    ' -- Liste detaillee (plus recente en haut)
    Dim h As Long: h = HDR_DETAIL
    With ws.Cells(h - 1, 2)
        .value = "D" & ChrW(233) & "tail des d" & ChrW(233) & "penses"
        .Font.bold = True: .Font.Size = 13: .Font.Color = cPrim
    End With
    Entete ws, ws.Range(ws.Cells(h, 2), ws.Cells(h, 6)), _
        Array("Date", "V" & ChrW(233) & "hicule", "Cat" & ChrW(233) & "gorie", "Intitul" & ChrW(233), "Montant"), cPrim
    ws.Cells(h + 1, 2).Formula2 = "=IFERROR(" & ListeTriee() & ",""Aucune d" & ChrW(233) & "pense enregistr" & ChrW(233) & "e"")"
    ws.Range(ws.Cells(h + 1, 2), ws.Cells(h + 500, 2)).NumberFormat = "dd/mm/yyyy"
    ws.Range(ws.Cells(h + 1, 2), ws.Cells(h + 500, 2)).HorizontalAlignment = xlLeft
    ws.Range(ws.Cells(h + 1, 6), ws.Cells(h + 500, 6)).NumberFormat = FmtEuro()

    ' -- Boutons d'action
    Bouton ws, "dep_btnSync", ChrW(8635) & " Synchroniser", "modSyncDepenses.SyncDepensesManuel", _
           ws.Range("F3"), 0, cPrim
    Bouton ws, "dep_btnAdd", "+ Ajouter une d" & ChrW(233) & "pense", "modSyncDepenses.AjouterDepenseExcel", _
           ws.Range("F3"), 160, modCharte.CharteColor("Vert")

    ' -- Barre de navigation commune
    ws.Activate
    On Error Resume Next
    modSidebar.PoserSidebarSurFeuille ws
    On Error GoTo done
    ws.Range("A1").Select

done:
    Application.ScreenUpdating = su
    Application.EnableEvents = ev
End Sub

' Liste des depenses actives triee par date decroissante :
' Date (vraie date) | Vehicule | Categorie | Intitule | Montant.
Private Function ListeTriee() As String
    ListeTriee = "LET(ok,tblDepenses[supprime]<>1,d,tblDepenses[date]," & _
        "dt,IFERROR(DATE(LEFT(d,4),MID(d,6,2),MID(d,9,2)),d)," & _
        "t,FILTER(HSTACK(dt,tblDepenses[vehicule],tblDepenses[categorie]," & _
        "tblDepenses[intitule],tblDepenses[montant]),ok)," & _
        "SORTBY(t,INDEX(t,,1),-1))"
End Function

' Repartition (valeur | nombre | total) des depenses actives selon une colonne.
Private Function Repartition(ByVal col As String) As String
    Repartition = "=IFERROR(LET(ok,tblDepenses[supprime]<>1," & _
        "u,SORT(UNIQUE(FILTER(" & col & ",ok)))," & _
        "HSTACK(u,COUNTIFS(" & col & ",u,tblDepenses[supprime],""<>1"")," & _
        "SUMIFS(tblDepenses[montant]," & col & ",u,tblDepenses[supprime],""<>1""))),""-"")"
End Function

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

Private Sub Entete(ws As Worksheet, rng As Range, titres As Variant, ByVal fond As Long)
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
