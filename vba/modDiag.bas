Attribute VB_Name = "modDiag"
Option Explicit

Public Function DiagPoserSidebar() As String
    Dim ws As Worksheet
    On Error Resume Next
    Set ws = ThisWorkbook.Worksheets("Accueil")
    On Error GoTo 0
    If ws Is Nothing Then
        DiagPoserSidebar = "ERREUR: feuille Accueil introuvable"
        Exit Function
    End If

    Dim msg As String
    Dim j As Long

    On Error Resume Next
    For j = ws.Shapes.Count To 1 Step -1
        If Left$(ws.Shapes(j).Name, 3) = "sb_" Then ws.Shapes(j).Delete
    Next j
    If Err.Number <> 0 Then
        DiagPoserSidebar = "Etape1_Delete ERR " & Err.Number & ": " & Err.Description
        Err.Clear: On Error GoTo 0: Exit Function
    End If
    On Error GoTo 0
    msg = "Etape1_Delete OK"

    Dim bg As Shape
    On Error Resume Next
    Set bg = ws.Shapes.AddShape(msoShapeRoundedRectangle, 0, 6, 44, 294)
    If Err.Number <> 0 Then
        DiagPoserSidebar = msg & " | Etape2_AddBg ERR " & Err.Number & ": " & Err.Description
        Err.Clear: On Error GoTo 0: Exit Function
    End If
    On Error GoTo 0
    msg = msg & " | Etape2_AddBg OK"

    On Error Resume Next
    bg.Adjustments(1) = 0.5
    If Err.Number <> 0 Then
        DiagPoserSidebar = msg & " | Etape2b_Adj ERR " & Err.Number & ": " & Err.Description
        Err.Clear: On Error GoTo 0: Exit Function
    End If
    On Error GoTo 0
    msg = msg & " | Etape2b_Adj OK"

    Dim ham As Shape
    On Error Resume Next
    Set ham = ws.Shapes.AddShape(msoShapeRoundedRectangle, 2, 8, 40, 36)
    If Err.Number <> 0 Then
        DiagPoserSidebar = msg & " | Etape3_Ham ERR " & Err.Number & ": " & Err.Description
        Err.Clear: On Error GoTo 0: Exit Function
    End If
    On Error GoTo 0
    msg = msg & " | Etape3_Ham OK"

    On Error Resume Next
    ham.TextFrame2.TextRange.Text = ChrW(9776)
    If Err.Number <> 0 Then
        DiagPoserSidebar = msg & " | Etape3b_HamText ERR " & Err.Number & ": " & Err.Description
        Err.Clear: On Error GoTo 0: Exit Function
    End If
    On Error GoTo 0
    msg = msg & " | Etape3b_HamText OK"

    Dim hdr As Shape
    On Error Resume Next
    Set hdr = ws.Shapes.AddTextBox(msoTextOrientationHorizontal, 46, 10, 172, 32)
    If Err.Number <> 0 Then
        DiagPoserSidebar = msg & " | Etape4_Hdr ERR " & Err.Number & ": " & Err.Description
        Err.Clear: On Error GoTo 0: Exit Function
    End If
    On Error GoTo 0
    msg = msg & " | Etape4_Hdr OK"

    On Error Resume Next
    hdr.Visible = False
    If Err.Number <> 0 Then
        DiagPoserSidebar = msg & " | Etape4b_HdrVis ERR " & Err.Number & ": " & Err.Description
        Err.Clear: On Error GoTo 0: Exit Function
    End If
    On Error GoTo 0
    msg = msg & " | Etape4b_HdrVis OK"

    Dim ico As Shape
    On Error Resume Next
    Set ico = ws.Shapes.AddShape(msoShapeRoundedRectangle, 2, 44, 40, 38)
    If Err.Number <> 0 Then
        DiagPoserSidebar = msg & " | Etape5_Ico ERR " & Err.Number & ": " & Err.Description
        Err.Clear: On Error GoTo 0: Exit Function
    End If
    On Error GoTo 0
    msg = msg & " | Etape5_Ico OK"

    On Error Resume Next
    Dim emoStr As String
    Dim v As Long: v = &H1F3E0 - &H10000
    emoStr = ChrW(&HD800& Or (v \ &H400&)) & ChrW(&HDC00& Or (v And &H3FF&))
    If Err.Number <> 0 Then
        DiagPoserSidebar = msg & " | Etape5b_EmoCalc ERR " & Err.Number & ": " & Err.Description
        Err.Clear: On Error GoTo 0: Exit Function
    End If
    On Error GoTo 0
    msg = msg & " | Etape5b_EmoCalc OK"

    On Error Resume Next
    ico.TextFrame2.TextRange.Text = emoStr
    If Err.Number <> 0 Then
        DiagPoserSidebar = msg & " | Etape5c_EmoText ERR " & Err.Number & ": " & Err.Description
        Err.Clear: On Error GoTo 0: Exit Function
    End If
    On Error GoTo 0
    msg = msg & " | Etape5c_EmoText OK"

    Dim lbl As Shape
    On Error Resume Next
    Set lbl = ws.Shapes.AddTextBox(msoTextOrientationHorizontal, 46, 48, 170, 30)
    If Err.Number <> 0 Then
        DiagPoserSidebar = msg & " | Etape6_Lbl ERR " & Err.Number & ": " & Err.Description
        Err.Clear: On Error GoTo 0: Exit Function
    End If
    On Error GoTo 0
    msg = msg & " | Etape6_Lbl OK"

    On Error Resume Next
    lbl.OnAction = "modSidebar.NavSidebar_0"
    If Err.Number <> 0 Then
        DiagPoserSidebar = msg & " | Etape6b_LblOnAction ERR " & Err.Number & ": " & Err.Description
        Err.Clear: On Error GoTo 0: Exit Function
    End If
    On Error GoTo 0
    msg = msg & " | Etape6b_LblOnAction OK"

    On Error Resume Next
    bg.Delete
    ham.Delete
    hdr.Delete
    ico.Delete
    lbl.Delete
    On Error GoTo 0

    DiagPoserSidebar = msg & " | TOUT OK"
