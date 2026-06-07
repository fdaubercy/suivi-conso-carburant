Attribute VB_Name = "modWorkbook"
' ============================================================
'  SUIVI E85 - Accueil a tuiles + Navigation + Demarrage   v1.0.0.0
'  Etape 1/3 du dashboard miroir de l'app PWA.
'
'  - Feuille "Accueil" : tuiles navigables (formes) reproduisant
'    l'ecran d'accueil de l'app (Saisie / Stats / Carte / Historique
'    / Reglages) + raccourcis (Nouveau plein, Dupliquer) + tuile
'    "reprendre" (resume du dernier plein).
'  - Navigation : macros NavXxx (assignees aux tuiles, OnAction).
'  - Demarrage : AfficherVueDeDepart (appelee par Workbook_Open) qui
'    respecte le reglage "Page d'ouverture".
'  - Installer : GO ! installation complete en un clic (dashboard + analyse
'    + graphiques + verification), tolerant, bilan dans Ctrl+G.
'  - InstallerDashboard : monte toutes les feuilles miroir (Reglages +
'    Historique + Carte + Stats + Accueil).
'  - InstallerEtape1 : monte Reglages + Historique + Accueil d'un coup.
'
'  DEPENDANCES :
'    SetStatus (ModuleImportGS), ReglageVal/ReglagePageOuverture/
'    ReglageSetDerniereVue (modReglages). NON redefinies ici.
'    Cibles "Tableau de bord" (Stats, etape 2) et "Carte" (etape 3)
'    peuvent ne pas exister encore -> navigation tolerante.
'
'  RAPPEL : pour la vue de depart automatique, coller le bloc de
'  ThisWorkbook_snippet.bas dans le module "ThisWorkbook".
' ============================================================
Option Explicit

Private Const WS_ACCUEIL As String = "Accueil"
Private Const WS_STATS   As String = "Tableau de bord"   ' cree par modGraphiques (CreerGraphiquesWeb)
Private Const WS_CARTE   As String = "Carte"             ' cree par modCarte (etape 3)
Private Const WS_HIST    As String = "Historique"
Private Const WS_REG     As String = "Reglages"
Private Const WS_DATA    As String = "GS_Pleins"


' ------------------------------------------------------------
'  INSTALLATION COMPLETE DU DASHBOARD (toutes les feuilles miroir)
'  Prerequis : modReglages, modHistorique, modCarte importes
'  (+ modGraphiques pour monter la feuille Stats "Tableau de bord").
'  Cree : Reglages + Historique + Carte + Stats (Tableau de bord) + Accueil.
'  Apres : coller les 3 snippets (ThisWorkbook / Reglages / Carte).
' ------------------------------------------------------------
Public Sub InstallerDashboard()
    Application.ScreenUpdating = False
    On Error GoTo ErrH

    CreerFeuilleReglages           ' modReglages
    CreerFeuilleHistorique         ' modHistorique
    CreerFeuilleCarte              ' modCarte

    ' Stats "Tableau de bord" = modGraphiques.CreerGraphiquesWeb (proprietaire
    ' moderne depuis v4.11 ; l'ancien modDashboard a ete retire). Appel TOLERANT
    ' via Application.Run : aucune dependance de compilation, et un classeur sans
    ' donnees / sans module ne bloque pas la creation des autres feuilles.
    ' silent:=True -> pas de MsgBox bloquante pendant l'installation.
    On Error Resume Next
    Application.Run "CreerGraphiquesWeb", True
    On Error GoTo ErrH

    CreerAccueil                   ' ce module

    ' Bouton "Quitter le plein ecran" sur tous les onglets du dashboard (Affichage).
    On Error Resume Next
    Application.Run "PoserBoutonsPleinEcran"
    On Error GoTo ErrH

    On Error Resume Next
    ThisWorkbook.Sheets(WS_ACCUEIL).Activate
    On Error GoTo 0

    SetStatus "[Dashboard] " & ChrW(10003) & " Reglages + Historique + Carte + Stats + Accueil installes. " & _
              "Collez les snippets ThisWorkbook / Reglages / Carte, puis Debug > Compiler."
    GoTo done
