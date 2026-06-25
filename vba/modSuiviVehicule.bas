Attribute VB_Name = "modSuiviVehicule"
Option Explicit

'============================================================
'  X54 - Selecteur vehicule LOCAL sur "Suivi Carburant"
'------------------------------------------------------------
'  B3 ("Vehicule analyse") bascule entre 2 modes :
'   - SUIVRE LE DASHBOARD (defaut) : B3 = formule miroir de
'     'Tableau de bord'!B5 (pilote par le slicer slcVehicule).
'   - ANALYSE LOCALE : B3 = valeur figee choisie via une liste
'     de validation dynamique (vehicules de GS_Pleins), pour
'     analyser un vehicule sur cet onglet SANS changer le
'     dashboard. Tous les indicateurs (B7/B8/J6/J7/J8/B11...)
'     filtrent sur $B$3 -> ils suivent automatiquement.
'  Deux boutons (sous le segment "Vehicule") pilotent la bascule.
'  Aucune formule d'indicateur n'est modifiee.
'============================================================

Private Const WS_SUIVI As String = "Suivi Carburant"

' Formule miroir d'origine de B3 (mode "suivre le dashboard").
' NB : si cette formule evolue dans la feuille, mettre a jour ici.
Private Const FORMULE_MIROIR_B3 As String = _
    "=IF(OR('Tableau de bord'!B5="""",'Tableau de bord'!B5=""(tous)""),""(tous)"",'Tableau de bord'!B5)"

' Charte
Private Const CLR_BLEU As Long = 6044187        ' bleu charte (boutons)
Private Const CLR_BLANC As Long = 16777215      ' blanc (fond B3 mode dashboard)

' Noms des boutons (idempotence)
Private Const BTN_LOCAL As String = "btnSuiviVehLocal"
Private Const BTN_DASH As String = "btnSuiviVehDashboard"

'------------------------------------------------------------
'  Bascule -> ANALYSE LOCALE
'------------------------------------------------------------
Public Sub SuiviVehicule_ModeLocal()
    Dim ws As Worksheet
    On Error GoTo EH
    Set ws = ThisWorkbook.Worksheets(WS_SUIVI)
    Dim b3 As Range: Set b3 = ws.Range("B3")

    Dim listeCsv As String: listeCsv = BuildVehiculeListCsv()
    Dim valCourante As String: valCourante = Trim$(CStr(b3.value))
    If valCourante = "" Then valCourante = "(tous)"

    DeverrouillerSuivi
    Application.EnableEvents = False

    ' Fige la valeur courante (retire la formule miroir)
    b3.value = valCourante

    ' Pose la liste de validation dynamique
    With b3.Validation
        .Delete
        .Add Type:=xlValidateList, AlertStyle:=xlValidAlertStop, _
             Operator:=xlBetween, Formula1:=listeCsv
        .IgnoreBlank = True
        .InCellDropdown = True
        .ShowError = True
    End With

    b3.Locked = False                       ' editable en mode local
    b3.Interior.Color = RGB(255, 248, 204)  ' jaune pale = repere "local"

    Application.EnableEvents = True
    VerrouillerSuivi
    Application.StatusBar = "Analyse LOCALE activee : choisissez un vehicule dans la liste B3 (decouple du dashboard)."
    Exit Sub
EH:
    Application.EnableEvents = True
    On Error Resume Next
    VerrouillerSuivi
    Application.StatusBar = False
    MsgBox "Mode local impossible : " & Err.Description, vbExclamation, "Suivi Carburant"
End Sub

'------------------------------------------------------------
'  Bascule -> SUIVRE LE DASHBOARD
'------------------------------------------------------------
Public Sub SuiviVehicule_SuivreDashboard()
    Dim ws As Worksheet
    On Error GoTo EH
    Set ws = ThisWorkbook.Worksheets(WS_SUIVI)
    Dim b3 As Range: Set b3 = ws.Range("B3")

    DeverrouillerSuivi
    Application.EnableEvents = False

    On Error Resume Next
    b3.Validation.Delete
    On Error GoTo EH

    b3.Formula = FORMULE_MIROIR_B3          ' restaure le miroir du dashboard
    b3.Locked = True
    b3.Interior.Color = CLR_BLANC

    Application.EnableEvents = True
    VerrouillerSuivi
    Application.StatusBar = "Suivi aligne sur le dashboard (vehicule du slicer slcVehicule)."
    Exit Sub
EH:
    Application.EnableEvents = True
    On Error Resume Next
    VerrouillerSuivi
    Application.StatusBar = False
    MsgBox "Retour au mode dashboard impossible : " & Err.Description, vbExclamation, "Suivi Carburant"
End Sub

'------------------------------------------------------------
'  Construit la liste CSV de validation : "(tous),Veh1,Veh2..."
'  Source dynamique = vehicules distincts de GS_Pleins.
'------------------------------------------------------------
Private Function BuildVehiculeListCsv() As String
    Dim csv As String: csv = KPI_TOUS
    On Error Resume Next
    Dim vehs() As String: vehs = modDashboardKPI.KPIVehiculeList()
    Dim i As Long
    For i = LBound(vehs) To UBound(vehs)
        Dim v As String: v = Trim$(vehs(i))
        v = Replace(v, ",", " ")            ' securite : pas de virgule dans un item
        If Len(v) > 0 Then csv = csv & "," & v
    Next i
    On Error GoTo 0
    BuildVehiculeListCsv = csv
End Function

'------------------------------------------------------------
'  Cree (ou recree) les 2 boutons sous le segment "Vehicule".
'  Idempotent : supprime les boutons existants avant de recreer.
'------------------------------------------------------------
Public Sub SuiviVehicule_EnsureBoutons()
    Dim ws As Worksheet: Set ws = ThisWorkbook.Worksheets(WS_SUIVI)
    Dim segLeft As Double, segW As Double, segBottom As Double
    segLeft = 1116: segW = 185: segBottom = 228
    On Error Resume Next
    Dim seg As Shape: Set seg = ws.Shapes("Vehicule")
    If Not seg Is Nothing Then
        segLeft = seg.Left: segW = seg.Width: segBottom = seg.Top + seg.Height
    End If
    On Error GoTo 0

    DeverrouillerSuivi
    DeleteShapeIfExists ws, BTN_LOCAL
    DeleteShapeIfExists ws, BTN_DASH

    Dim y As Double: y = segBottom + 6
    AddBouton ws, BTN_LOCAL, segLeft, y, segW, 22, _
              "Analyse locale", "SuiviVehicule_ModeLocal"
    AddBouton ws, BTN_DASH, segLeft, y + 25, segW, 22, _
              "Suivre le dashboard", "SuiviVehicule_SuivreDashboard"
    VerrouillerSuivi
End Sub

Private Sub DeleteShapeIfExists(ByVal ws As Worksheet, ByVal nm As String)
    On Error Resume Next
    ws.Shapes(nm).Delete
    On Error GoTo 0
End Sub

Private Sub AddBouton(ByVal ws As Worksheet, ByVal nm As String, _
                      ByVal L As Double, ByVal T As Double, _
                      ByVal wdt As Double, ByVal hgt As Double, _
                      ByVal caption As String, ByVal macro As String)
    Dim sh As Shape
    Set sh = ws.Shapes.AddShape(msoShapeRoundedRectangle, L, T, wdt, hgt)
    sh.name = nm
    sh.OnAction = macro
    sh.Fill.ForeColor.RGB = CLR_BLEU
    sh.Line.Visible = msoFalse
    With sh.TextFrame2
        .TextRange.text = caption
        .TextRange.Font.Fill.ForeColor.RGB = CLR_BLANC
        .TextRange.Font.Size = 9
        .TextRange.Font.Bold = msoTrue
        .VerticalAnchor = msoAnchorMiddle
        .HorizontalAnchor = msoAnchorCenter
        .TextRange.ParagraphFormat.Alignment = msoAlignCenter
    End With
End Sub
