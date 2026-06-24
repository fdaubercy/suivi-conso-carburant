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
'        kit E85       -> "Suivi Carburant"!B6
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

Private Const WS_CARB As String = "Suivi Carburant"
Private Function WS_REG() As String: WS_REG = "R" & ChrW(233) & "glages": End Function


' ============================================================
'  CONSTRUCTION DE LA FEUILLE
' ============================================================
Public Sub CreerFeuilleReglages()
    Dim ws As Worksheet
    Dim r As Long

    Application.ScreenUpdating = False
    On Error GoTo ErrH

    Set ws = GetOrCreateSheet(WS_REG)
    ws.Cells.Clear
    Dim shp As Shape
    For Each shp In ws.Shapes: shp.Delete: Next shp

    ws.Tab.Color = RGB(27, 58, 92)
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
        .Value = Emo(&H2699&) & " REGLAGES"
        .Font.Size = 18: .Font.Bold = True: .Font.Color = vbWhite
        .Interior.Color = RGB(27, 58, 92)
        .HorizontalAlignment = xlCenter
        .VerticalAlignment = xlCenter
    End With
    ws.Rows(1).RowHeight = 38

    ' ── 1) Reglages propres au classeur ──
    r = 3
    WSection ws, r, Emo(&H1F680&) & " Demarrage (classeur)": r = r + 1
    WInput ws, r, "Page d'ouverture", "Reg_PageOuverture", "Accueil", "", "Accueil,Saisie,Derniere vue": r = r + 2

    WSection ws, r, Emo(&H1F4E5&) & " Export (classeur)": r = r + 1
    WInput ws, r, "Separateur CSV", "Reg_SeparateurCSV", "Point-virgule", "", "Point-virgule,Virgule": r = r + 2

    ' ── 2) Parametres metier (synchronises avec l'app) ──
    WSection ws, r, Emo(&H1F517&) & " Parametres metier (synchronises avec l'app)": r = r + 1
    Dim rParams As Long: rParams = r
    WInput ws, r, "Prix du kit E85 (" & ChrW(8364) & ")", "Reg_KitPrix", "", "0.00", "": r = r + 1
    WInput ws, r, "Budget mensuel (" & ChrW(8364) & ")", "Reg_Budget", "", "0", "": r = r + 1
    WInput ws, r, "Objectif CO2 annuel (kg)", "Reg_ObjectifCO2", "", "0", "": r = r + 1
    WInput ws, r, "Surconsommation E85", "Reg_Surconso", "", "0.0", "": r = r + 1
    With ws.Cells(r, 2)
        .Value = "Seuils d'alerte prix : geres dans l'app (synchronises via 'Parametres')."
        .Font.Italic = True: .Font.Color = RGB(107, 114, 128): .Font.Size = 9
    End With
    r = r + 2

    ' Boutons (a droite de la section metier)
    Dim L As Single: L = ws.Cells(rParams, 6).Left
    Dim T As Single: T = ws.Cells(rParams, 6).Top
    AddButton ws, "btnReg1", L, T, "Appliquer + Synchroniser", "ReglAppliquer", RGB(29, 158, 117)
    AddButton ws, "btnReg2", L, T + 30, "Recharger depuis l'app", "ReglRecharger", RGB(46, 117, 182)

    ' ── Etat interne ──
    WSection ws, r, Emo(&H21A9&) & " Etat (interne)": r = r + 1
    WInput ws, r, "Derniere vue consultee", "Reg_DerniereVue", "", "", "": r = r + 1

    ' ── 3) Zoom par onglet ──────────────────────────────────
    r = r + 1
    WSection ws, r, Emo(&H1F50D&) & " Zoom par onglet": r = r + 1
    With ws.Cells(r, 2)
        .Value = "Feuille"
        .Font.Bold = True: .Font.Color = RGB(107, 114, 128)
    End With
    With ws.Cells(r, 4)
        .Value = "Nb colonnes"
        .Font.Bold = True: .Font.Color = RGB(107, 114, 128): .HorizontalAlignment = xlCenter
    End With
    r = r + 1
    On Error Resume Next
    ThisWorkbook.Names.Add Name:="Zoom_TableStart", RefersTo:=ws.Cells(r, 2)
    On Error GoTo ErrH
    Dim shZ(5) As String, nZ(5) As Long
    shZ(0) = "Tableau de bord": nZ(0) = 14
    shZ(1) = "Hist. Carburant":  nZ(1) = 12
    shZ(2) = "Carte":           nZ(2) = 10
    shZ(3) = "Suivi Carburant": nZ(3) = 16
    shZ(4) = "R" & ChrW(233) & "glages": nZ(4) = 8
    shZ(5) = "Accueil":         nZ(5) = 12
    Dim zi As Long
    For zi = 0 To 5
        ws.Cells(r + zi, 2).Value = shZ(zi)
        ws.Cells(r + zi, 2).Font.Color = RGB(55, 65, 81)
        With ws.Cells(r + zi, 4)
            .Value = nZ(zi)
            .Font.Bold = True: .HorizontalAlignment = xlCenter
            .Interior.Color = RGB(243, 244, 246)
            .Borders.LineStyle = xlContinuous
            .Borders.Color = RGB(209, 213, 219)
            .Borders.Weight = xlThin
        End With
        ws.Rows(r + zi).RowHeight = 22
    Next zi
    r = r + 8

    ' ── 4) Charte graphique ──────────────────────────────────
    WSection ws, r, Emo(&H1F3A8&) & " Charte graphique": r = r + 1
    With ws.Cells(r, 2)
        .Value = "Modifiez le remplissage de la cellule (Accueil > Couleur de remplissage), puis cliquez Appliquer."
        .Font.Italic = True: .Font.Color = RGB(107, 114, 128): .Font.Size = 9
    End With
    r = r + 2
    Dim chNm(5) As String, chClr(5) As Long, chLbl(5) As String
    chNm(0) = "Primaire": chClr(0) = RGB(27, 58, 92):    chLbl(0) = "Couleur primaire (bleu nuit)"
    chNm(1) = "Vert":     chClr(1) = RGB(29, 158, 117):  chLbl(1) = "Couleur accent (vert)"
    chNm(2) = "Ambre":    chClr(2) = RGB(240, 165, 0):   chLbl(2) = "Couleur alerte (ambre)"
    chNm(3) = "Rouge":    chClr(3) = RGB(226, 75, 74):   chLbl(3) = "Couleur danger (rouge)"
    chNm(4) = "Texte":    chClr(4) = RGB(26, 26, 26):    chLbl(4) = "Couleur texte"
    chNm(5) = "Subtil":   chClr(5) = RGB(107, 114, 128): chLbl(5) = "Couleur secondaire"
    Dim ci As Long
    For ci = 0 To 5
        ws.Cells(r + ci, 2).Value = chLbl(ci)
        ws.Cells(r + ci, 2).Font.Color = RGB(55, 65, 81)
        ws.Cells(r + ci, 2).Font.Size = 11
        ws.Cells(r + ci, 2).IndentLevel = 1
        With ws.Cells(r + ci, 4)
            .Value = ""
            .Interior.Color = chClr(ci)
            .Borders.LineStyle = xlContinuous
            .Borders.Color = RGB(209, 213, 219)
            .Borders.Weight = xlThin
            On Error Resume Next
            .Name = "C_" & chNm(ci)
            On Error GoTo ErrH
        End With
        ws.Rows(r + ci).RowHeight = 22
    Next ci
    AddButton ws, "btnAppliquerCharte", _
              ws.Cells(r, 6).Left, ws.Cells(r + 6, 2).Top + 4, _
              "Appliquer la charte", "modCharte.AppliquerCharte", RGB(29, 158, 117)
    r = r + 8

    ' Remplit les 4 cellules metier depuis les cellules canoniques
    ReglagePullParametres

    ws.Range("B1").Select
    SetStatus "[Reglages] " & ChrW(10003) & " Feuille '" & WS_REG & "' creee (params metier surfaces)."
    GoTo Done
