Attribute VB_Name = "modPrixStation"
' ============================================================
'  SUIVI CONSO CARBURANTS — Feuille « Prix pr station »        v4.9.0.0
'
'  X31 : la feuille « Prix pr station » n'affiche plus les prix tires des
'  pleins (anciennes formules manuelles) mais le DERNIER prix MARCHE releve
'  par couple Station + Carburant, lu dans la table Power Query « PrixHistory »
'  (miroir de l'onglet _PrixHistory du Google Sheet, releve quotidien ~7h via
'  RefreshPrix.gs).
'
'  Structure source PrixHistory : Station | Date | Type | Prix.
'  Sortie : tableau pivot Station (lignes) x Carburant (colonnes) = dernier
'  prix (max Date), + colonne « Maj le » (date du dernier releve de la station).
'
'  ⚠️ NON DESTRUCTIF SUR TES FORMULES : la macro ecrit son tableau a partir de
'     A1 de la feuille « Prix pr station ». Avant la 1re execution, vide les
'     anciennes formules manuelles de cette zone (ou laisse la macro ecraser
'     la plage qu'elle gere : colonnes A.. jusqu'au dernier carburant + 1).
'
'  Point d'entree : MAJ_PrixParStation (rejouable + bouton).
'  Prefere les messages en barre d'etat (pas de MsgBox) — cf. preference projet.
' ============================================================
Option Explicit

Private Const WS_PRIX   As String = "Prix par Station"
Private Const PH_TABLE  As String = "PrixHistory"

' Charte (miroir css/style.css de l'app) — Long = RGB
Private Const C_HEADER  As Long = 6044187    ' bleu fonce #1B3A5C
Private Const C_WHITE   As Long = 16777215
Private Const C_BORDER  As Long = 15261910   ' #D6DEE8
Private Const C_ZEBRA   As Long = 16250098   ' #F2F5F8

' Ordre d'affichage prefere des carburants (les autres suivent, tries).
Private Function FuelOrder() As Variant
    FuelOrder = Array("E85", "SP98", "GAZOLE", "SP95", "E10", "GPL")
End Function

'------------------------------------------------------------
'  POINT D'ENTREE
'------------------------------------------------------------
Public Sub MAJ_PrixParStation()
    Dim lo As ListObject, ws As Worksheet
    Dim a As Variant
    Dim ciStation As Long, ciDate As Long, ciType As Long, ciPrix As Long
    Dim i As Long, n As Long

    On Error GoTo EH
    Application.ScreenUpdating = False
    SetStatusP "Prix pr station : lecture de PrixHistory..."

    Set lo = FindListObject(PH_TABLE)
    If lo Is Nothing Then
        SetStatusP "[Prix station] " & ChrW(9888) & " Table '" & PH_TABLE & _
                   "' introuvable (importer powerquery\PrixHistory.m)."
        GoTo Clean
    End If
    If lo.DataBodyRange Is Nothing Then
        SetStatusP "[Prix station] Table '" & PH_TABLE & "' vide."
        GoTo Clean
    End If

    ciStation = LCIdxP(lo, "Station")
    ciDate = LCIdxP(lo, "Date")
    ciType = LCIdxP(lo, "Type")
    ciPrix = LCIdxP(lo, "Prix")
    If ciPrix = 0 Then ciPrix = LCIdxP(lo, "Prix " & ChrW(8364) & "/L")
    If ciStation = 0 Or ciDate = 0 Or ciType = 0 Or ciPrix = 0 Then
        SetStatusP "[Prix station] " & ChrW(9888) & " Colonnes Station/Date/Type/Prix absentes."
        GoTo Clean
    End If

    a = lo.DataBodyRange.Value
    n = UBound(a, 1)

    ' -- Agregation : dernier prix par Station+Type (max Date) --
    Dim prixCell As Object, dateCell As Object        ' cle "Station|Type"
    Dim staMaj As Object                              ' cle "Station" -> max Date
    Dim staSet As Object, fuelSet As Object           ' ensembles ordonnes
    Set prixCell = CreateObject("Scripting.Dictionary")
    Set dateCell = CreateObject("Scripting.Dictionary")
    Set staMaj = CreateObject("Scripting.Dictionary")
    Set staSet = CreateObject("Scripting.Dictionary")
    Set fuelSet = CreateObject("Scripting.Dictionary")

    For i = 1 To n
        Dim sta As String: sta = Trim$(CStr(a(i, ciStation)))
        Dim fk As String: fk = FuelKeyP(CStr(a(i, ciType)))
        Dim p As Double: p = NumP(a(i, ciPrix))
        If Len(sta) = 0 Or Len(fk) = 0 Or p <= 0 Then GoTo NextRow
        If Not IsDate(a(i, ciDate)) Then GoTo NextRow
        Dim dt As Date: dt = CDate(a(i, ciDate))

        Dim key As String: key = sta & "|" & fk
        If Not dateCell.Exists(key) Then
            dateCell(key) = dt: prixCell(key) = p
        ElseIf dt >= dateCell(key) Then
            dateCell(key) = dt: prixCell(key) = p   ' dernier releve gagne
        End If

        If Not staSet.Exists(sta) Then staSet(sta) = staSet.count
        If Not fuelSet.Exists(fk) Then fuelSet(fk) = True
        If Not staMaj.Exists(sta) Then
            staMaj(sta) = dt
        ElseIf dt > staMaj(sta) Then
            staMaj(sta) = dt
        End If
