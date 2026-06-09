Attribute VB_Name = "modCharte"
' ============================================================
'  MODULE : modCharte  —  Charte graphique
'  Lit les couleurs depuis les cellules nommees C_* de la feuille
'  Reglages. L'admin change la couleur de remplissage de la cellule
'  via l'outil Excel "Couleur de remplissage", puis clique
'  "Appliquer la charte" pour propager les nouvelles couleurs.
'
'  Usage : CharteColor("Primaire") -> couleur courante ou defaut
'          AppliquerCharte         -> reconstruit la sidebar + dashboard
' ============================================================
Option Explicit

' Retourne la couleur de la charte pour un nom donne.
' Lit Interior.Color de la cellule nommee "C_{nm}" si elle existe
' et a un remplissage non vide ; sinon renvoie le defaut codé en dur.
Public Function CharteColor(ByVal nm As String) As Long
    Dim c As Long: c = DefaultColor(nm)
    On Error Resume Next
    Dim rng As Range
    Set rng = ThisWorkbook.Names("C_" & nm).RefersToRange
    If Not rng Is Nothing Then
        If rng.Interior.ColorIndex <> xlColorIndexNone Then
            c = rng.Interior.Color
        End If
    End If
    On Error GoTo 0
    CharteColor = c
End Function

Private Function DefaultColor(ByVal nm As String) As Long
    Select Case nm
        Case "Primaire": DefaultColor = RGB(27, 58, 92)
        Case "Vert":     DefaultColor = RGB(29, 158, 117)
        Case "Ambre":    DefaultColor = RGB(240, 165, 0)
        Case "Rouge":    DefaultColor = RGB(226, 75, 74)
        Case "Texte":    DefaultColor = RGB(26, 26, 26)
        Case "Subtil":   DefaultColor = RGB(107, 114, 128)
        Case Else:       DefaultColor = RGB(27, 58, 92)
    End Select
End Function

' Applique les couleurs de la charte a la sidebar et au dashboard.
Public Sub AppliquerCharte()
    Application.ScreenUpdating = False
    On Error GoTo ErrH

    ' 1) Reconstruire la sidebar avec les nouvelles couleurs
    On Error Resume Next
    modSidebar.PoserSidebarSurTousLesOnglets
    modSidebar.MarquerOngletActif
    On Error GoTo ErrH

    ' 2) Relancer le dashboard pour appliquer les couleurs primaires
    On Error Resume Next
    MAJ_Dashboard_Graphiques
    On Error GoTo ErrH

    Application.StatusBar = "[Charte] Couleurs appliquees."
    GoTo Done
ErrH:
    Application.StatusBar = "[Charte] Erreur " & Err.Number & " : " & Err.Description
Done:
    Application.ScreenUpdating = True
End Sub

' Utilitaire : assombrit ou eclaircit une couleur RGB.
' factor > 1 = eclaircit, factor < 1 = assombrit.
Public Function Assombrir(ByVal c As Long, ByVal factor As Double) As Long
    Dim r As Long, g As Long, b As Long
    r = c Mod 256
    g = (c \ 256) Mod 256
    b = (c \ 65536) Mod 256
    r = Application.Min(255, CLng(r * factor))
    g = Application.Min(255, CLng(g * factor))
    b = Application.Min(255, CLng(b * factor))
    Assombrir = RGB(r, g, b)
End Function
