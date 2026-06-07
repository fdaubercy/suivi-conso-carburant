VERSION 5.00
Begin {C62A69F0-16DC-11CE-9E98-00AA00574A4F} frmNouveauPlein 
   Caption         =   "Saisissez les données du nouveau plein"
   ClientHeight    =   5220
   ClientLeft      =   120
   ClientTop       =   465
   ClientWidth     =   13755
   OleObjectBlob   =   "frmNouveauPlein.frx":0000
   StartUpPosition =   1  'CenterOwner
End
Attribute VB_Name = "frmNouveauPlein"
Attribute VB_GlobalNameSpace = False
Attribute VB_Creatable = False
Attribute VB_PredeclaredId = True
Attribute VB_Exposed = False
Option Explicit

' -- Flags anti-r?cursion ------------------------------------------
Private bSkipChange  As Boolean
Private bDateTouched As Boolean

' ================================================================
'  INITIALISATION
' ================================================================
Private Sub UserForm_Initialize()
    ' --- Date du jour par défaut ---
    txtDate.value = Format(Date, "dd/mm/yyyy")
    txtDate.MaxLength = 10
    bSkipChange = False
    bDateTouched = False

    ' --- Types de carburant ---
    cmbType.Clear
    cmbType.AddItem "Super 98"
    cmbType.AddItem "SuperEthanol E85"
    cmbType.ListIndex = 0

    ' --- Véhicules (feuille "Vehicules" union GS_Pleins col H) ---
    modSaisie.RemplirCombo Me.cmbVehicule, "Vehicules", 8
    Dim dv As String
    dv = modSaisie.DernierVehicule()       ' pré-sélection du dernier utilisé
    If dv <> "" Then Me.cmbVehicule.value = dv

    ' --- Stations depuis tbl_stationEssence (Notes) ---
    Call ChargerStations

    ' --- Coût total initial ---
    txtCoutTotal.value = "-- " & ChrW(8364)
    txtCoutTotal.Locked = True
    txtCoutTotal.BackColor = RGB(240, 240, 240)
End Sub

' ================================================================
'  CHARGEMENT DE LA LISTE DES STATIONS
' ================================================================
Private Sub ChargerStations()
    Dim ws  As Worksheet
    Dim tbl As ListObject
    Dim r   As ListRow

    cmbStation.Clear

    On Error GoTo PasDeFeuille
    Set ws = ThisWorkbook.Worksheets("Notes")
    On Error GoTo PasDeTableau
    Set tbl = ws.ListObjects("tbl_stationEssence")
    On Error GoTo 0

    For Each r In tbl.ListRows
        Dim val As String
        val = Trim(r.Range.Cells(1, 1).value)
        If val <> "" Then cmbStation.AddItem val
    Next r
    Exit Sub

PasDeFeuille:
    Exit Sub
PasDeTableau:
    ' Fallback : stations en dur
    cmbStation.AddItem "Carrefour Flers"
    cmbStation.AddItem "Leclerc Douai"
    cmbStation.AddItem "Leclerc Drive Beuvry"
    cmbStation.AddItem "Total Waziers"
End Sub

' ================================================================
'  DATE ? Auto-format jj/mm/aaaa
' ================================================================
Private Sub txtDate_Enter()
    If bDateTouched Then
        txtDate.value = ""
    End If
    bDateTouched = True
End Sub

Private Sub txtDate_Change()
    If bSkipChange Then Exit Sub
    bSkipChange = True

    Dim raw As String
    raw = Replace(Replace(txtDate.value, "/", ""), "-", "")
    raw = Join(Filter(Split(raw, " "), True), "") ' supprime espaces

    Dim chiffres As String
    Dim i As Integer
    For i = 1 To Len(raw)
        If Mid(raw, i, 1) >= "0" And Mid(raw, i, 1) <= "9" Then
            chiffres = chiffres & Mid(raw, i, 1)
        End If
    Next i
    If Len(chiffres) > 8 Then chiffres = Left(chiffres, 8)

    Dim formatted As String
    Select Case Len(chiffres)
        Case 0 To 2:  formatted = chiffres
        Case 3 To 4:  formatted = Left(chiffres, 2) & "/" & Mid(chiffres, 3)
        Case Else:    formatted = Left(chiffres, 2) & "/" & Mid(chiffres, 3, 2) & "/" & Mid(chiffres, 5)
    End Select

    txtDate.value = formatted
    txtDate.SelStart = Len(formatted)

    bSkipChange = False
