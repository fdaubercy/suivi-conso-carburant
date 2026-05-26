' ============================================================
'  A COLLER dans le module de la feuille "GS_Pleins"
'  Explorateur VBA -> Microsoft Excel Objects -> GS_Pleins
'  (double-clic, puis coller tout ce code)
'
'  Suivi E85 -- v2.9.0.0
'
'  [F1] Auto sync_id a la saisie         col O (15)
'  [F2] Marquage modification locale     col P (16) -- pour sync bidir.
'  [F3] Validation km                    warning si < dernier km vehicule
'  [F4] Detection doublons               warning si date+km+litres identiques
' ============================================================
Option Explicit

' Indices colonnes 1-based -- coherent avec modSyncGS.bas
Private Const COL_DATE     As Integer = 2   ' B
Private Const COL_KM       As Integer = 4   ' D
Private Const COL_LITRES   As Integer = 5   ' E
Private Const COL_VEHICULE As Integer = 8   ' H
Private Const COL_SYNC_ID  As Integer = 15  ' O
Private Const COL_MODIFIED As Integer = 16  ' P  timestamp modif locale


' ============================================================
'  EVENEMENT : modification d'une cellule
' ============================================================
Private Sub Worksheet_Change(ByVal Target As Range)
    ' Restreindre aux colonnes de donnees A:N (1-14)
    ' -- ignore toute ecriture sur O:P (cols internes 15-16)
    Dim dataArea As Range
    On Error Resume Next
    Set dataArea = Intersect(Target, Me.Columns("A:N"))
    On Error GoTo 0
    If dataArea Is Nothing Then Exit Sub

    ' Ignorer la ligne d'en-tete
    On Error Resume Next
    Set dataArea = Intersect(dataArea, Me.Rows("2:" & Me.Rows.Count))
    On Error GoTo 0
    If dataArea Is Nothing Then Exit Sub

    Application.EnableEvents = False
    On Error GoTo Cleanup

    ' -- Collecter les lignes touchees (evite les doublons si plage multi-cellules)
    Dim rowDict As Object
    Set rowDict = CreateObject("Scripting.Dictionary")
    Dim cell As Range
    For Each cell In dataArea
        rowDict(cell.Row) = True
    Next cell

    ' -- [F1] + [F2] : sync_id auto + marquage dirty pour chaque ligne modifiee
    Dim key As Variant
    For Each key In rowDict.Keys
        Dim r As Long: r = CLng(key)
        If IsRowMeaningful(Me, r) Then
            AutoGenSyncId Me, r                         ' [F1]
            Me.Cells(r, COL_MODIFIED).Value = Now()     ' [F2]
        End If
    Next key

    ' -- [F3] : validation km (saisie unique sur col D seulement)
    If dataArea.Count = 1 And dataArea.Column = COL_KM Then
        ValidateKm Me, dataArea.Row
    End If

    ' -- [F4] : detection doublons (saisie unique sur B, D ou E)
    If dataArea.Count = 1 Then
        Select Case dataArea.Column
            Case COL_DATE, COL_KM, COL_LITRES
                CheckDuplicate Me, dataArea.Row
        End Select
    End If

Cleanup:
    Application.EnableEvents = True
End Sub


' ============================================================
'  [F1] AUTO SYNC_ID
'  Genere un UUID en col O si absent -- appelle GenerateUUID()
'  defini dans modSyncGS.bas (meme projet VBA)
' ============================================================
Private Sub AutoGenSyncId(ws As Worksheet, r As Long)
    If CStr(ws.Cells(r, COL_SYNC_ID).Value) <> "" Then Exit Sub
    ws.Cells(r, COL_SYNC_ID).Value = GenerateUUID()
End Sub


