Attribute VB_Name = "modHistorique"
' ============================================================
'  SUIVI E85 - Feuille HISTORIQUE (vue filtrable + export CSV)  v1.0.0.0
'  Etape 1/3 du dashboard miroir de l'app PWA (onglet Historique).
'
'  - Vue de GS_Pleins triee par date (recent -> ancien) sous forme
'    de tableau Excel (ListObject "tblHistorique") : le FILTRE AUTO
'    natif sur les colonnes Vehicule / Carburant reproduit les
'    filtres de l'app.
'  - Carte "5 derniers pleins".
'  - Boutons : Actualiser, Export (vue filtree), Export (tout),
'    Dupliquer le dernier, Accueil.
'  - Export CSV avec separateur ";" ou "," (Reglages) en UTF-8.
'
'  DEPENDANCES (non redefinies) :
'    SetStatus (ModuleImportGS) ; ReglageSeparateurCSV (modReglages) ;
'    NavAccueil + NouveauPlein (modWorkbook / modSaisie, tolerant).
'
'  USAGE :
'    CreerFeuilleHistorique   -> monte la feuille complete
'    RafraichirHistorique     -> recharge depuis GS_Pleins
' ============================================================
Option Explicit

Private Const WS_HIST As String = "Historique"
Private Const WS_DATA As String = "GS_Pleins"
Private Const TBL_NAME As String = "tblHistorique"
Private Const HDR_ROW As Long = 12          ' ligne d'en-tete du tableau complet

' Positions semantiques dans GS_Pleins (1-based)
Private Const COL_HORODATAGE As Long = 1
Private Const COL_DATE       As Long = 2
Private Const COL_TYPE       As Long = 3
Private Const COL_KM         As Long = 4
Private Const COL_LITRES     As Long = 5
Private Const COL_PRIX       As Long = 6
Private Const COL_STATION    As Long = 7
Private Const COL_VEHICULE   As Long = 8


' ════════════════════════════════════════════════════════════
'  POINT D'ENTREE
' ════════════════════════════════════════════════════════════
Public Sub CreerFeuilleHistorique()
    Dim ws As Worksheet
    Application.ScreenUpdating = False
    On Error GoTo ErrH

    Set ws = GetOrCreateSheet(WS_HIST)
    ws.Cells.Clear
    Dim shp As Shape
    For Each shp In ws.Shapes: shp.Delete: Next shp

    ws.Tab.Color = RGB(124, 58, 237)
    ws.Activate
    On Error Resume Next
    ActiveWindow.DisplayGridlines = False
    On Error GoTo ErrH
    ws.Columns("A").ColumnWidth = 2
    ws.Columns("B").ColumnWidth = 12
    ws.Columns("C").ColumnWidth = 16
    ws.Columns("D").ColumnWidth = 10
    ws.Columns("E").ColumnWidth = 9
    ws.Columns("F").ColumnWidth = 11
    ws.Columns("G").ColumnWidth = 11
    ws.Columns("H").ColumnWidth = 28
    ws.Columns("I").ColumnWidth = 18

    With ws.Range("B1")
        .Value = Emo(&H1F4DC&) & " Historique"
        .Font.Size = 18: .Font.Bold = True: .Font.Color = RGB(27, 58, 92)
    End With
    ws.Rows(1).RowHeight = 34

    CreateButtons ws
    RafraichirHistorique

    ws.Range("B1").Select
    GoTo Done
ErrH:
    SetStatus "[Historique] " & ChrW(9888) & " Erreur " & Err.Number & " : " & Err.Description
Done:
    Application.ScreenUpdating = True
End Sub