ErrH:
    SetStatus "[Dashboard] " & ChrW(9888) & " Erreur " & Err.Number & " : " & Err.Description
done:
    Application.ScreenUpdating = True
End Sub


' ------------------------------------------------------------
'  GO ! — INSTALLATION COMPLETE EN UN CLIC
'  A lancer (Alt+F8 -> Installer) APRES avoir importe tous les .bas
'  et colle les snippets de feuille. Tolerant : chaque etape est
'  isolee, le bilan detaille s'affiche dans Execution (Ctrl+G) et un
'  resume dans la barre d'etat.
'    1. Dashboard miroir (Reglages/Historique/Carte/Stats/Accueil) ; la feuille
'       Stats (Tableau de bord) est montee via modGraphiques.CreerGraphiquesWeb.
'    2. Analyse (MFC prix + Suivi auto + Tableau2)        [modFeatures]
'    3. Verification finale                               [modFeatures]
' ------------------------------------------------------------
Public Sub Installer()
    Dim rap As String, okN As Long, koN As Long
    Application.ScreenUpdating = False
    rap = "=== GO ! Installation Suivi E85 ===" & vbNewLine

    rap = rap & RunStep("Dashboard miroir + Stats (Reglages/Historique/Carte/Stats/Accueil)", "InstallerDashboard", okN, koN)
    rap = rap & RunStep("Analyse (MFC prix + Suivi auto + Tableau2)", "RafraichirFeatures", okN, koN)
    rap = rap & RunStep("Verification finale", "VerifierInstallation", okN, koN)

    rap = rap & "-------------------------------------------" & vbNewLine
    rap = rap & "Resultat : " & okN & " etape(s) OK / " & koN & " en echec." & vbNewLine
    rap = rap & "Snippets a coller (si pas deja fait) : ThisWorkbook / Reglages / Carte / GS_Pleins."
    Debug.Print rap

    On Error Resume Next
    ThisWorkbook.Sheets(WS_ACCUEIL).Activate
    On Error GoTo 0
    Application.ScreenUpdating = True

    SetStatus "[GO] " & IIf(koN = 0, ChrW(10003) & " Installation terminee (" & okN & " etapes OK).", _
              ChrW(9888) & " " & koN & " etape(s) en echec - voir Ctrl+G.") & _
              " Snippets : ThisWorkbook/Reglages/Carte/GS_Pleins."
End Sub


' ------------------------------------------------------------
'  INSTALLATION GROUPEE - ETAPE 1 (Reglages + Historique + Accueil)
' ------------------------------------------------------------
Public Sub InstallerEtape1()
    Application.ScreenUpdating = False
    On Error GoTo ErrH

    CreerFeuilleReglages           ' modReglages
    CreerFeuilleHistorique         ' modHistorique
    CreerAccueil                   ' ce module

    On Error Resume Next
    ThisWorkbook.Sheets(WS_ACCUEIL).Activate
    On Error GoTo 0

    SetStatus "[Etape 1] " & ChrW(10003) & " Reglages + Historique + Accueil installes. " & _
              "Pensez a coller ThisWorkbook_snippet.bas dans ThisWorkbook."
    GoTo done
ErrH:
    SetStatus "[Etape 1] " & ChrW(9888) & " Erreur " & Err.Number & " : " & Err.Description
done:
    Application.ScreenUpdating = True
End Sub


