Attribute VB_Name = "modRentabilite"
' ============================================================
'  modRentabilite - Parametrage de la rentabilite du kit E85
' ============================================================
'  Installe (idempotent) sur la feuille "Suivi Carburant" :
'   - le bloc "COUT DE CONVERSION" (M5:O14) : postes de cout one-off
'     (pose, carte grise, entretien, assurance, aide deduite) + cout total,
'     carburant de reference (ecart EUR/L) et N pleins recents (projection) ;
'   - les Names classeur associes (COUT_BOITIER, COUT_POSE, ... PROJ_NB_RECENTS) ;
'   - le recablage des formules de rentabilite (equiv ref, reste a amortir,
'     progression, surconso gardee, date mediane + marge).
'
'  SECURITE DONNEES : strictement additif. Les valeurs par defaut ne sont
'  ecrites QUE si la cellule est vide (preserve les saisies utilisateur au
'  re-run). Aucune suppression de ligne/donnee. Feuille deprotegee/reprotegee.
'
'  Point d'entree : InstallerParametresRentabilite (re-executable).
'  Conventions : modValidation (G1/G5), modSyncGS.EnsureGSHeaders (X48).
Option Explicit

Private Const WS_SUIVI As String = "Suivi Carburant"

'--- Point d'entree unique, re-executable -----------------------------------
Public Sub InstallerParametresRentabilite()
    Dim ws As Worksheet
    Set ws = SheetSuivi()
    If ws Is Nothing Then
        MsgBox "Feuille '" & WS_SUIVI & "' introuvable.", vbExclamation
        Exit Sub
    End If

    Dim wasProtected As Boolean: wasProtected = ws.ProtectContents
    UnprotectSuivi ws

    EnsureCostBlock ws

    If wasProtected Then ReprotectSuivi ws
    ThisWorkbook.Save
    Application.StatusBar = "[Rentabilite] " & ChrW(10003) & " Parametres installes/verifies."
End Sub

'--- Task 1 : bloc COUT DE CONVERSION + Names + COUT_TOTAL -------------------
Private Sub EnsureCostBlock(ws As Worksheet)
    ' Bloc en 3e colonne du panneau parametres : M=libelle, N=valeur, O=note.
    ' Lignes 5..14 (verifiees libres hors table des pleins qui commence L16).
    SetLabel ws, 5, 13, "COUT DE CONVERSION", True
    SetLabel ws, 6, 13, "Pose / main-d'" & ChrW(339) & "uvre (" & ChrW(8364) & ")", False
    SetLabel ws, 7, 13, "Modification carte grise (" & ChrW(8364) & ")", False
    SetLabel ws, 8, 13, "Entretiens suppl" & ChrW(233) & "mentaires (" & ChrW(8364) & ")", False
    SetLabel ws, 9, 13, "Surco" & ChrW(251) & "t d'assurance (" & ChrW(8364) & ")", False
    SetLabel ws, 10, 13, "Aide / subvention d" & ChrW(233) & "duite (" & ChrW(8364) & ")", False
    SetLabel ws, 11, 13, "CO" & ChrW(219) & "T TOTAL conversion (" & ChrW(8364) & ")", True
    SetLabel ws, 12, 13, "Carburant de r" & ChrW(233) & "f" & ChrW(233) & "rence", False
    SetLabel ws, 13, 13, "" & ChrW(201) & "cart r" & ChrW(233) & "f. vs SP98 (" & ChrW(8364) & "/L)", False
    SetLabel ws, 14, 13, "Nb pleins r" & ChrW(233) & "cents (projection)", False

    ' Valeurs par defaut - UNIQUEMENT si la cellule est vide (preserve saisies)
    SetDefaultNum ws, 6, 14, 0        ' N6  pose
    SetDefaultNum ws, 7, 14, 0        ' N7  carte grise
    SetDefaultNum ws, 8, 14, 0        ' N8  entretien
    SetDefaultNum ws, 9, 14, 0        ' N9  assurance
    SetDefaultNum ws, 10, 14, 0       ' N10 aide deduite
    SetDefaultStr ws, 12, 14, "SP98"  ' N12 carburant de reference (informatif)
    SetDefaultNum ws, 13, 14, 0       ' N13 ecart ref EUR/L
    SetDefaultNum ws, 14, 14, 6       ' N14 N pleins recents

    ' Notes (colonne O) - libelles d'aide, ecrasables
    SetLabel ws, 6, 15, ChrW(8592) & " 0 si pose DIY", False
    SetLabel ws, 10, 15, ChrW(8592) & " soustraite du total", False
    SetLabel ws, 11, 15, ChrW(8592) & " bo" & ChrW(238) & "tier + postes " & ChrW(8722) & " aide", False
    SetLabel ws, 13, 15, ChrW(8592) & " 0 = comparer au SP98", False

    ' Names classeur (crees si absents)
    EnsureName "COUT_BOITIER", "$B$6"
    EnsureName "COUT_POSE", "$N$6"
    EnsureName "COUT_CARTEGRISE", "$N$7"
    EnsureName "COUT_ENTRETIEN", "$N$8"
    EnsureName "SURCOUT_ASSURANCE", "$N$9"
    EnsureName "AIDE_DEDUITE", "$N$10"
    EnsureName "COUT_TOTAL", "$N$11"
    EnsureName "CARBURANT_REF", "$N$12"
    EnsureName "ECART_REF", "$N$13"
    EnsureName "PROJ_NB_RECENTS", "$N$14"

    ' Formule cout total (Formula2 : evite l'intersection implicite @)
    ws.Range("N11").Formula2 = _
        "=MAX(0,COUT_BOITIER+COUT_POSE+COUT_CARTEGRISE+COUT_ENTRETIEN+SURCOUT_ASSURANCE-AIDE_DEDUITE)"

    ' Relabel du poste boitier dans le bloc parametres de gauche (A6)
    ws.Range("A6").value = "Co" & ChrW(251) & "t du bo" & ChrW(238) & "tier (kit) (" & ChrW(8364) & ")"