NextRow:
    Next i

    If staSet.count = 0 Then
        SetStatusP "[Prix station] Aucun prix exploitable dans PrixHistory."
        GoTo Clean
    End If

    ' -- Ordre des carburants : preferes presents d'abord, puis le reste trie --
    Dim fuels() As String: fuels = OrderedFuels(fuelSet)

    ' -- Ordre des stations : alphabetique --
    Dim stations() As String, idx As Long: idx = 0
    ReDim stations(0 To staSet.count - 1)
    Dim k As Variant
    For Each k In staSet.keys
        stations(idx) = CStr(k): idx = idx + 1
    Next k
    TriStrP stations

    ' -- Feuille cible --
    Set ws = SheetByNameP(WS_PRIX)
    If ws Is Nothing Then
        Set ws = ThisWorkbook.Worksheets.Add(After:=ThisWorkbook.Sheets(ThisWorkbook.Sheets.count))
        ws.Name = WS_PRIX
    End If

    SetStatusP "Prix pr station : ecriture du tableau..."
    Dim nFuel As Long: nFuel = UBound(fuels) + 1
    Dim lastCol As Long: lastCol = 2 + nFuel    ' A=Station, B..=carburants, +1 = Maj le
    Dim lastRow As Long: lastRow = 1 + UBound(stations) + 1

    ' Nettoie la plage geree (A1 : lastCol x lastRow large) avant reecriture.
    ws.Range(ws.Cells(1, 1), ws.Cells(ws.Rows.count, lastCol)).Clear

    ' En-tetes
    ws.Cells(1, 1).Value = "Station"
    Dim c As Long
    For c = 0 To nFuel - 1
        ws.Cells(1, 2 + c).Value = fuels(c) & " (" & ChrW(8364) & "/L)"
    Next c
    ws.Cells(1, lastCol).Value = "Maj le"

    ' Lignes
    Dim r As Long
    For r = 0 To UBound(stations)
        Dim staName As String: staName = stations(r)
        ws.Cells(r + 2, 1).Value = staName
        For c = 0 To nFuel - 1
            Dim key2 As String: key2 = staName & "|" & fuels(c)
            If prixCell.Exists(key2) Then ws.Cells(r + 2, 2 + c).Value = prixCell(key2)
        Next c
        If staMaj.Exists(staName) Then ws.Cells(r + 2, lastCol).Value = staMaj(staName)
    Next r

    StylePrixTable ws, lastRow, lastCol, nFuel

    Application.ScreenUpdating = True
    SetStatusP "Prix pr station : " & ChrW(10003) & " " & staSet.count & _
               " station(s), " & nFuel & " carburant(s) (" & Format(Now, "hh:mm") & ")."
    Exit Sub

Clean:
    Application.ScreenUpdating = True
    Exit Sub
EH:
    Application.ScreenUpdating = True
    SetStatusP "[Prix station] " & ChrW(9888) & " Erreur " & Err.Number & " : " & Err.Description
End Sub

'------------------------------------------------------------
'  Mise en forme du tableau
'------------------------------------------------------------
Private Sub StylePrixTable(ws As Worksheet, lastRow As Long, lastCol As Long, nFuel As Long)
    On Error Resume Next
    Dim hdr As Range: Set hdr = ws.Range(ws.Cells(1, 1), ws.Cells(1, lastCol))
    With hdr
        .Interior.color = C_HEADER
        .Font.color = C_WHITE
        .Font.bold = True
        .Font.Name = "Segoe UI"
        .Font.Size = 10
        .HorizontalAlignment = xlCenter
    End With
    ws.Cells(1, 1).HorizontalAlignment = xlLeft

    Dim body As Range
    Set body = ws.Range(ws.Cells(2, 1), ws.Cells(lastRow, lastCol))
    With body
        .Font.Name = "Segoe UI"
        .Font.Size = 10
        .Borders.LineStyle = xlContinuous
        .Borders.color = C_BORDER
        .Borders.Weight = xlThin
    End With

    ' Zebra + formats
    Dim r As Long
    For r = 2 To lastRow
        If (r Mod 2) = 0 Then
            ws.Range(ws.Cells(r, 1), ws.Cells(r, lastCol)).Interior.color = C_ZEBRA
        End If
    Next r
    ' Prix : 3 decimales ; colonnes B.. (nFuel colonnes)
    ws.Range(ws.Cells(2, 2), ws.Cells(lastRow, 1 + nFuel)).NumberFormat = "0.000"
    ws.Range(ws.Cells(2, 2), ws.Cells(lastRow, 1 + nFuel)).HorizontalAlignment = xlCenter
    ' Maj le : date
    ws.Range(ws.Cells(2, lastCol), ws.Cells(lastRow, lastCol)).NumberFormat = "dd/mm/yyyy"
    ws.Range(ws.Cells(2, lastCol), ws.Cells(lastRow, lastCol)).HorizontalAlignment = xlCenter

    ws.Columns(1).ColumnWidth = 32
    Dim c As Long
    For c = 2 To lastCol
        ws.Columns(c).ColumnWidth = 13
    Next c
    ws.Rows(1).RowHeight = 22
    On Error GoTo 0