' ------------------------------------------------------------
'  FEUILLE ACCUEIL (tuiles)
' ------------------------------------------------------------
Public Sub CreerAccueil()
    Dim ws As Worksheet
    Application.ScreenUpdating = False
    On Error GoTo ErrH

    Set ws = GetOrCreateSheet(WS_ACCUEIL)
    ws.Cells.Clear
    Dim shp As Shape
    For Each shp In ws.Shapes: shp.Delete: Next shp

    ws.Tab.color = RGB(27, 58, 92)
    ws.Activate
    On Error Resume Next
    ActiveWindow.DisplayGridlines = False
    On Error GoTo ErrH
    ws.Range("A1").ColumnWidth = 2

    ' -- Bandeau titre --
    With ws.Range("B1")
        .value = Emo(&H26FD&) & " Suivi Conso. Carburants"
        .Font.Size = 20: .Font.bold = True: .Font.color = RGB(27, 58, 92)
    End With
    ws.Rows(1).RowHeight = 40
    With ws.Range("B2")
        .value = "Tableau de bord - copie des onglets de l'application"
        .Font.Italic = True: .Font.color = RGB(107, 114, 128): .Font.Size = 10
    End With

    Dim L0 As Single: L0 = ws.Range("B4").Left
    Dim T0 As Single: T0 = ws.Range("B4").Top

    ' -- Tuile "reprendre" (large) --
    AddTile ws, L0, T0, 520, 46, Emo(&H21A9&) & "  Reprendre   " & DernierPleinResume(), _
            "NavReprendre", RGB(241, 245, 249), RGB(27, 58, 92), 11

    ' -- Raccourcis --
    Dim T1 As Single: T1 = T0 + 58
    AddTile ws, L0, T1, 252, 40, Emo(&H2795&) & "  Nouveau plein", _
            "AccNouveauPlein", RGB(27, 58, 92), vbWhite, 12
    AddTile ws, L0 + 268, T1, 252, 40, Emo(&H1F4CB) & "  Dupliquer le dernier", _
            "AccDupliquerDernier", RGB(46, 117, 182), vbWhite, 12

    ' -- Grille de tuiles principales --
    Dim labels(1 To 5) As String, macros(1 To 5) As String, cols(1 To 5) As Long
    labels(1) = Emo(&H26FD&) & Chr(13) & "Saisie":     macros(1) = "NavSaisie":     cols(1) = RGB(46, 117, 182)
    labels(2) = Emo(&H1F4CA) & Chr(13) & "Stats":      macros(2) = "NavStats":      cols(2) = RGB(29, 158, 117)
    labels(3) = Emo(&H1F5FA) & Chr(13) & "Carte":      macros(3) = "NavCarte":      cols(3) = RGB(217, 119, 6)
    labels(4) = Emo(&H1F4DC) & Chr(13) & "Historique": macros(4) = "NavHistorique": cols(4) = RGB(124, 58, 237)
    labels(5) = Emo(&H2699&) & Chr(13) & "Reglages":   macros(5) = "NavReglages":   cols(5) = RGB(75, 85, 99)

    Dim i As Long, tw As Single, th As Single, gap As Single, t2 As Single
    tw = 150: th = 96: gap = 12: t2 = T1 + 56
    For i = 1 To 5
        AddTile ws, L0 + (i - 1) * (tw + gap), t2, tw, th, labels(i), macros(i), cols(i), vbWhite, 14
    Next i

    ' Bouton "Quitter le plein ecran" (module Affichage, tolerant).
    On Error Resume Next
    Application.Run "AjouterBoutonPleinEcran", ws
    On Error GoTo ErrH

    ws.Range("B1").Select
    SetStatus "[Accueil] " & ChrW(10003) & " Ecran d'accueil cree."
    GoTo done
ErrH:
    SetStatus "[Accueil] " & ChrW(9888) & " Erreur " & Err.Number & " : " & Err.Description
done:
    Application.ScreenUpdating = True
End Sub


' ------------------------------------------------------------
'  NAVIGATION (cibles des tuiles - OnAction)
' ------------------------------------------------------------
Public Sub NavAccueil()
    GoSheet WS_ACCUEIL, "Accueil"
End Sub

Public Sub NavStats()
    ReglageSetDerniereVue "stats"
    GoSheet WS_STATS, "Stats (etape 2)"
End Sub

Public Sub NavCarte()
    ReglageSetDerniereVue "carte"
    GoSheet WS_CARTE, "Carte (etape 3)"
End Sub

Public Sub NavHistorique()
    ReglageSetDerniereVue "historique"
    GoSheet WS_HIST, "Historique"
End Sub

Public Sub NavReglages()
    ReglageSetDerniereVue "reglages"
    GoSheet WS_REG, "Reglages"
End Sub