' ============================================================
'  [F3] VALIDATION KILOMETRAGE
'  Warning si km saisi < max km enregistre pour le meme vehicule
' ============================================================
Private Sub ValidateKm(ws As Worksheet, r As Long)
    If Not IsNumeric(ws.Cells(r, COL_KM).Value) Then Exit Sub
    Dim kmNew As Double: kmNew = CDbl(ws.Cells(r, COL_KM).Value)
    If kmNew <= 0 Then Exit Sub

    Dim vehicule As String
    vehicule = Trim(CStr(ws.Cells(r, COL_VEHICULE).Value))

    Dim lastRow As Long
    lastRow = ws.Cells(ws.Rows.Count, 1).End(xlUp).Row

    Dim maxKm  As Double: maxKm  = 0
    Dim maxRow As Long:   maxRow = 0
    Dim i As Long

    For i = 2 To lastRow
        If i <> r Then
            Dim rowVeh As String
            rowVeh = Trim(CStr(ws.Cells(i, COL_VEHICULE).Value))
            ' Comparer le vehicule si renseigne des deux cotes
            ' Si l'un des deux est vide : on compare quand meme (vehicule non saisi)
            If vehicule = "" Or rowVeh = "" Or rowVeh = vehicule Then
                If IsNumeric(ws.Cells(i, COL_KM).Value) Then
                    Dim km As Double: km = CDbl(ws.Cells(i, COL_KM).Value)
                    If km > maxKm Then maxKm = km: maxRow = i
                End If
            End If
        End If
    Next i

    If maxKm > 0 And kmNew < maxKm Then
        MsgBox ChrW(9888) & "  Km inferieur au dernier enregistrement" & vbNewLine & vbNewLine & _
               "  Saisi   : " & Format(kmNew, "#,##0") & " km" & vbNewLine & _
               "  Dernier : " & Format(maxKm, "#,##0") & " km  (ligne " & maxRow & ")" & vbNewLine & vbNewLine & _
               "Verifiez la valeur avant de continuer.", _
               vbExclamation, "Suivi E85 -- Validation km"
    End If
End Sub


' ============================================================
'  [F4] DETECTION DOUBLONS
'  Cles de comparaison : Date (yyyy-mm-dd) + Km (entier) + Litres (centilitres)
' ============================================================
Private Sub CheckDuplicate(ws As Worksheet, r As Long)
    On Error GoTo ExitSub

    ' Normaliser les 3 cles du plein courant
    Dim refDate As String
    Dim refKm   As Long    ' km entier
    Dim refLit  As Long    ' litres * 100  (centilitres, evite flottant)

    If IsDate(ws.Cells(r, COL_DATE).Value) Then
        refDate = Format(CDate(ws.Cells(r, COL_DATE).Value), "yyyy-mm-dd")
    End If
    If IsNumeric(ws.Cells(r, COL_KM).Value) Then
        refKm = CLng(ws.Cells(r, COL_KM).Value)
    End If
    If IsNumeric(ws.Cells(r, COL_LITRES).Value) Then
        refLit = CLng(CDbl(ws.Cells(r, COL_LITRES).Value) * 100)
    End If

    ' Tester seulement si les 3 champs sont remplis
    If refDate = "" Or refKm = 0 Or refLit = 0 Then Exit Sub

    Dim lastRow As Long
    lastRow = ws.Cells(ws.Rows.Count, 1).End(xlUp).Row
    Dim i As Long

    For i = 2 To lastRow
        If i <> r Then
            Dim iDate As String: iDate = ""
            Dim iKm   As Long:   iKm   = 0
            Dim iLit  As Long:   iLit  = 0

            On Error Resume Next
            If IsDate(ws.Cells(i, COL_DATE).Value) Then
                iDate = Format(CDate(ws.Cells(i, COL_DATE).Value), "yyyy-mm-dd")
            End If
            If IsNumeric(ws.Cells(i, COL_KM).Value) Then
                iKm = CLng(ws.Cells(i, COL_KM).Value)
            End If
            If IsNumeric(ws.Cells(i, COL_LITRES).Value) Then
                iLit = CLng(CDbl(ws.Cells(i, COL_LITRES).Value) * 100)
            End If
            On Error GoTo ExitSub

            If iDate = refDate And iKm = refKm And iLit = refLit Then
                MsgBox ChrW(9888) & "  Doublon detecte !" & vbNewLine & vbNewLine & _
                       "La ligne " & i & " a les memes Date / Km / Litres :" & vbNewLine & _
                       "  Date   : " & refDate & vbNewLine & _
                       "  Km     : " & Format(refKm, "#,##0") & " km" & vbNewLine & _
                       "  Litres : " & Format(refLit / 100, "0.00") & " L" & vbNewLine & vbNewLine & _
                       "Confirmez si c'est intentionnel.", _
                       vbExclamation, "Suivi E85 -- Doublon"
                Exit For
            End If
        End If
    Next i

ExitSub:
    On Error GoTo 0
End Sub


' ============================================================
'  HELPER
' ============================================================
' Ligne "active" = Date OU Km renseigne
Private Function IsRowMeaningful(ws As Worksheet, r As Long) As Boolean
    IsRowMeaningful = (ws.Cells(r, COL_DATE).Value <> "" Or _
                       ws.Cells(r, COL_KM).Value  <> "")
End Function
