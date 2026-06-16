VERSION 1.0 CLASS
BEGIN
  MultiUse = -1  'True
END
Attribute VB_Name = "ThisWorkbook"
Attribute VB_GlobalNameSpace = False
Attribute VB_Creatable = False
Attribute VB_PredeclaredId = True
Attribute VB_Exposed = True
Option Explicit

' ============================================================
'  Module ThisWorkbook -- v2.8.0.0
'  v2.8 : etapes d'ouverture affichees dans la barre d'etat
'         (Application.StatusBar + DoEvents). Les operations
'         lourdes restent differees (import +2s, synchro +5s).
'  NB : les add-ins du dossier XLSTART se chargent AVANT cet
'       evenement -> leur temps n'est pas visible ici.
' ============================================================

Private Sub Workbook_Open()
    Application.StatusBar = "Ouverture 1/6 : affichage plein ecran..."
    DoEvents
    Call ActiverPleinEcran
    Application.OnKey "^{F11}", "BasculerPleinEcran"

    ' Import rapide des nouveaux pleins (~2s) : donnees fraiches visibles vite.
    Application.StatusBar = "Ouverture 2/6 : import des nouveaux pleins programme (+2s)..."
    DoEvents
    Application.OnTime now + TimeValue("00:00:02"), "ImporterNouveauxPleinsAuto"

    Application.StatusBar = "Ouverture 3/6 : formatage des dates..."
    DoEvents
    ForceFormatDates

    ' Synchro Google Sheets DIFFEREE : Workbook_Open rend la main immediatement
    ' (classeur visible et interactif tout de suite) ; la synchro reseau lourde
    ' (~30s, bidirectionnelle + refresh Power Query) est repoussee a +5s.
    Application.StatusBar = "Ouverture 4/6 : synchro Google Sheets programmee (+5s)..."
    DoEvents
    Application.OnTime now + TimeValue("00:00:05"), "SyncOnOpen"

    Application.StatusBar = "Ouverture 5/6 : protection de la feuille..."
    DoEvents
    ThisWorkbook.Sheets("Suivi Carburant").Protect _
        Password:="", _
        UserInterfaceOnly:=True, _
        DrawingObjects:=False, Contents:=True, Scenarios:=False, _
        AllowFormattingColumns:=True
    ThisWorkbook.Sheets("Suivi Carburant").Columns("Z").Hidden = True
    ThisWorkbook.Sheets("Suivi Carburant").Columns("AA").Hidden = True

    Application.StatusBar = "Ouverture 6/6 : vue de depart + barre de navigation..."
    DoEvents
    On Error Resume Next
    AfficherVueDeDepart
    On Error GoTo 0

    On Error Resume Next
    modSidebar.ShowSidebar
    On Error GoTo 0

    Application.OnTime now + TimeValue("00:00:03"), "SyncFiltersAndRebuildOnOpen"
    Application.StatusBar = "Classeur pret. (Import +2s, synchro Google Sheets +5s en arriere-plan.)"
End Sub

Private Sub Workbook_SheetActivate(ByVal sh As Object)
    On Error Resume Next
    AutoZoomFitCols
    On Error GoTo 0
    On Error Resume Next
    modSidebar.RepositionSidebar
    On Error GoTo 0
End Sub

Private Sub Workbook_BeforeClose(Cancel As Boolean)
    On Error Resume Next
    modSidebar.HideSidebar
    On Error GoTo 0
    Call DesactiverPleinEcran
End Sub

Private Sub Workbook_SheetPivotTableUpdate(ByVal sh As Object, ByVal Target As PivotTable)
    On Error Resume Next
    If Target.name = "ptFiltres" Then modFiltres.ApplyFiltersFromControls
    On Error GoTo 0
End Sub



