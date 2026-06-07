Attribute VB_Name = "modReglages"
' ============================================================
'  SUIVI E85 - Feuille REGLAGES                          v1.1.0.0
'  Etape 1/3 du dashboard miroir de l'app PWA.
'
'  Deux familles de reglages :
'   1) PROPRES AU CLASSEUR (cellules nommees locales, lues par les
'      autres modules) :
'        Reg_PageOuverture   Reg_SeparateurCSV   Reg_DerniereVue
'   2) METIER, SYNCHRONISES app<->Excel : la feuille NE stocke PAS de
'      valeur en double ; elle SURFACE et ECRIT les cellules canoniques
'      deja gerees par modSyncParametres :
'        kit E85       -> "Suivi Carburant"!B5
'        budget        -> "Tableau de bord"!B2
'        objectif CO2  -> "Tableau de bord"!B3
'        surconso      -> "Suivi Carburant"!J7
'      Bouton "Appliquer + Synchroniser" = ecrit ces 4 cellules + appelle
'      SyncParametresManuel (LWW app<->Excel). Les seuils d'alerte restent
'      geres cote app (miroir "Notes").
'
'  DEPENDANCES (non redefinies) : SetStatus (ModuleImportGS) ;
'    SyncParametresManuel (modSyncParametres, appel tardif tolerant).
'
'  OPTIONNEL : coller Reglages_snippet.bas dans le module de la feuille
'  "Reglages" pour rafraichir l'affichage a chaque activation.
'
'  USAGE : CreerFeuilleReglages | ReglAppliquer | ReglRecharger
'  Lecteurs : ReglageVal / ReglageSeparateurCSV / ReglagePageOuverture
' ============================================================
Option Explicit

Private Const WS_REG  As String = "Reglages"
Private Const WS_CARB As String = "Suivi Carburant"


' ------------------------------------------------------------
'  CONSTRUCTION DE LA FEUILLE
' ------------------------------------------------------------
Public Sub CreerFeuilleReglages()
    Dim ws As Worksheet
    Dim r As Long

    Application.ScreenUpdating = False
    On Error GoTo ErrH

    Set ws = GetOrCreateSheet(WS_REG)
    ws.Cells.Clear
    Dim shp As Shape
    For Each shp In ws.Shapes: shp.Delete: Next shp

    ws.Tab.color = RGB(27, 58, 92)
    ws.Activate
    On Error Resume Next
    ActiveWindow.DisplayGridlines = False
    On Error GoTo ErrH
    ws.Columns("A").ColumnWidth = 2
    ws.Columns("B").ColumnWidth = 38
    ws.Columns("C").ColumnWidth = 2
    ws.Columns("D").ColumnWidth = 20

    On Error Resume Next
    ws.Range("B1:D1").Merge
    On Error GoTo ErrH
    With ws.Range("B1")
        .value = Emo(&H2699&) & " REGLAGES"
        .Font.Size = 18: .Font.bold = True: .Font.color = vbWhite
        .Interior.color = RGB(27, 58, 92)
        .HorizontalAlignment = xlCenter
        .VerticalAlignment = xlCenter
    End With
    ws.Rows(1).RowHeight = 38

    ' -- 1) Reglages propres au classeur --
    r = 3
    WSection ws, r, Emo(&H1F680) & " Demarrage (classeur)": r = r + 1
    WInput ws, r, "Page d'ouverture", "Reg_PageOuverture", "Accueil", "", "Accueil,Saisie,Derniere vue": r = r + 2

    WSection ws, r, Emo(&H1F4E5) & " Export (classeur)": r = r + 1
    WInput ws, r, "Separateur CSV", "Reg_SeparateurCSV", "Point-virgule", "", "Point-virgule,Virgule": r = r + 2

    ' -- 2) Parametres metier (synchronises avec l'app) --
    WSection ws, r, Emo(&H1F517) & " Parametres metier (synchronises avec l'app)": r = r + 1
    Dim rParams As Long: rParams = r
    WInput ws, r, "Prix du kit E85 (" & ChrW(8364) & ")", "Reg_KitPrix", "", "0.00", "": r = r + 1
    WInput ws, r, "Budget mensuel (" & ChrW(8364) & ")", "Reg_Budget", "", "0", "": r = r + 1
    WInput ws, r, "Objectif CO2 annuel (kg)", "Reg_ObjectifCO2", "", "0", "": r = r + 1
    WInput ws, r, "Surconsommation E85", "Reg_Surconso", "", "0.0", "": r = r + 1
    With ws.Cells(r, 2)
        .value = "Seuils d'alerte prix : geres dans l'app (synchronises via 'Parametres')."
        .Font.Italic = True: .Font.color = RGB(107, 114, 128): .Font.Size = 9
    End With
    r = r + 2

    ' Boutons (a droite de la section metier)
    Dim L As Single: L = ws.Cells(rParams, 6).Left
    Dim t As Single: t = ws.Cells(rParams, 6).Top
    AddButton ws, "btnReg1", L, t, "Appliquer + Synchroniser", "ReglAppliquer", RGB(29, 158, 117)
    AddButton ws, "btnReg2", L, t + 30, "Recharger depuis l'app", "ReglRecharger", RGB(46, 117, 182)

    ' -- Etat interne --
    WSection ws, r, Emo(&H21A9&) & " Etat (interne)": r = r + 1
    WInput ws, r, "Derniere vue consultee", "Reg_DerniereVue", "", "", "": r = r + 1

    ' Remplit les 4 cellules metier depuis les cellules canoniques
    ReglagePullParametres

    ws.Range("B1").Select
    SetStatus "[Reglages] " & ChrW(10003) & " Feuille '" & WS_REG & "' creee (params metier surfaces)."
    GoTo done