End Sub

'------------------------------------------------------------
'  Helpers (module autonome)
'------------------------------------------------------------
Private Function OrderedFuels(fuelSet As Object) As String()
    Dim pref As Variant: pref = FuelOrder()
    Dim out() As String, cnt As Long: cnt = 0
    ReDim out(0 To fuelSet.count - 1)
    Dim seen As Object: Set seen = CreateObject("Scripting.Dictionary")

    Dim i As Long
    For i = LBound(pref) To UBound(pref)
        If fuelSet.Exists(CStr(pref(i))) Then
            out(cnt) = CStr(pref(i)): cnt = cnt + 1
            seen(CStr(pref(i))) = True
        End If
    Next i
    ' Carburants restants (non prevus) tries alpha
    Dim rest() As String, nr As Long: nr = 0
    ReDim rest(0 To fuelSet.count - 1)
    Dim k As Variant
    For Each k In fuelSet.keys
        If Not seen.Exists(CStr(k)) Then rest(nr) = CStr(k): nr = nr + 1
    Next k
    If nr > 0 Then
        ReDim Preserve rest(0 To nr - 1)
        TriStrP rest
        For i = 0 To nr - 1
            out(cnt) = rest(i): cnt = cnt + 1
        Next i
    End If
    ReDim Preserve out(0 To cnt - 1)
    OrderedFuels = out
End Function

Private Function FindListObject(nm As String) As ListObject
    Dim ws As Worksheet, lo As ListObject
    For Each ws In ThisWorkbook.Worksheets
        For Each lo In ws.ListObjects
            If LCase$(Trim$(lo.Name)) = LCase$(Trim$(nm)) Then
                Set FindListObject = lo
                Exit Function
            End If
        Next lo
    Next ws
    Set FindListObject = Nothing
End Function

Private Function SheetByNameP(nm As String) As Worksheet
    On Error Resume Next
    Set SheetByNameP = ThisWorkbook.Worksheets(nm)
    On Error GoTo 0
End Function

Private Function LCIdxP(lo As ListObject, nm As String) As Long
    Dim c As ListColumn
    LCIdxP = 0
    For Each c In lo.ListColumns
        If LCase$(Trim$(c.Name)) = LCase$(Trim$(nm)) Then
            LCIdxP = c.Index
            Exit Function
        End If
    Next c
End Function

Private Function NumP(v As Variant) As Double
    On Error Resume Next
    If IsNumeric(v) Then NumP = CDbl(v) Else NumP = 0
    On Error GoTo 0
End Function

Private Function FuelKeyP(t As String) As String
    Dim s As String: s = LCase$(Trim$(t))
    If InStr(s, "e85") > 0 Then FuelKeyP = "E85": Exit Function
    If InStr(s, "gazole") > 0 Or InStr(s, "diesel") > 0 Then FuelKeyP = "GAZOLE": Exit Function
    If InStr(s, "sp98") > 0 Or InStr(s, "s98") > 0 Then FuelKeyP = "SP98": Exit Function
    If InStr(s, "sp95") > 0 Or InStr(s, "e10") > 0 Then FuelKeyP = "SP95": Exit Function
    If InStr(s, "gpl") > 0 Then FuelKeyP = "GPL": Exit Function
    FuelKeyP = UCase$(s)
End Function

Private Sub TriStrP(arr() As String)
    Dim i As Long, j As Long, tmp As String
    For i = LBound(arr) To UBound(arr) - 1
        For j = i + 1 To UBound(arr)
            If arr(j) < arr(i) Then
                tmp = arr(i): arr(i) = arr(j): arr(j) = tmp
            End If
        Next j
    Next i
End Sub

Private Sub SetStatusP(msg As String)
    Application.StatusBar = msg
    DoEvents
End Sub