' ════════════════════════════════════════════════════════════
'  RAFRAICHISSEMENT (recharge depuis GS_Pleins)
' ════════════════════════════════════════════════════════════
Public Sub RafraichirHistorique()
    Dim ws As Worksheet, lo As ListObject
    Dim data As Variant, idx() As Long
    Dim n As Long, i As Long, src As Long, outR As Long

    Application.ScreenUpdating = False
    On Error GoTo ErrH

    Set ws = GetOrCreateSheet(WS_HIST)
    If ws.Shapes.Count = 0 Then CreateButtons ws
    If CStr(ws.Range("B1").Value) = "" Then ws.Range("B1").Value = Emo(&H1F4DC&) & " Historique"

    ' Supprime l'ancien tableau (sans toucher aux boutons : ce sont des formes)
    On Error Resume Next
    ws.ListObjects(TBL_NAME).Unlist
    On Error GoTo 0
    ws.Range("B3:Z9").Clear
    ws.Range("A11:Z" & ws.Rows.Count).Clear
    ' Demasque les lignes (un filtre precedent a pu en laisser de masquees apres Unlist)
    On Error Resume Next
    ws.Range("A" & HDR_ROW & ":A" & ws.Rows.Count).EntireRow.Hidden = False
    On Error GoTo 0

    Set lo = GetDataTable()
    If lo Is Nothing Then
        ' Message VISIBLE sur la feuille (la barre d'etat est masquee en plein ecran).
        ws.Range("B3").Value = "Donnees indisponibles : feuille '" & WS_DATA & "' ou son tableau introuvable." & _
                               " Lancez la synchronisation (Alt+F8 -> SyncManuel), puis cliquez Actualiser."
        ws.Range("B3").Font.Color = RGB(180, 60, 60): ws.Range("B3").Font.Bold = True
        SetStatus "[Historique] " & ChrW(9888) & " Feuille '" & WS_DATA & "' ou tableau introuvable."
        GoTo Done
    End If
    If lo.DataBodyRange Is Nothing Then
        ws.Range("B3").Value = "Aucun plein dans '" & WS_DATA & "'. Lancez la synchronisation (Alt+F8 -> SyncManuel)."
        ws.Range("B3").Font.Color = RGB(180, 60, 60): ws.Range("B3").Font.Bold = True
        SetStatus "[Historique] Aucune donnee."
        GoTo Done
    End If

    data = lo.DataBodyRange.Value
    n = UBound(data, 1)
    idx = BuildSortedIndex(data, n)

    ' ── En-tete du tableau complet (B12:I12) ──
    Dim hdr As Variant
    hdr = Array("Date", "Type", "Km", "Litres", "Prix EUR/L", "Cout EUR", "Station", "Vehicule")
    For i = 0 To 7
        ws.Cells(HDR_ROW, 2 + i).Value = hdr(i)
    Next i
    ws.Cells(11, 2).Value = "Tous les pleins (" & n & ")"
    ws.Cells(11, 2).Font.Bold = True
    ws.Cells(11, 2).Font.Color = RGB(27, 58, 92)

    ' ── Donnees (recent -> ancien) ──
    Dim outArr() As Variant
    ReDim outArr(1 To n, 1 To 8)
    For i = 1 To n
        src = idx(i)
        outArr(i, 1) = SafeDate(data(src, COL_DATE))
        outArr(i, 2) = CStr(data(src, COL_TYPE))
        outArr(i, 3) = SafeNum(data(src, COL_KM))
        outArr(i, 4) = SafeNum(data(src, COL_LITRES))
        outArr(i, 5) = SafeNum(data(src, COL_PRIX))
        outArr(i, 6) = CoutPlein(data(src, COL_LITRES), data(src, COL_PRIX))
        outArr(i, 7) = CStr(data(src, COL_STATION))
        outArr(i, 8) = CStr(data(src, COL_VEHICULE))
    Next i
    ws.Range(ws.Cells(HDR_ROW + 1, 2), ws.Cells(HDR_ROW + n, 9)).Value = outArr

    ' ── Cree le ListObject + mise en forme ──
    Set lo = ws.ListObjects.Add(xlSrcRange, _
        ws.Range(ws.Cells(HDR_ROW, 2), ws.Cells(HDR_ROW + n, 9)), , xlYes)
    lo.Name = TBL_NAME
    On Error Resume Next
    lo.TableStyle = "TableStyleMedium2"
    On Error GoTo 0
    FormatColonnes lo

    ' ── Carte "5 derniers pleins" ──
    RenderRecents ws, outArr, n

    SetStatus "[Historique] " & ChrW(10003) & " " & n & " pleins charges (filtre auto sur Vehicule / Carburant)."
    GoTo Done
