Attribute VB_Name = "General"
Sub OuvrirFormulairePlein()
    frmNouveauPlein.Show
End Sub

' ---------------------------------------------------------------
' Ajoute une station dans tbl_stationEssence si elle est inconnue,
' puis trie le tableau par ordre alphabétique.
' ---------------------------------------------------------------
Sub AjouterStationSiInconnue(nomStation As String)
    Dim wsNotes     As Worksheet
    Dim tblStation  As ListObject
    Dim cell        As Range
    Dim trouve      As Boolean

    ' Accès à la feuille Notes
    On Error Resume Next
    Set wsNotes = ThisWorkbook.Sheets("Notes")
    On Error GoTo 0
    If wsNotes Is Nothing Then
        MsgBox "Feuille 'Notes' introuvable.", vbExclamation
        Exit Sub
    End If

    ' Accès au tableau tbl_stationEssence
    On Error Resume Next
    Set tblStation = wsNotes.ListObjects("tbl_stationEssence")
    On Error GoTo 0
    If tblStation Is Nothing Then
        MsgBox "Tableau 'tbl_stationEssence' introuvable.", vbExclamation
        Exit Sub
    End If

    ' Vérifie si la station existe déjà (insensible à la casse)
    trouve = False
    If Not tblStation.DataBodyRange Is Nothing Then
        For Each cell In tblStation.DataBodyRange
            If LCase(Trim(cell.value)) = LCase(nomStation) Then
                trouve = True
                Exit For
            End If
        Next cell
    End If

    If trouve Then Exit Sub  ' Déjà connue ? rien à faire

    ' Ajoute la nouvelle station
    Dim nouvelleRow As ListRow
    Set nouvelleRow = tblStation.ListRows.Add
    nouvelleRow.Range(1).value = nomStation

    ' Trie le tableau alphabétiquement
    TrierStationsAlpha tblStation

    ' Feedback discret dans la barre d'état
    Application.StatusBar = "? Station « " & nomStation & " » ajoutée et triée."

    ' Efface le message après 3 secondes
    Application.OnTime now + TimeValue("00:00:03"), "EffacerStatusBar"
End Sub

' ---------------------------------------------------------------
Private Sub TrierStationsAlpha(tbl As ListObject)
    If tbl.DataBodyRange Is Nothing Then Exit Sub

    Dim rng As Range
    Set rng = tbl.DataBodyRange.Columns(1)
    Dim n As Long
    n = rng.rows.count

    ' Charge toutes les valeurs en mémoire
    Dim vals() As String
    ReDim vals(1 To n)
    Dim i As Long
    For i = 1 To n
        vals(i) = CStr(rng.Cells(i, 1).value)
    Next i

    ' Tri à bulles insensible à la casse
    Dim j As Long, tmp As String
    For i = 1 To n - 1
        For j = 1 To n - i
            If LCase(vals(j)) > LCase(vals(j + 1)) Then
                tmp = vals(j)
                vals(j) = vals(j + 1)
                vals(j + 1) = tmp
            End If
        Next j
    Next i

    ' Réécrit uniquement les valeurs, sans toucher au formatage ni aux validations
    Application.EnableEvents = False
    For i = 1 To n
        rng.Cells(i, 1).value = vals(i)
    Next i
    Application.EnableEvents = True
End Sub

' ---------------------------------------------------------------
Public Sub EffacerStatusBar()
    Application.StatusBar = False
End Sub

Sub SyncStationsGoogleForm()
    Const WEB_APP_URL As String = "https://script.google.com/macros/s/AKfycbyXzMUh2CSHPX_I07CRFJ3DNYlDN-XFevDmYZz8_gqhGPhVzYOh7gKrLAEkd7JU9lQ-tw/exec"

    Dim ws As Worksheet
    Set ws = ThisWorkbook.Sheets("Notes")

    Dim stations() As String
    Dim count As Integer
    count = 0

    Dim i As Integer
    For i = 3 To 22
        Dim val As String
        val = Trim(CStr(ws.Cells(i, 4).value))
        If val <> "" Then
            ReDim Preserve stations(count)
            stations(count) = val
            count = count + 1
        End If
    Next i

    If count = 0 Then Exit Sub

    Dim json As String
    json = "{""stations"":["
    For i = 0 To count - 1
        json = json & """" & Replace(stations(i), """", "\""") & """"
        If i < count - 1 Then json = json & ","
    Next i
    json = json & "]}"

    Dim http As Object
    Set http = CreateObject("WinHttp.WinHttpRequest.5.1")
    On Error GoTo ErrHTTP
    http.Option(6) = True
    http.Open "POST", WEB_APP_URL, False
    http.setRequestHeader "Content-Type", "application/json"
    http.Send json
    Exit Sub
ErrHTTP:
    ' Sync silencieuse — échec ignoré pour ne pas bloquer la saisie
End Sub

