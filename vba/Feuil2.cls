VERSION 1.0 CLASS
BEGIN
  MultiUse = -1  'True
END
Attribute VB_Name = "Feuil2"
Attribute VB_GlobalNameSpace = False
Attribute VB_Creatable = False
Attribute VB_PredeclaredId = True
Attribute VB_Exposed = True
Option Explicit

Private Sub Worksheet_Change(ByVal target As Range)
    Dim tbl         As ListObject
    Dim colIndex    As Long
    Dim rngIntersect As Range
    Dim cell        As Range

    ' Récupère Tableau2
    On Error Resume Next
    Set tbl = Me.ListObjects("Tableau2")
    On Error GoTo 0
    If tbl Is Nothing Then Exit Sub

    ' Trouve l'index de la colonne "Station essence"
    colIndex = 0
    Dim i As Long
    For i = 1 To tbl.ListColumns.count
        If tbl.ListColumns(i).name = "Station essence" Then
            colIndex = i
            Exit For
        End If
    Next i
    If colIndex = 0 Then Exit Sub

    ' Vérifie que la modification est dans la colonne Station essence
    If tbl.DataBodyRange Is Nothing Then Exit Sub
    Set rngIntersect = Intersect(target, tbl.DataBodyRange.Columns(colIndex))
    If rngIntersect Is Nothing Then Exit Sub

    ' Pour chaque cellule modifiée dans cette colonne
    Application.EnableEvents = False
    On Error GoTo Cleanup
    For Each cell In rngIntersect
        Dim nomStation As String
        nomStation = Trim(cell.value)
        If nomStation <> "" Then
            Call AjouterStationSiInconnue(nomStation)
        End If
    Next cell

Cleanup:
    Application.EnableEvents = True
End Sub

Private Sub Worksheet_Activate()
    ' X41 : un echec d import (reseau/GAS) ne doit jamais bloquer la navigation.
    On Error Resume Next
    Call ImporterNouveauxPleinsAuto
    On Error GoTo 0
End Sub

Sub AjouterLignePlein()
    Dim tbl As ListObject
    Dim nouvelleLigne As ListRow
    Set tbl = ThisWorkbook.Worksheets("Suivi Carburant").ListObjects("Tableau2")
    Set nouvelleLigne = tbl.ListRows.Add
    nouvelleLigne.Range.Cells(1, 2).Select  ' positionne sur la colonne Date
End Sub