ErrH:
    SetStatus "[Historique] " & ChrW(9888) & " Erreur " & Err.Number & " : " & Err.Description
Done:
    Application.ScreenUpdating = True
End Sub


' ════════════════════════════════════════════════════════════
'  EXPORT CSV
' ════════════════════════════════════════════════════════════
Public Sub HistoExportFiltre()
    ExportCSV True
End Sub

Public Sub HistoExportTout()
    ExportCSV False
End Sub

Private Sub ExportCSV(onlyVisible As Boolean)
    Dim ws As Worksheet, lo As ListObject, lr As ListRow
    Dim sep As String, decChar As String
    Dim contenu As String, nb As Long
    Dim fn As Variant

    On Error GoTo ErrH
    Set ws = ThisWorkbook.Sheets(WS_HIST)
    On Error Resume Next
    Set lo = ws.ListObjects(TBL_NAME)
    On Error GoTo ErrH
    If lo Is Nothing Then
        SetStatus "[Historique] " & ChrW(9888) & " Tableau introuvable - lancez Actualiser."
        Exit Sub
    End If

    sep = ReglageSeparateurCSV()
    decChar = IIf(sep = ";", ",", ".")

    ' En-tete
    contenu = JoinCsv(Array("Date", "Type", "Km", "Litres", "Prix EUR/L", "Cout EUR", "Station", "Vehicule"), sep) & vbCrLf

    If Not lo.DataBodyRange Is Nothing Then
        For Each lr In lo.ListRows
            If onlyVisible Then
                If lr.Range.EntireRow.Hidden Then GoTo NextRow
            End If
            contenu = contenu & CsvLine(lr, sep, decChar) & vbCrLf
            nb = nb + 1
NextRow:
        Next lr
    End If

    If nb = 0 Then
        SetStatus "[Historique] " & ChrW(9888) & " Aucune ligne a exporter (filtre trop restrictif ?)."
        Exit Sub
    End If

    fn = Application.GetSaveAsFilename( _
        InitialFileName:="historique_" & Format$(Now, "yyyymmdd_hhmmss") & ".csv", _
        FileFilter:="Fichier CSV (*.csv),*.csv")
    If VarType(fn) = vbBoolean Then If fn = False Then Exit Sub

    EcrireUtf8 CStr(fn), contenu

    SetStatus "[Historique] " & ChrW(10003) & " Export " & IIf(onlyVisible, "(vue filtree)", "(tout)") & _
              " : " & nb & " lignes -> " & CStr(fn)
    Exit Sub
ErrH:
    SetStatus "[Historique] " & ChrW(9888) & " Erreur export " & Err.Number & " : " & Err.Description
End Sub


' ════════════════════════════════════════════════════════════
'  AUTRES ACTIONS (boutons)
' ════════════════════════════════════════════════════════════
Public Sub HistoDupliquerDernier()
    ' Etape 1 : ouvre le formulaire de saisie (le pre-remplissage avec le
    ' dernier plein sera cable a l'etape "Saisie").
    On Error Resume Next
    Application.Run "NouveauPlein"
    If Err.Number <> 0 Then SetStatus "[Historique] " & ChrW(9888) & " Importez modSaisie.bas (NouveauPlein)."
    On Error GoTo 0
End Sub


' ════════════════════════════════════════════════════════════
'  HELPERS - DONNEES
' ════════════════════════════════════════════════════════════