' Saisie = UserForm (modSaisie). Tolerant si le module n'est pas importe.
Public Sub NavSaisie()
    ReglageSetDerniereVue "saisie"
    On Error Resume Next
    Application.Run "NouveauPlein"
    If Err.Number <> 0 Then SetStatus "[Saisie] " & ChrW(9888) & " Importez modSaisie.bas (macro NouveauPlein)."
    On Error GoTo 0
End Sub

Public Sub AccNouveauPlein()
    On Error Resume Next
    Application.Run "NouveauPlein"
    If Err.Number <> 0 Then SetStatus "[Saisie] " & ChrW(9888) & " Importez modSaisie.bas (macro NouveauPlein)."
    On Error GoTo 0
End Sub

' Etape 1 : ouvre le formulaire (le pre-remplissage avec le dernier plein
' sera cable a l'etape "Saisie"). Voir aussi HistoDupliquerDernier.
Public Sub AccDupliquerDernier()
    AccNouveauPlein
End Sub

' Tuile "reprendre" : va a la derniere vue consultee (Reglages > Reg_DerniereVue).
Public Sub NavReprendre()
    Dim t As String: t = LCase$(CStr(ReglageVal("Reg_DerniereVue")))
    Select Case t
        Case "saisie":     NavSaisie
        Case "stats":      GoSheet WS_STATS, "Stats (etape 2)"
        Case "carte":      GoSheet WS_CARTE, "Carte (etape 3)"
        Case "reglages":   GoSheet WS_REG, "Reglages"
        Case Else:         GoSheet WS_HIST, "Historique"
    End Select
End Sub


' ------------------------------------------------------------
'  DEMARRAGE (appele par Workbook_Open via ThisWorkbook_snippet)
' ------------------------------------------------------------
Public Sub AfficherVueDeDepart()
    On Error Resume Next
    Select Case ReglagePageOuverture()
        Case "saisie"
            GoSheet WS_ACCUEIL, "Accueil"
            Application.Run "NouveauPlein"
        Case "last"
            NavReprendre
        Case Else
            GoSheet WS_ACCUEIL, "Accueil"
    End Select
    On Error GoTo 0
End Sub


' ------------------------------------------------------------
'  HELPERS (prives)
' ------------------------------------------------------------

' Active une feuille ; si elle n'existe pas encore, la CONSTRUIT via son
' createur (auto-reparation). Evite un bouton "mort" quand la feuille manque -
' d'autant que le message en barre d'etat est INVISIBLE en mode plein ecran.
Private Sub GoSheet(nm As String, friendly As String)
    Dim ws As Worksheet
    Dim builder As String
    On Error Resume Next
    Set ws = ThisWorkbook.Sheets(nm)
    On Error GoTo 0

    If ws Is Nothing Then
        builder = BuilderFor(nm)
        If Len(builder) > 0 Then
            On Error Resume Next
            If nm = WS_STATS Then
                Application.Run builder, True   ' CreerGraphiquesWeb(silent:=True)
            Else
                Application.Run builder
            End If
            Set ws = ThisWorkbook.Sheets(nm)
            On Error GoTo 0
        End If
    End If

    If ws Is Nothing Then
        SetStatus "[Navigation] " & ChrW(9888) & " '" & friendly & "' indisponible (module createur non importe ?)."
        Exit Sub
    End If
    ws.Activate
    ws.Range("A1").Select
End Sub

' Createur de feuille associe a un nom d'onglet (auto-reparation de la nav).
Private Function BuilderFor(ByVal nm As String) As String
    Select Case nm
        Case WS_REG:     BuilderFor = "CreerFeuilleReglages"     ' modReglages
        Case WS_HIST:    BuilderFor = "CreerFeuilleHistorique"   ' modHistorique
        Case WS_CARTE:   BuilderFor = "CreerFeuilleCarte"        ' modCarte
        Case WS_STATS:   BuilderFor = "CreerGraphiquesWeb"       ' modGraphiques (silent)
        Case WS_ACCUEIL: BuilderFor = "CreerAccueil"             ' ce module
        Case Else:       BuilderFor = ""
    End Select
End Function