ErrH:
    SetStatus "[Reglages] " & ChrW(9888) & " Erreur " & Err.Number & " : " & Err.Description
done:
    Application.ScreenUpdating = True
End Sub


' ------------------------------------------------------------
'  PARAMETRES METIER <-> CELLULES CANONIQUES
' ------------------------------------------------------------

' Remplit les cellules de la feuille Reglages depuis les cellules sources.
Public Sub ReglagePullParametres()
    Dim d As Worksheet, c As Worksheet
    On Error Resume Next
    Set d = DashSheet(): Set c = CarbSheet()
    Application.EnableEvents = False
    If Not c Is Nothing Then
        SetNamed "Reg_KitPrix", c.Range("B5").value
        SetNamed "Reg_Surconso", c.Range("J7").value
    End If
    If Not d Is Nothing Then
        SetNamed "Reg_Budget", d.Range("B2").value
        SetNamed "Reg_ObjectifCO2", d.Range("B3").value
    End If
    Application.EnableEvents = True
    On Error GoTo 0
End Sub

' Ecrit les cellules de la feuille Reglages dans les cellules sources
' (uniquement si renseignees, pour ne jamais ecraser une valeur par du vide),
' puis declenche la synchro app<->Excel.
Public Sub ReglagePushParametres()
    Dim d As Worksheet, c As Worksheet
    Application.EnableEvents = False
    On Error Resume Next
    Set d = DashSheet(): Set c = CarbSheet()
    If Not c Is Nothing Then
        PutIf c.Range("B5"), ReglageVal("Reg_KitPrix")
        PutIf c.Range("J7"), ReglageVal("Reg_Surconso")
    End If
    If Not d Is Nothing Then
        PutIf d.Range("B2"), ReglageVal("Reg_Budget")
        PutIf d.Range("B3"), ReglageVal("Reg_ObjectifCO2")
    End If
    On Error GoTo 0
    Application.EnableEvents = True

    On Error Resume Next
    Application.Run "SyncParametresManuel"
    On Error GoTo 0
    SetStatus "[Reglages] " & ChrW(10003) & " Parametres ecrits dans les cellules sources + synchronises."
End Sub

' Boutons (OnAction)
Public Sub ReglAppliquer()
    ReglagePushParametres
End Sub

Public Sub ReglRecharger()
    On Error Resume Next
    Application.Run "SyncParametresManuel"
    On Error GoTo 0
    ReglagePullParametres
    SetStatus "[Reglages] " & ChrW(10003) & " Valeurs rechargees depuis les cellules sources (post-sync)."
End Sub


' ------------------------------------------------------------
'  LECTEURS (utilises par les autres modules)
' ------------------------------------------------------------
Public Function ReglageVal(nm As String) As Variant
    On Error Resume Next
    ReglageVal = ThisWorkbook.Names(nm).RefersToRange.value
    On Error GoTo 0
End Function

Public Function ReglageSeparateurCSV() As String
    Dim v As String: v = CStr(ReglageVal("Reg_SeparateurCSV"))
    If InStr(1, v, "Virgule", vbTextCompare) > 0 Then
        ReglageSeparateurCSV = ","
    Else
        ReglageSeparateurCSV = ";"
    End If
End Function