' Index 1..n trie par date DECROISSANTE (recent d'abord). Cle = Horodatage,
' sinon Date. Tri par insertion (suffisant pour la volumetrie attendue).
Private Function BuildSortedIndex(data As Variant, n As Long) As Long()
    Dim idx() As Long, i As Long, j As Long, cur As Long
    ReDim idx(1 To Application.Max(n, 1))
    For i = 1 To n: idx(i) = i: Next i

    For i = 2 To n
        cur = idx(i)
        j = i - 1
        Do While j >= 1
            If KeyOf(data, idx(j)) >= KeyOf(data, cur) Then Exit Do
            idx(j + 1) = idx(j)
            j = j - 1
        Loop
        idx(j + 1) = cur
    Next i
    BuildSortedIndex = idx
End Function

Private Function KeyOf(data As Variant, r As Long) As Double
    If IsDate(data(r, COL_HORODATAGE)) Then
        KeyOf = CDbl(CDate(data(r, COL_HORODATAGE)))
    ElseIf IsDate(data(r, COL_DATE)) Then
        KeyOf = CDbl(CDate(data(r, COL_DATE)))
    Else
        KeyOf = 0
    End If
End Function

Private Function SafeDate(v As Variant) As Variant
    If IsDate(v) Then SafeDate = CDate(v) Else SafeDate = ""
End Function

Private Function SafeNum(v As Variant) As Variant
    If IsNumeric(v) Then SafeNum = CDbl(v) Else SafeNum = ""
End Function

Private Function CoutPlein(litres As Variant, prix As Variant) As Variant
    If IsNumeric(litres) And IsNumeric(prix) Then
        CoutPlein = CDbl(litres) * CDbl(prix)
    Else
        CoutPlein = ""
    End If
End Function


' ════════════════════════════════════════════════════════════
'  HELPERS - MISE EN FORME
' ════════════════════════════════════════════════════════════

Private Sub FormatColonnes(lo As ListObject)
    On Error Resume Next
    lo.ListColumns(1).DataBodyRange.NumberFormat = "dd/mm/yyyy"
    lo.ListColumns(3).DataBodyRange.NumberFormat = "#,##0"
    lo.ListColumns(4).DataBodyRange.NumberFormat = "0.00"
    lo.ListColumns(5).DataBodyRange.NumberFormat = "0.000"
    lo.ListColumns(6).DataBodyRange.NumberFormat = "0.00"
    lo.Range.Columns.HorizontalAlignment = xlCenter
    lo.ListColumns(7).Range.HorizontalAlignment = xlLeft
    On Error GoTo 0
End Sub

' Carte "5 derniers pleins" (rows 3..9).
Private Sub RenderRecents(ws As Worksheet, outArr As Variant, n As Long)
    ws.Cells(3, 2).Value = Emo(&H1F4C5&) & " 5 derniers pleins"
    ws.Cells(3, 2).Font.Bold = True
    ws.Cells(3, 2).Font.Color = RGB(27, 58, 92)

    Dim hdr As Variant
    hdr = Array("Date", "Type", "Km", "Litres", "Prix EUR/L", "Cout EUR", "Station", "Vehicule")
    Dim c As Long
    For c = 0 To 7
        With ws.Cells(4, 2 + c)
            .Value = hdr(c)
            .Font.Bold = True: .Font.Color = vbWhite
            .Interior.Color = RGB(46, 117, 182)
            .HorizontalAlignment = xlCenter
        End With
    Next c

    Dim k As Long, rr As Long
    For k = 1 To Application.Min(5, n)
        rr = 4 + k
        ws.Cells(rr, 2).Value = outArr(k, 1): ws.Cells(rr, 2).NumberFormat = "dd/mm/yyyy"
        ws.Cells(rr, 3).Value = outArr(k, 2)
        ws.Cells(rr, 4).Value = outArr(k, 3): ws.Cells(rr, 4).NumberFormat = "#,##0"
        ws.Cells(rr, 5).Value = outArr(k, 4): ws.Cells(rr, 5).NumberFormat = "0.00"
        ws.Cells(rr, 6).Value = outArr(k, 5): ws.Cells(rr, 6).NumberFormat = "0.000"
        ws.Cells(rr, 7).Value = outArr(k, 6): ws.Cells(rr, 7).NumberFormat = "0.00"
        ws.Cells(rr, 8).Value = outArr(k, 7)
        ws.Cells(rr, 9).Value = outArr(k, 8)
        ws.Range(ws.Cells(rr, 2), ws.Cells(rr, 9)).HorizontalAlignment = xlCenter
        ws.Cells(rr, 8).HorizontalAlignment = xlLeft
    Next k
