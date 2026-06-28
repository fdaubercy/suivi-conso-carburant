Attribute VB_Name = "modSplash"
Option Explicit

' ============================================================
'  modSplash (X60) -- ecran d'attente au demarrage
'  UserForm modeless plein cadre (logo + libelle d'etape + barre de
'  progression) affiche en tete de Workbook_Open, ferme a la fin.
'  Progression PAR ETAPES (VBA mono-thread -> pas d'animation
'  continue) ; pas de moteur web embarque (WebBrowser ActiveX retire
'  sur Win11/Office recent). Fermeture coordonnee sur les 3 taches
'  differees (import / rebuild / sync) + fermeture de securite via
'  SplashForceClose (OnTime) si une tache n'a pas rendu la main.
' ============================================================

Private Const NB_ETAPES As Long = 9      ' 6 synchrones + 3 differees

Private mShown As Boolean
Private mImport As Boolean
Private mRebuild As Boolean
Private mSync As Boolean

' Affiche le splash modeless (Workbook_Open garde la main).
Public Sub SplashShow()
    On Error Resume Next
    mShown = False: mImport = False: mRebuild = False: mSync = False
    frmSplash.SetEtape "Initialisation...", 0
    frmSplash.Show vbModeless
    mShown = True
    DoEvents
    On Error GoTo 0
End Sub

' Met a jour le libelle + la barre. n = numero d'etape (1..NB_ETAPES).
Public Sub SplashStep(ByVal n As Long, ByVal libelle As String)
    On Error Resume Next
    If Not mShown Then Exit Sub
    frmSplash.SetEtape libelle, CDbl(n) / CDbl(NB_ETAPES)
    DoEvents
    On Error GoTo 0
End Sub

' Ferme le splash (idempotent).
Public Sub SplashClose()
    On Error Resume Next
    If mShown Then Unload frmSplash
    mShown = False
    On Error GoTo 0
End Sub

' --- Marqueurs de fin des taches differees -----------------
Public Sub SplashMarkImport()
    mImport = True
    SplashStep 7, "Import des nouveaux pleins termine."
    SplashTryClose
End Sub

Public Sub SplashMarkRebuild()
    mRebuild = True
    SplashStep 8, "Tableau de bord reconstruit."
    SplashTryClose
End Sub

Public Sub SplashMarkSync()
    mSync = True
    SplashStep 9, "Synchronisation Google Sheets terminee."
    SplashTryClose
End Sub

Private Sub SplashTryClose()
    If mImport And mRebuild And mSync Then SplashClose
End Sub

' Fermeture de securite (planifiee via Application.OnTime).
Public Sub SplashForceClose()
    SplashClose
End Sub

' --- Apercu / verification (Alt+F8 : SplashDemo) -----------
Public Sub SplashDemo()
    SplashShow
    SplashStep 1, "Affichage plein ecran...": SplashWait 0.4
    SplashStep 2, "Import des nouveaux pleins programme...": SplashWait 0.4
    SplashStep 3, "Formatage des dates...": SplashWait 0.4
    SplashStep 4, "Synchro Google Sheets programmee...": SplashWait 0.4
    SplashStep 5, "Protection de la feuille...": SplashWait 0.4
    SplashStep 6, "Vue de depart + barre de navigation...": SplashWait 0.5
    SplashStep 7, "Import des nouveaux pleins termine.": SplashWait 0.4
    SplashStep 8, "Tableau de bord reconstruit.": SplashWait 0.4
    SplashStep 9, "Synchronisation Google Sheets terminee.": SplashWait 0.7
    SplashClose
End Sub

Private Sub SplashWait(ByVal sec As Double)
    Dim t As Double: t = Timer
    Do While Timer < t + sec
        DoEvents
    Loop
End Sub