ErrH:
    SetStatus "[Reglages] " & ChrW(9888) & " Erreur " & Err.Number & " : " & Err.Description
Done:
    Application.ScreenUpdating = True
End Sub


' ============================================================
'  PARAMETRES METIER <-> CELLULES CANONIQUES
' ============================================================

' Remplit les cellules de la feuille Reglages depuis les cellules sources.
Public Sub ReglagePullParametres()
    Dim d As Worksheet, c As Worksheet
    On Error Resume Next
    Set d = DashSheet(): Set c = CarbSheet()
    Application.EnableEvents = False
    If Not c Is Nothing Then
        SetNamed "Reg_KitPrix", c.Range("B6").Value
        SetNamed "Reg_Surconso", c.Range("J7").Value
    End If
    If Not d Is Nothing Then
        SetNamed "Reg_Budget", d.Range("B2").Value
        SetNamed "Reg_ObjectifCO2", d.Range("B3").Value
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
        PutIf c.Range("B6"), ReglageVal("Reg_KitPrix")
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


' ============================================================
'  LECTEURS (utilises par les autres modules)
' ============================================================
Public Function ReglageVal(nm As String) As Variant
    On Error Resume Next
    ReglageVal = ThisWorkbook.Names(nm).RefersToRange.Value
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
    ThisWorkbook.Names("Reg_DerniereVue").RefersToRange.Value = token
    On Error GoTo 0