End Sub

Private Sub CreateButtons(ws As Worksheet)
    Dim shp As Shape
    For Each shp In ws.Shapes
        If Left$(shp.Name, 7) = "btnHist" Then shp.Delete
    Next shp

    Dim L As Single: L = ws.Cells(3, 11).Left      ' colonne K
    Dim T As Single: T = ws.Cells(3, 2).Top
    AddButton ws, "btnHist1", L, T + 0, "Actualiser", "RafraichirHistorique", RGB(46, 117, 182)
    AddButton ws, "btnHist2", L, T + 30, "Export (vue filtree)", "HistoExportFiltre", RGB(29, 158, 117)
    AddButton ws, "btnHist3", L, T + 60, "Export (tout)", "HistoExportTout", RGB(29, 158, 117)
    AddButton ws, "btnHist4", L, T + 90, "Dupliquer le dernier", "HistoDupliquerDernier", RGB(217, 119, 6)
    AddButton ws, "btnHist5", L, T + 120, "Accueil", "NavAccueil", RGB(75, 85, 99)
End Sub

Private Sub AddButton(ws As Worksheet, nm As String, L As Single, T As Single, _
                      caption As String, macro As String, fill As Long)
    Dim sh As Shape
    Set sh = ws.Shapes.AddShape(msoShapeRoundedRectangle, L, T, 170, 26)
    sh.Name = nm
    With sh
        .Fill.ForeColor.RGB = fill
        .Line.Visible = msoFalse
        With .TextFrame2
            .TextRange.Text = caption
            .TextRange.Font.Fill.ForeColor.RGB = vbWhite
            .TextRange.Font.Bold = msoTrue
            .TextRange.Font.Size = 10
            .TextRange.ParagraphFormat.Alignment = msoAlignCenter
            .HorizontalAnchor = msoAnchorCenter
            .VerticalAnchor = msoAnchorMiddle
        End With
        .OnAction = macro
    End With
End Sub


' ════════════════════════════════════════════════════════════
'  HELPERS - CSV
' ════════════════════════════════════════════════════════════

Private Function CsvLine(lr As ListRow, sep As String, decChar As String) As String
    Dim cel As Range
    Set cel = lr.Range
    Dim parts(0 To 7) As String
    parts(0) = IIf(IsDate(cel.Cells(1, 1).Value), Format$(cel.Cells(1, 1).Value, "dd/mm/yyyy"), "")
    parts(1) = CsvTxt(CStr(cel.Cells(1, 2).Value), sep)
    parts(2) = FmtNum(cel.Cells(1, 3).Value, 0, decChar)
    parts(3) = FmtNum(cel.Cells(1, 4).Value, 2, decChar)
    parts(4) = FmtNum(cel.Cells(1, 5).Value, 3, decChar)
    parts(5) = FmtNum(cel.Cells(1, 6).Value, 2, decChar)
    parts(6) = CsvTxt(CStr(cel.Cells(1, 7).Value), sep)
    parts(7) = CsvTxt(CStr(cel.Cells(1, 8).Value), sep)
    CsvLine = Join(parts, sep)
End Function

Private Function JoinCsv(arr As Variant, sep As String) As String
    Dim i As Long, s As String
    For i = LBound(arr) To UBound(arr)
        If i > LBound(arr) Then s = s & sep
        s = s & CsvTxt(CStr(arr(i)), sep)
    Next i
    JoinCsv = s