' Resume court du dernier plein de GS_Pleins (pour la tuile "reprendre").
Private Function DernierPleinResume() As String
    Dim lo As ListObject, data As Variant, n As Long
    Dim bestRow As Long, bestKey As Double, k As Double, r As Long
    On Error GoTo Fallback

    Set lo = GetDataTable()
    If lo Is Nothing Then DernierPleinResume = "(aucune donnee)": Exit Function
    If lo.DataBodyRange Is Nothing Then DernierPleinResume = "(aucun plein)": Exit Function

    data = lo.DataBodyRange.value
    n = UBound(data, 1)
    bestRow = 1: bestKey = -1
    For r = 1 To n
        k = 0
        If IsDate(data(r, 1)) Then          ' Horodatage
            k = CDbl(CDate(data(r, 1)))
        ElseIf IsDate(data(r, 2)) Then      ' Date
            k = CDbl(CDate(data(r, 2)))
        End If
        If k >= bestKey Then
            bestKey = k: bestRow = r
        End If
    Next r

    Dim d As String, lit As String, sta As String
    d = ""
    If IsDate(data(bestRow, 2)) Then d = Format$(CDate(data(bestRow, 2)), "dd/mm/yyyy")
    lit = ""
    If IsNumeric(data(bestRow, 5)) Then lit = Format$(CDbl(data(bestRow, 5)), "0.00") & " L"
    sta = CStr(data(bestRow, 7))

    DernierPleinResume = Trim$(d & "  " & ChrW(183) & "  " & lit & IIf(sta <> "", "  " & ChrW(183) & "  " & sta, ""))
    Exit Function
Fallback:
    DernierPleinResume = ""
End Function

Private Function GetDataTable() As ListObject
    Dim dataWs As Worksheet
    On Error Resume Next
    Set dataWs = ThisWorkbook.Sheets(WS_DATA)
    On Error GoTo 0
    If dataWs Is Nothing Then Exit Function
    If dataWs.ListObjects.count = 0 Then Exit Function
    Set GetDataTable = dataWs.ListObjects(1)
End Function

' Cree une tuile (forme arrondie cliquable) avec texte centre + macro.
Private Sub AddTile(ws As Worksheet, L As Single, t As Single, w As Single, h As Single, _
                    txt As String, macro As String, fill As Long, fcolor As Long, fsize As Single)
    Dim sh As Shape
    Set sh = ws.Shapes.AddShape(msoShapeRoundedRectangle, L, t, w, h)
    With sh
        .fill.ForeColor.RGB = fill
        .Line.Visible = msoFalse
        With .TextFrame2
            .TextRange.text = txt
            .TextRange.Font.fill.ForeColor.RGB = fcolor
            .TextRange.Font.bold = msoTrue
            .TextRange.Font.Size = fsize
            .TextRange.ParagraphFormat.Alignment = msoAlignCenter
            .HorizontalAnchor = msoAnchorCenter
            .VerticalAnchor = msoAnchorMiddle
            .WordWrap = msoTrue
        End With
        .OnAction = macro
    End With
End Sub

Private Function GetOrCreateSheet(nm As String) As Worksheet
    On Error Resume Next
    Set GetOrCreateSheet = ThisWorkbook.Sheets(nm)
    On Error GoTo 0
    If GetOrCreateSheet Is Nothing Then
        Set GetOrCreateSheet = ThisWorkbook.Sheets.Add(After:=ThisWorkbook.Sheets(ThisWorkbook.Sheets.count))
        GetOrCreateSheet.name = nm
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

' Execute une macro par son nom (tolerant) et renvoie une ligne de bilan.
' Met a jour les compteurs OK / echec passes par reference. Sert a la macro
' maitre Installer : une etape en echec (module non importe, donnees absentes...)
' n'interrompt pas les suivantes.
Private Function RunStep(label As String, macroName As String, ByRef okN As Long, ByRef koN As Long) As String
    On Error Resume Next
    Err.Clear
    Application.Run macroName
    If Err.Number = 0 Then
        okN = okN + 1
        RunStep = "[OK] " & label & vbNewLine
    Else
        koN = koN + 1
        RunStep = "[X] " & label & " -> err " & Err.Number & " : " & Err.Description & vbNewLine
    End If
    Err.Clear
    On Error GoTo 0
End Function