End Sub

' ================================================================
'  CO?T TOTAL ? mise ? jour en temps r?el
' ================================================================
Private Sub MajCoutTotal()
    If IsNumeric(Replace(txtLitres.value, ",", ".")) And _
       IsNumeric(Replace(txtPrix.value, ",", ".")) Then
        Dim cout As Double
        cout = ToDouble(txtLitres.value) * ToDouble(txtPrix.value)
        txtCoutTotal.value = Format(cout, "0.00") & " ?"
    Else
        txtCoutTotal.value = "-- ?"
    End If
End Sub

Private Sub txtLitres_Change(): MajCoutTotal: End Sub
Private Sub txtPrix_Change():   MajCoutTotal: End Sub

' ================================================================
'  BOUTON ANNULER
' ================================================================
Private Sub btnAnnuler_Click()
    Unload Me
End Sub

' ================================================================
'  BOUTON ENREGISTRER / VALIDER
' ================================================================
Private Sub btnEnregistrer_Click()
    ' -- Validation (UI conservée) -------------------------------
    If txtDate.value = "" Or Len(Replace(Replace(txtDate.value, "/", ""), "-", "")) < 8 Then
        MsgBox "Date invalide. Format attendu : jj/mm/aaaa", vbExclamation: Exit Sub
    End If
    If Trim(cmbVehicule.value) = "" Then
        MsgBox "Choisissez un vehicule.", vbExclamation: Exit Sub
    End If
    If cmbType.value = "" Then
        MsgBox "Choisissez un type de carburant.", vbExclamation: Exit Sub
    End If
    If Not IsNumeric(Replace(txtKm.value, ",", ".")) Then
        MsgBox "Km compteur invalide.", vbExclamation: Exit Sub
    End If
    If Not IsNumeric(Replace(txtLitres.value, ",", ".")) Then
        MsgBox "Litres invalide.", vbExclamation: Exit Sub
    End If
    If Not IsNumeric(Replace(txtPrix.value, ",", ".")) Then
        MsgBox "Prix " & ChrW(8364) & "/L invalide.", vbExclamation: Exit Sub
    End If

    ' -- Récupération des valeurs --------------------------------
    Dim dateVal    As Date
    Dim stationVal As String
    Dim prixS98Str As String

    dateVal = CDate(txtDate.value)
    stationVal = Trim(cmbStation.value)
    prixS98Str = ""
    If txtPrixS98.value <> "" And IsNumeric(Replace(txtPrixS98.value, ",", ".")) Then
        prixS98Str = txtPrixS98.value
    End If

    ' Véhicule choisi dans la liste (multi-véhicules).
    Dim vehVal As String
    vehVal = Trim(cmbVehicule.value)

    ' -- Détection de doublon (même moteur que frmPleinE85) ------
    If modSaisie.EstDoublon(txtDate.value, txtKm.value, txtLitres.value) Then
        If MsgBox("Un plein identique (date+km+litres) existe deja. Ajouter quand meme ?", _
                  vbYesNo + vbQuestion, "Doublon") = vbNo Then Exit Sub
    End If

    ' -- Enregistrement dans GS_Pleins (même destination + sync) -
    modSaisie.EnregistrerPlein vehVal, cmbType.value, txtDate.value, _
                               txtKm.value, txtLitres.value, txtPrix.value, _
                               stationVal, prixS98Str

    ' -- Gestion de la nouvelle station (comportement conservé) --
    If stationVal <> "" Then
        Call AjouterStationSiInconnue(stationVal)
    End If

    Application.StatusBar = ChrW(10003) & " Plein du " & Format(dateVal, "dd/mm/yyyy") & _
                            " enregistre dans GS_Pleins."
    Application.OnTime now + TimeValue("00:00:04"), "EffacerStatusBar"

    Unload Me
End Sub

' ================================================================
'  HELPER : conversion d?cimale FR/EN
' ================================================================
Private Function ToDouble(ByVal s As String) As Double
    ToDouble = CDbl(Replace(Trim(s), ",", "."))
End Function



