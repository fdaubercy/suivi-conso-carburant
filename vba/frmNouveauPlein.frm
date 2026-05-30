VERSION 5.00
Begin {C62A69F0-16DC-11CE-9E98-00AA00574A4F} frmNouveauPlein 
   Caption         =   "Saisissez les donn�es du nouveau plein"
   ClientHeight    =   4590
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

' -- Flags anti-r�cursion ------------------------------------------
Private bSkipChange  As Boolean
Private bDateTouched As Boolean

' ================================================================
'  INITIALISATION
' ================================================================
Private Sub UserForm_Initialize()
    ' --- Date du jour par d�faut ---
    txtDate.Value = Format(Date, "dd/mm/yyyy")
    txtDate.MaxLength = 10
    bSkipChange = False
    bDateTouched = False

    ' --- Types de carburant ---
    cmbType.Clear
    cmbType.AddItem "Super 98"
    cmbType.AddItem "SuperEthanol E85"
    cmbType.ListIndex = 0

    ' --- Vehicules (feuille "Vehicules" union GS_Pleins col H) ---
    modSaisie.RemplirCombo Me.cmbVehicule, "Vehicules", 8
    Dim dv As String
    dv = modSaisie.DernierVehicule()       ' pre-selection du dernier utilise
    If dv <> "" Then Me.cmbVehicule.Value = dv

    ' --- Stations depuis tbl_stationEssence (Notes) ---
    Call ChargerStations

    ' --- Co�t total initial ---
    txtCoutTotal.Value = "-- �"
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
        val = Trim(r.Range.Cells(1, 1).Value)
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
'  DATE � Auto-format jj/mm/aaaa
' ================================================================
Private Sub txtDate_Enter()
    If bDateTouched Then
        txtDate.Value = ""
    End If
    bDateTouched = True
End Sub

Private Sub txtDate_Change()
    If bSkipChange Then Exit Sub
    bSkipChange = True

    Dim raw As String
    raw = Replace(Replace(txtDate.Value, "/", ""), "-", "")
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

    txtDate.Value = formatted
    txtDate.SelStart = Len(formatted)

    bSkipChange = False
End Sub

' ================================================================
'  CO�T TOTAL � mise � jour en temps r�el
' ================================================================
Private Sub MajCoutTotal()
    If IsNumeric(Replace(txtLitres.Value, ",", ".")) And _
       IsNumeric(Replace(txtPrix.Value, ",", ".")) Then
        Dim cout As Double
        cout = ToDouble(txtLitres.Value) * ToDouble(txtPrix.Value)
        txtCoutTotal.Value = Format(cout, "0.00") & " �"
    Else
        txtCoutTotal.Value = "-- �"
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
    ' -- Validation (UI conservee) -------------------------------
    If txtDate.Value = "" Or Len(Replace(Replace(txtDate.Value, "/", ""), "-", "")) < 8 Then
        MsgBox "Date invalide. Format attendu : jj/mm/aaaa", vbExclamation: Exit Sub
    End If
    If Trim(cmbVehicule.Value) = "" Then
        MsgBox "Choisissez un vehicule.", vbExclamation: Exit Sub
    End If
    If cmbType.Value = "" Then
        MsgBox "Choisissez un type de carburant.", vbExclamation: Exit Sub
    End If
    If Not IsNumeric(Replace(txtKm.Value, ",", ".")) Then
        MsgBox "Km compteur invalide.", vbExclamation: Exit Sub
    End If
    If Not IsNumeric(Replace(txtLitres.Value, ",", ".")) Then
        MsgBox "Litres invalide.", vbExclamation: Exit Sub
    End If
    If Not IsNumeric(Replace(txtPrix.Value, ",", ".")) Then
        MsgBox "Prix " & ChrW(8364) & "/L invalide.", vbExclamation: Exit Sub
    End If

    ' -- Recuperation des valeurs --------------------------------
    Dim dateVal    As Date
    Dim stationVal As String
    Dim prixS98Str As String

    dateVal = CDate(txtDate.Value)
    stationVal = Trim(cmbStation.Value)
    prixS98Str = ""
    If txtPrixS98.Value <> "" And IsNumeric(Replace(txtPrixS98.Value, ",", ".")) Then
        prixS98Str = txtPrixS98.Value
    End If

    ' Vehicule choisi dans la liste (multi-vehicules).
    Dim vehVal As String
    vehVal = Trim(cmbVehicule.Value)

    ' -- Detection de doublon (meme moteur que frmPleinE85) ------
    If modSaisie.EstDoublon(txtDate.Value, txtKm.Value, txtLitres.Value) Then
        If MsgBox("Un plein identique (date+km+litres) existe deja. Ajouter quand meme ?", _
                  vbYesNo + vbQuestion, "Doublon") = vbNo Then Exit Sub
    End If

    ' -- Enregistrement dans GS_Pleins (meme destination + sync) -
    '    Horodatage + sync_id UUID generes par EnregistrerPlein ;
    '    prix S98 du jour -> col J "SP98 station (EUR/L)".
    modSaisie.EnregistrerPlein vehVal, cmbType.Value, txtDate.Value, _
                               txtKm.Value, txtLitres.Value, txtPrix.Value, _
                               stationVal, prixS98Str

    ' -- Gestion de la nouvelle station (comportement conserve) --
    If stationVal <> "" Then
        Call AjouterStationSiInconnue(stationVal)
    End If

    Application.StatusBar = ChrW(10003) & " Plein du " & Format(dateVal, "dd/mm/yyyy") & _
                            " enregistre dans GS_Pleins."
    Application.OnTime Now + TimeValue("00:00:04"), "EffacerStatusBar"

    Unload Me
End Sub

' ================================================================
'  HELPER : conversion d�cimale FR/EN
' ================================================================
Private Function ToDouble(ByVal s As String) As Double
    ToDouble = CDbl(Replace(Trim(s), ",", "."))
End Function