End Function

' Echappe un champ texte (guillemets si separateur / guillemet / saut de ligne).
Private Function CsvTxt(s As String, sep As String) As String
    If InStr(s, sep) > 0 Or InStr(s, """") > 0 Or InStr(s, vbLf) > 0 Or InStr(s, vbCr) > 0 Then
        CsvTxt = """" & Replace(s, """", """""") & """"
    Else
        CsvTxt = s
    End If
End Function

' Formate un nombre de maniere DETERMINISTE (independant de la locale) :
' decChar = "," (si separateur ";") ou "." (si separateur ",").
Private Function FmtNum(v As Variant, dec As Integer, decChar As String) As String
    If Not IsNumeric(v) Then Exit Function
    Dim x As Double: x = CDbl(v)
    Dim neg As Boolean: neg = (x < 0)
    x = Abs(x)
    Dim scaled As Double: scaled = Round(x, dec)
    Dim ip As Double: ip = Int(scaled)
    Dim s As String
    s = Format$(ip, "0")
    If dec > 0 Then
        Dim frac As Double: frac = scaled - ip
        Dim fracInt As Double: fracInt = Int(frac * (10 ^ dec) + 0.5)
        s = s & decChar & Right$(String(dec, "0") & Format$(fracInt, "0"), dec)
    End If
    If neg Then s = "-" & s
    FmtNum = s
End Function

' Ecrit un fichier texte en UTF-8 (avec repli ANSI si ADODB indisponible).
Private Sub EcrireUtf8(path As String, contenu As String)
    On Error GoTo Fallback
    Dim st As Object
    Set st = CreateObject("ADODB.Stream")
    st.Type = 2                  ' adTypeText
    st.Charset = "utf-8"
    st.Open
    st.WriteText contenu
    st.SaveToFile path, 2        ' adSaveCreateOverWrite
    st.Close
    Set st = Nothing
    Exit Sub
Fallback:
    Dim f As Integer: f = FreeFile
    Open path For Output As #f
    Print #f, contenu;
    Close #f
End Sub


' ════════════════════════════════════════════════════════════
'  HELPERS - COMMUNS
' ════════════════════════════════════════════════════════════

Private Function GetDataTable() As ListObject
    Dim dataWs As Worksheet
    On Error Resume Next
    Set dataWs = ThisWorkbook.Sheets(WS_DATA)
    On Error GoTo 0
    If dataWs Is Nothing Then Exit Function
    If dataWs.ListObjects.Count = 0 Then Exit Function
    Set GetDataTable = dataWs.ListObjects(1)
End Function

Private Function GetOrCreateSheet(nm As String) As Worksheet
    Dim ws As Worksheet
    On Error Resume Next
    Set ws = ThisWorkbook.Sheets(nm)
    On Error GoTo 0
    If ws Is Nothing Then
        Set ws = ThisWorkbook.Sheets.Add(After:=ThisWorkbook.Sheets(ThisWorkbook.Sheets.Count))
        On Error Resume Next
        ws.Name = nm
        ' Si le renommage echoue (nom deja pris par une feuille existante) :
        ' supprime l'orpheline cree par Add (evite une "Feuil#" vide non renommee)
        ' et reutilise la feuille existante.
        If ws.Name <> nm Then
            Application.DisplayAlerts = False
            ws.Delete
            Application.DisplayAlerts = True
            Set ws = ThisWorkbook.Sheets(nm)
        End If
        On Error GoTo 0
    End If
    Set GetOrCreateSheet = ws
End Function

Private Function Emo(ByVal cp As Long) As String
    If cp <= &HFFFF& Then
        Emo = ChrW(cp)
    Else
        Dim v As Long: v = cp - &H10000
        Emo = ChrW(&HD800& Or (v \ &H400&)) & ChrW(&HDC00& Or (v And &H3FF&))
    End If
End Function