End Sub


' ============================================================
'  HELPERS (prives au module)
' ============================================================

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
    ThisWorkbook.Names(nm).RefersToRange.Value = v
    On Error GoTo 0
End Sub

Private Sub PutIf(target As Range, v As Variant)
    If Len(Trim$(CStr(v))) > 0 Then target.Value = v
End Sub

Private Sub WSection(ws As Worksheet, r As Long, title As String)
    With ws.Cells(r, 2)
        .Value = title
        .Font.Bold = True: .Font.Size = 12: .Font.Color = RGB(27, 58, 92)
    End With
    ws.Rows(r).RowHeight = 24
End Sub

Private Sub WInput(ws As Worksheet, r As Long, label As String, nm As String, _
                   val As Variant, fmt As String, validList As String)
    With ws.Cells(r, 2)
        .Value = label
        .Font.Color = RGB(55, 65, 81)
        .Font.Size = 11
        .IndentLevel = 1
    End With
    With ws.Cells(r, 4)
        If CStr(val) <> "" Then .Value = val
        If fmt <> "" Then .NumberFormat = fmt
        .Font.Bold = True
        .Font.Color = RGB(27, 58, 92)
        .Interior.Color = RGB(243, 244, 246)
        .HorizontalAlignment = xlCenter
        .Borders.LineStyle = xlContinuous
        .Borders.Color = RGB(209, 213, 219)
        .Borders.Weight = xlThin
        .Name = nm
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

Private Sub AddButton(ws As Worksheet, nm As String, L As Single, T As Single, _
                      caption As String, macro As String, fill As Long)
    Dim sh As Shape
    Set sh = ws.Shapes.AddShape(msoShapeRoundedRectangle, L, T, 190, 26)
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

Private Function GetOrCreateSheet(nm As String) As Worksheet
    On Error Resume Next
    Set GetOrCreateSheet = ThisWorkbook.Sheets(nm)
    On Error GoTo 0
    If GetOrCreateSheet Is Nothing Then
        Set GetOrCreateSheet = ThisWorkbook.Sheets.Add(After:=ThisWorkbook.Sheets(ThisWorkbook.Sheets.Count))
        GetOrCreateSheet.Name = nm
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
