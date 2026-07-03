Attribute VB_Name = "modGraphChrome"
' ============================================================
'  modGraphChrome - Chrome du dashboard (X44 P4)
' ============================================================
'  Bloc parametres + bandeau + boutons image, extraits de
'  modGraphRender. Config via modGraphCfg ; StyleShape (Public)
'  via modGraphRender. Public : EnsureParamBlock/HeaderBand/Buttons
'  appeles par l'orchestrateur (modGraphiques).
Option Explicit

Public Sub EnsureParamBlock(ws As Worksheet)
    On Error Resume Next
    ' Largeurs pour que le bloc parametres tienne a gauche du bandeau
    ws.Columns("A").ColumnWidth = 24
    ws.Columns("B").ColumnWidth = 12

    ws.Range("A1").value = "PARAMETRES"
    ws.Range("A1").Font.bold = True
    ws.Range("A1").Font.color = C_HEADER
    ws.Range("A2").value = "Budget mensuel (" & ChrW(8364) & ")"
    ws.Range("A3").value = "Objectif CO2 annuel (kg)"
    ws.Range("A4").value = "Annee bilan (vide = recente)"   ' X24
    ws.Range("A7").value = "Graphiques auto (Oui/Non)"      ' X20
    ws.Range("A8").value = "Derniere generation"             ' X21
    If CStr(ws.Range(CELL_CO2OBJ).value) = "" Then ws.Range(CELL_CO2OBJ).value = DEFAULT_CO2_OBJ
    Dim gaCur As String: gaCur = UCase$(Trim$(CStr(ws.Range(CELL_GRAPH_AUTO).value))): If gaCur <> "OUI" And gaCur <> "NON" Then ws.Range(CELL_GRAPH_AUTO).value = "Oui"
    ws.Range("A2:A4").Font.Italic = True
    ws.Range("A2:A4").Font.color = RGB(107, 114, 128)         ' --text-muted
    ws.Range("A7:A8").Font.Italic = True
    ws.Range("A7:A8").Font.color = RGB(107, 114, 128)
    ' Cellules de saisie : fond clair + cadre discret (carte)
    With ws.Range(CELL_BUDGET & ":" & CELL_ANNEE)
        .Interior.color = RGB(255, 252, 230)
        .Borders.color = RGB(226, 232, 240)                   ' --border
        .Borders.Weight = xlThin
    End With
    ' B7 : saisie (Oui/Non) ; B8 : horodatage, lecture seule, grise
    With ws.Range(CELL_GRAPH_AUTO)
        .Interior.color = RGB(255, 252, 230)
        .Borders.color = RGB(226, 232, 240)
        .Borders.Weight = xlThin
    End With
    With ws.Range(CELL_HORODATAGE)
        .NumberFormat = "dd/mm/yyyy hh:mm"
        .Interior.color = RGB(240, 240, 240)
        .Font.color = RGB(107, 114, 128)
        .Locked = True
    End With
    ' B7 : liste deroulante Oui / Non (au lieu de texte libre)
    ws.Cells(1, 54).value = "Oui"   ' BB1
    ws.Cells(2, 54).value = "Non"   ' BB2
    ws.Columns(54).Hidden = True
    With ws.Range(CELL_GRAPH_AUTO).Validation
        .Delete
        .Add Type:=xlValidateList, AlertStyle:=xlValidAlertStop, _
             Formula1:="='" & ws.name & "'!$BB$1:$BB$2"
        .IgnoreBlank = True
        .InCellDropdown = True
    End With
    On Error GoTo 0
End Sub

Public Sub EnsureHeaderBand(ws As Worksheet)
    ' hdrBand supprime (doublon visuel avec dash_banner)
    On Error Resume Next
    ws.Shapes("hdrBand").Delete
    On Error GoTo 0
End Sub

Public Sub EnsureButtons(ws As Worksheet)
    ' Positions dans la zone du bandeau, sous le titre/sous-titre (Top ~88)
    ' BringToFront appele par MAJ_Dashboard_Graphiques apres creation du bandeau
    ' Boutons-icone carres (28x28) alignes dans le bas du bandeau bleu.
    ' Actualiser (dash_btn) est pose a gauche par modDashboardGraphiques (Left 338).
    Dim btnTop As Double: btnTop = ws.Range("A7").top - 42
    EnsurePictureButton ws, "btnRecreerGraph", "btn_recreer.png", _
        "Recreer les graphiques", C_E85, 66, btnTop, 26, 26, "RecreerDashboardComplet"
    EnsurePictureButton ws, "btnExportGraph", "btn_export_pdf.png", _
        "Exporter en PDF", C_E85, 116, btnTop, 26, 26, "ExporterGraphiquesPDF"
    ' S'assurer qu'ils sont au premier plan
    Dim s As Shape
    For Each s In ws.Shapes
        If s.name = "btnRecreerGraph" Or s.name = "btnExportGraph" Then
            s.ZOrder msoBringToFront
        End If
    Next s
End Sub

Private Sub EnsurePictureButton(ws As Worksheet, nm As String, fileName As String, _
                                fallbackTxt As String, fallbackFill As Long, _
                                L As Double, T As Double, w As Double, h As Double, _
                                action As String)
    ' supprime l'objet existant (image ou repli) pour repartir propre
    Dim s As Shape
    For Each s In ws.Shapes
        If s.name = nm Then s.Delete: Exit For
    Next s

    Dim p As String
    p = ThisWorkbook.path & Application.PathSeparator & "assets" & _
        Application.PathSeparator & fileName

    Dim ok As Boolean: ok = False
    On Error Resume Next
    If Dir(p) <> "" Then
        Dim pic As Shape
        Set pic = ws.Shapes.AddPicture(p, msoFalse, msoTrue, L, T, w, h)
        If Not pic Is Nothing Then
            pic.name = nm
            pic.OnAction = action
            pic.AlternativeText = fallbackTxt
            pic.Placement = xlFreeFloating      ' ne pas deriver au redim. des colonnes A:B
            ok = True
        End If
    End If
    On Error GoTo 0

    If Not ok Then
        ' repli : bouton Shape stylee (charte)
        Dim b As Shape
        Set b = ws.Shapes.AddShape(msoShapeRoundedRectangle, L, T, w, h)
        b.name = nm
        StyleShape b, fallbackTxt, fallbackFill, RGB(255, 255, 255), 10, True
        b.OnAction = action
        b.Placement = xlFreeFloating
    End If
End Sub
