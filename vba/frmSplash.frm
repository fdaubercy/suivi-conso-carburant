VERSION 5.00
Begin {C62A69F0-16DC-11CE-9E98-00AA00574A4F} frmSplash 
   Caption         =   "Chargement..."
   ClientHeight    =   3615
   ClientLeft      =   120
   ClientTop       =   465
   ClientWidth     =   6960
   OleObjectBlob   =   "frmSplash.frx":0000
   ShowModal       =   0   'False
   StartUpPosition =   2  'CenterScreen
End
Attribute VB_Name = "frmSplash"
Attribute VB_GlobalNameSpace = False
Attribute VB_Creatable = False
Attribute VB_PredeclaredId = True
Attribute VB_Exposed = False
Option Explicit

Private Sub UserForm_Initialize()
    On Error Resume Next
    Me.lblLogo.caption = ChrW(&H26FD)   ' embleme pompe a essence
    On Error GoTo 0
End Sub

Public Sub SetEtape(ByVal libelle As String, ByVal ratio As Double)
    On Error Resume Next
    If ratio < 0 Then ratio = 0
    If ratio > 1 Then ratio = 1
    Me.lblEtape.caption = libelle
    Me.lblBarre.Width = Me.lblTrack.Width * ratio
    Me.lblPct.caption = Format$(ratio, "0%")
    Me.Repaint
    On Error GoTo 0
End Sub

Private Sub UserForm_QueryClose(Cancel As Integer, CloseMode As Integer)
    If CloseMode = vbFormControlMenu Then Cancel = True
End Sub
