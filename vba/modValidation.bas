Attribute VB_Name = "modValidation"
Option Explicit
' ============================================================
'  G1 : listes deroulantes (data validation) sur la saisie
' ============================================================
' Pose des listes deroulantes sur les colonnes Type / Station essence /
' Vehicule du tableau de saisie (Suivi Carburant!Tableau2), alimentees par
' les tables de reference de l'onglet Notes :
'   Type            -> tbl_carburant       (colonne B, "Type carburant")
'   Station essence -> tbl_stationEssence  (colonne D)
'   Vehicule        -> tbl_vehicule        (colonne J, creee si absente)
' Les sources sont exposees via des plages nommees pointant sur le corps des
' tables (=tbl_xxx) -> la liste suit l'ajout de valeurs sans re-parametrage.
' Data validation en
' mode AVERTISSEMENT (xlValidAlertWarning) : la dropdown guide la saisie mais
' n'interdit pas une valeur nouvelle (nouvelle station, etc.). Les ecritures
' programmatiques (import GS / Excel) ne sont jamais bloquees par la validation.
' Feuille de saisie protegee -> deverrouillage autour de l'operation
' (ModuleImportGS.DeverrouillerSuivi / VerrouillerSuivi).
' Reexecutable a volonte (idempotent).

Private Const WS_SAISIE As String = "Suivi Carburant"
Private Const WS_NOTES  As String = "Notes"
Private Const T_SAISIE  As String = "Tableau2"
Private Const T_VEHIC   As String = "tbl_vehicule"

Public Sub InstallerValidationsSaisie()
    Dim wsN As Worksheet, wsS As Worksheet
    Set wsN = ThisWorkbook.Worksheets(WS_NOTES)
    Set wsS = ThisWorkbook.Worksheets(WS_SAISIE)

    ' 1) Table vehicules (source de la dropdown Vehicule)
    EnsureVehiculeTable wsN, wsS

    ' 2) Plages nommees vers le CORPS des tables de reference. Une reference au
    '    nom de table seul (=tbl_xxx) resout son DataBodyRange et SUIT sa taille
    '    -> dynamique, sans fonction ni separateur d'argument (robuste en locale FR).
    UpsertName "lst_carburant", "=tbl_carburant"
    UpsertName "lst_station", "=tbl_stationEssence"
    UpsertName "lst_vehicule", "=" & T_VEHIC

    ' 3) Application des validations sur le tableau de saisie (feuille protegee)
    ModuleImportGS.DeverrouillerSuivi
    On Error GoTo relock
    Dim lo As ListObject: Set lo = wsS.ListObjects(T_SAISIE)
    ApplyListValidation lo, "Type", "lst_carburant"
    ApplyListValidation lo, "Station essence", "lst_station"
    ApplyListValidation lo, "V" & ChrW(233) & "hicule", "lst_vehicule"
relock:
    ModuleImportGS.VerrouillerSuivi
    On Error GoTo 0
    Application.StatusBar = "Listes deroulantes de saisie installees (Type / Station / Vehicule)."
End Sub

' Applique une data validation liste (mode avertissement) sur toute la colonne
' de donnees d'un ListObject, source = plage nommee nm.
Private Sub ApplyListValidation(lo As ListObject, ByVal colName As String, ByVal nm As String)
    Dim col As ListColumn
    On Error Resume Next
    Set col = lo.ListColumns(colName)
    On Error GoTo 0
    If col Is Nothing Then Exit Sub
    If col.DataBodyRange Is Nothing Then Exit Sub
    With col.DataBodyRange.Validation
        .Delete
        .Add Type:=xlValidateList, AlertStyle:=xlValidAlertWarning, _
             Operator:=xlBetween, Formula1:="=" & nm
        .IgnoreBlank = True
        .InCellDropdown = True
        .ShowInput = False
        .ShowError = True
    End With
End Sub

' Cree ou remplace une plage nommee au niveau classeur.
Private Sub UpsertName(ByVal nm As String, ByVal refersTo As String)
    On Error Resume Next
    ThisWorkbook.Names(nm).Delete
    On Error GoTo 0
    ThisWorkbook.Names.Add Name:=nm, RefersTo:=refersTo
End Sub

' Garantit la presence de tbl_vehicule dans Notes (colonne J), initialisee avec
' les vehicules distincts deja saisis. Ne touche pas si la table existe deja.
Private Sub EnsureVehiculeTable(wsN As Worksheet, wsS As Worksheet)
    Dim lo As ListObject
    On Error Resume Next
    Set lo = wsN.ListObjects(T_VEHIC)
    On Error GoTo 0
    If Not lo Is Nothing Then Exit Sub

    ' Vehicules distincts depuis la saisie
    Dim d As Object: Set d = CreateObject("Scripting.Dictionary")
    Dim loS As ListObject: Set loS = wsS.ListObjects(T_SAISIE)
    Dim colV As ListColumn
    On Error Resume Next
    Set colV = loS.ListColumns("V" & ChrW(233) & "hicule")
    On Error GoTo 0
    If Not colV Is Nothing Then
        If Not colV.DataBodyRange Is Nothing Then
            Dim a As Variant: a = colV.DataBodyRange.value
            Dim r As Long, v As String
            If IsArray(a) Then
                For r = 1 To UBound(a, 1)
                    v = Trim$(CStr(a(r, 1)))
                    If Len(v) > 0 Then If Not d.Exists(v) Then d(v) = 1
                Next r
            Else
                v = Trim$(CStr(a))
                If Len(v) > 0 Then d(v) = 1
            End If
        End If
    End If

    ' Ecriture entete + valeurs en colonne J (Notes non protegee)
    wsN.Range(wsN.Cells(2, 10), wsN.Cells(100000, 10)).ClearContents
    wsN.Cells(2, 10).value = "V" & ChrW(233) & "hicule"
    Dim rw As Long: rw = 3
    Dim k As Variant
    For Each k In d.keys
        wsN.Cells(rw, 10).value = CStr(k)
        rw = rw + 1
    Next k
    If d.count = 0 Then wsN.Cells(3, 10).value = "Z900": rw = 4

    Dim rng As Range
    Set rng = wsN.Range(wsN.Cells(2, 10), wsN.Cells(rw - 1, 10))
    wsN.ListObjects.Add(xlSrcRange, rng, , xlYes).Name = T_VEHIC
End Sub
