VERSION 5.00
Begin {C62A69F0-16DC-11CE-9E98-00AA00574A4F} frmPleinE85 
   Caption         =   "? Nouveau plein - Suivi E85"
   ClientHeight    =   6855
   ClientLeft      =   120
   ClientTop       =   465
   ClientWidth     =   6165
   OleObjectBlob   =   "frmPleinE85.frx":0000
   StartUpPosition =   1  'CenterOwner
End
Attribute VB_Name = "frmPleinE85"
Attribute VB_GlobalNameSpace = False
Attribute VB_Creatable = False
Attribute VB_PredeclaredId = True
Attribute VB_Exposed = False
Option Explicit
Private mTypes As String

Private Sub UserForm_Initialize()
    mTypes = "SuperEthanol E85|Super 98|Sans Plomb 95|Sans Plomb E10|Gazole|GPLc"
    Dim arr() As String, i As Long
    arr = Split(mTypes, "|")
    For i = 0 To UBound(arr): Me.cboType.AddItem arr(i): Next i
    modSaisie.RemplirCombo Me.cboVehicule, "Vehicules", 8
    modSaisie.RemplirCombo Me.cboStation, "Stations", 7
    Me.txtDate.value = Format(Date, "dd/mm/yyyy")
    If Me.cboType.ListCount > 0 Then Me.cboType.ListIndex = 0
    Me.cboVehicule.SetFocus
End Sub

Private Sub txtLitres_Change(): MajCout: End Sub
Private Sub txtPrix_Change(): MajCout: End Sub
Private Sub txtKm_Change(): VerifKm: End Sub
Private Sub cboVehicule_Change(): VerifKm: End Sub

Private Sub MajCout()
    Dim L As Double, p As Double
    L = modSaisie.ToNum(Me.txtLitres.value)
    p = modSaisie.ToNum(Me.txtPrix.value)
    If L > 0 And p > 0 Then
        Me.lblCout.caption = "Cout : " & Format(L * p, "0.00") & " €"
    Else
        Me.lblCout.caption = "Cout : -"
    End If
End Sub

Private Sub VerifKm()
    Dim km As Double, mx As Double
    km = modSaisie.ToNum(Me.txtKm.value)
    If km <= 0 Or Me.cboVehicule.value = "" Then Me.lblWarn.caption = "": Exit Sub
    mx = modSaisie.MaxKmVehicule(CStr(Me.cboVehicule.value))
    If mx > 0 And km < mx Then
        Me.lblWarn.caption = ChrW(9888) & " Km inferieur au dernier releve (" & Format(mx, "#,##0") & " km)"
    Else
        Me.lblWarn.caption = ""
    End If
End Sub

Private Sub btnFermer_Click(): Unload Me: End Sub

Private Sub btnAjouter_Click()
    Dim msg As String
    msg = modSaisie.ValiderSaisie(Me.cboVehicule.value, Me.cboType.value, _
          Me.txtDate.value, Me.txtKm.value, Me.txtLitres.value, Me.txtPrix.value)
    If msg <> "" Then
        Me.lblWarn.caption = msg: Exit Sub
    End If
    If modSaisie.EstDoublon(Me.txtDate.value, Me.txtKm.value, Me.txtLitres.value) Then
        If MsgBox("Un plein identique (date+km+litres) existe deja. Ajouter quand meme ?", _
                  vbYesNo + vbQuestion, "Doublon") = vbNo Then Exit Sub
    End If
    modSaisie.EnregistrerPlein Me.cboVehicule.value, Me.cboType.value, _
        Me.txtDate.value, Me.txtKm.value, Me.txtLitres.value, Me.txtPrix.value, Me.cboStation.value
    SetStatus "[Suivi E85] Plein enregistre dans GS_Pleins."
    Unload Me
End Sub