End Sub

'--- Helpers ----------------------------------------------------------------
Private Function SheetSuivi() As Worksheet
    On Error Resume Next
    Set SheetSuivi = ThisWorkbook.Worksheets(WS_SUIVI)
    On Error GoTo 0
End Function

Private Sub UnprotectSuivi(ws As Worksheet)
    On Error Resume Next
    ws.Unprotect Password:=""
    On Error GoTo 0
End Sub

Private Sub ReprotectSuivi(ws As Worksheet)
    On Error Resume Next
    ws.Protect Password:="", UserInterfaceOnly:=True, _
        DrawingObjects:=False, Contents:=True, Scenarios:=False, _
        AllowFormattingColumns:=True
    On Error GoTo 0
End Sub

' Ecrit un libelle (toujours). bold=True pour titres.
Private Sub SetLabel(ws As Worksheet, r As Long, c As Long, txt As String, bold As Boolean)
    ws.Cells(r, c).value = txt
    ws.Cells(r, c).Font.bold = bold
End Sub

' Ecrit une valeur numerique par defaut UNIQUEMENT si la cellule est vide.
Private Sub SetDefaultNum(ws As Worksheet, r As Long, c As Long, v As Double)
    If IsEmptyCell(ws.Cells(r, c)) Then ws.Cells(r, c).value = v
End Sub

Private Sub SetDefaultStr(ws As Worksheet, r As Long, c As Long, v As String)
    If IsEmptyCell(ws.Cells(r, c)) Then ws.Cells(r, c).value = v
End Sub

Private Function IsEmptyCell(rg As Range) As Boolean
    IsEmptyCell = (Len(CStr(rg.value & "")) = 0)
End Function

' Cree un Name classeur pointant sur "Suivi Carburant"!ref s'il n'existe pas.
Private Sub EnsureName(nm As String, ref As String)
    Dim exists As Boolean: exists = False
    Dim n As Name
    On Error Resume Next
    For Each n In ThisWorkbook.names
        If StrComp(n.name, nm, vbTextCompare) = 0 Then exists = True: Exit For
    Next n
    If Not exists Then
        ThisWorkbook.names.Add name:=nm, _
            RefersTo:="='" & WS_SUIVI & "'!" & ref
    End If
    On Error GoTo 0
End Sub