Public Function ReglagePageOuverture() As String
    Dim v As String: v = LCase$(CStr(ReglageVal("Reg_PageOuverture")))
    If InStr(v, "saisie") > 0 Then
        ReglagePageOuverture = "saisie"
    ElseIf InStr(v, "der") > 0 Then
        ReglagePageOuverture = "last"
    Else
        ReglagePageOuverture = "accueil"
    End If
End Function

Public Sub ReglageSetDerniereVue(token As String)
    On Error Resume Next
    ThisWorkbook.Names("Reg_DerniereVue").RefersToRange.value = token
    On Error GoTo 0
End Sub


' ------------------------------------------------------------
'  HELPERS (prives au module)
' ------------------------------------------------------------

' Onglet du tableau de bord (ex-"Graphiques", renomme "Tableau de bord").
Private Function DashSheet() As Worksheet
    On Error Resume Next
    Set DashSheet = ThisWorkbook.Sheets("Tableau de bord")
    If DashSheet Is Nothing Then Set DashSheet = ThisWorkbook.Sheets("Graphiques")
    On Error GoTo 0
End Function

Private Function CarbSheet() As Worksheet
    On Error Resume Next
    Set CarbSheet = ThisWorkbook.Sheets(WS_CARB)
    On Error GoTo 0
End Function

Private Sub SetNamed(nm As String, v As Variant)
    On Error Resume Next
    ThisWorkbook.Names(nm).RefersToRange.value = v
    On Error GoTo 0
End Sub

Private Sub PutIf(target As Range, v As Variant)
    If Len(Trim$(CStr(v))) > 0 Then target.value = v
End Sub

Private Sub WSection(ws As Worksheet, r As Long, title As String)
    With ws.Cells(r, 2)
        .value = title
        .Font.bold = True: .Font.Size = 12: .Font.color = RGB(27, 58, 92)
    End With
    ws.Rows(r).RowHeight = 24
End Sub

Private Sub WInput(ws As Worksheet, r As Long, label As String, nm As String, _
                   val As Variant, fmt As String, validList As String)
    With ws.Cells(r, 2)
        .value = label
        .Font.color = RGB(55, 65, 81)
        .Font.Size = 11
        .IndentLevel = 1
    End With
    With ws.Cells(r, 4)
        If CStr(val) <> "" Then .value = val
        If fmt <> "" Then .NumberFormat = fmt
        .Font.bold = True
        .Font.color = RGB(27, 58, 92)
        .Interior.color = RGB(243, 244, 246)
        .HorizontalAlignment = xlCenter
        .Borders.LineStyle = xlContinuous
        .Borders.color = RGB(209, 213, 219)
        .Borders.Weight = xlThin
        .name = nm
        If validList <> "" Then
            On Error Resume Next
            .Validation.Delete
            .Validation.Add Type:=xlValidateList, AlertStyle:=xlValidAlertStop, Formula1:=validList
            .Validation.InCellDropdown = True
            .Validation.IgnoreBlank = True
            On Error GoTo 0
        End If
    End With
    ws.Rows(r).RowHeight = 22
End Sub

Private Sub AddButton(ws As Worksheet, nm As String, L As Single, t As Single, _
                      caption As String, macro As String, fill As Long)
    Dim sh As Shape
    Set sh = ws.Shapes.AddShape(msoShapeRoundedRectangle, L, t, 190, 26)
    sh.name = nm
    With sh
        .fill.ForeColor.RGB = fill
        .Line.Visible = msoFalse
        With .TextFrame2
            .TextRange.text = caption
            .TextRange.Font.fill.ForeColor.RGB = vbWhite
            .TextRange.Font.bold = msoTrue
            .TextRange.Font.Size = 10
            .TextRange.ParagraphFormat.Alignment = msoAlignCenter
            .HorizontalAnchor = msoAnchorCenter
            .VerticalAnchor = msoAnchorMiddle
        End With
        .OnAction = macro
    End With
End Sub

Private Function GetOrCreateSheet(nm As String) As Worksheet
    On Error Resume Next
    Set GetOrCreateSheet = ThisWorkbook.Sheets(nm)
    On Error GoTo 0
    If GetOrCreateSheet Is Nothing Then
        Set GetOrCreateSheet = ThisWorkbook.Sheets.Add(After:=ThisWorkbook.Sheets(ThisWorkbook.Sheets.count))
        GetOrCreateSheet.name = nm
    End If
End Function

Private Function Emo(ByVal cp As Long) As String
    If cp <= &HFFFF& Then
        Emo = ChrW(cp)
    Else
        Dim v As Long: v = cp - &H10000
        Emo = ChrW(&HD800& Or (v \ &H400&)) & ChrW(&HDC00& Or (v And &H3FF&))
    End If
End Function