End Function

Public Sub RunDiag()
    Dim result As String
    result = DiagPoserSidebar()
    On Error Resume Next
    ThisWorkbook.Worksheets(1).Range("A1").Value = result
    On Error GoTo 0
End Sub

' Wrapper: pose la sidebar sur l'onglet actif (contourne limitation xl.Run avec arguments)
Public Sub PoseSidebarOnActive()
    On Error Resume Next
    modSidebar.PoserSidebarSurFeuille ActiveSheet
    On Error GoTo 0
End Sub

' Wrapper minimal : pose la sidebar sur un onglet nomme
Public Sub PoseSidebarSurNom(ByVal nomFeuille As String)
    Dim ws As Worksheet
    On Error Resume Next
    Set ws = ThisWorkbook.Worksheets(nomFeuille)
    On Error GoTo 0
    If ws Is Nothing Then Exit Sub
    On Error Resume Next
    modSidebar.PoserSidebarSurFeuille ws
    On Error GoTo 0
End Sub

' Pose la sidebar sur tous les onglets cibles - version sans fichier
Public Sub PoseSidebarTousOnglets()
    On Error Resume Next
    modDiag.PoseSidebarSurNom "Accueil"
    modDiag.PoseSidebarSurNom "Tableau de bord"
    modDiag.PoseSidebarSurNom "Carte"
    modDiag.PoseSidebarSurNom "R" & ChrW(233) & "glages"
    modDiag.PoseSidebarSurNom "Suivi Carburant"
    modDiag.PoseSidebarSurNom "Prix par Station"
    modDiag.PoseSidebarSurNom "Hist. Carburant"
    modSidebar.MarquerOngletActif
    On Error GoTo 0
End Sub
