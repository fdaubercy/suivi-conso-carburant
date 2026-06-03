Attribute VB_Name = "modOutils"
Option Explicit

' ============================================================
'  OUTILS DE DIAGNOSTIC VBA                               v1.0.0.0
'
'  ListerProceduresDupliquees : detecte les procedures PUBLIQUES
'  (Sub / Function / Property) definies dans PLUSIEURS modules ->
'  c'est la cause de l'erreur de compilation "Nom ambigu detecte"
'  (typiquement un module clone "modXxx1" cree par un reimport
'  par-dessus un module deja present). Resultat detaille dans la
'  fenetre Execution (Ctrl+G) + resume en barre d'etat.
'
'  Les procedures Private/Friend sont ignorees : etant locales au
'  module, elles ne provoquent jamais d'ambiguite entre modules.
'
'  PREREQUIS : "Acces approuve au modele objet du projet VBA"
'  (Fichier > Options > Centre de gestion de la confidentialite >
'   Parametres des macros). Deja requis pour generer frmPleinE85.
' ============================================================

Public Sub ListerProceduresDupliquees()
    Dim proj As Object, comp As Object, cm As Object
    Dim dict As Object, mods As Object
    Dim i As Long, nbModules As Long, total As Long, dupNames As Long
    Dim nm As String
    Dim key As Variant

    On Error GoTo NoAccess
    Set proj = Application.VBE.ActiveVBProject
    On Error GoTo 0

    Set dict = CreateObject("Scripting.Dictionary")
    dict.CompareMode = 1   ' TextCompare (VBA insensible a la casse)

    ' --- Collecte : pour chaque procedure publique -> ensemble des modules ---
    For Each comp In proj.VBComponents
        nbModules = nbModules + 1
        Set cm = comp.CodeModule
        For i = 1 To cm.CountOfLines
            nm = ProcNameFromLine(cm.Lines(i, 1))
            If Len(nm) > 0 Then AddProcModule dict, nm, comp.Name
        Next i
    Next comp

    ' --- Rapport ---
    Debug.Print String(55, "=")
    Debug.Print "ListerProceduresDupliquees - " & Now()
    Debug.Print nbModules & " composant(s) VBA analyse(s)."
    Debug.Print String(55, "-")

    For Each key In dict.Keys
        total = total + 1
        Set mods = dict(key)
        If mods.Count >= 2 Then
            dupNames = dupNames + 1
            Debug.Print ChrW(9888) & " " & CStr(key) & "   ->   " & JoinKeys(mods)
        End If
    Next key

    Debug.Print String(55, "-")
    If dupNames = 0 Then
        Debug.Print ChrW(10003) & " Aucun doublon. " & total & " procedure(s) publique(s) distincte(s)."
        SetStatusOutil "[Doublons] " & ChrW(10003) & " Aucun nom ambigu (" & total & " procedures publiques)."
    Else
        Debug.Print dupNames & " nom(s) en double sur " & total & " procedure(s) publique(s)."
        Debug.Print "-> Supprime le module clone (souvent suffixe '1'), garde celui du depot, puis recompile."
        SetStatusOutil "[Doublons] " & ChrW(9888) & " " & dupNames & " nom(s) ambigu(s) - detail dans Ctrl+G."
    End If
    Exit Sub

NoAccess:
    SetStatusOutil "[Doublons] " & ChrW(9888) & " Activez 'Acces approuve au modele objet du projet VBA' " & _
                   "(Fichier > Options > Centre de gestion de la confidentialite > Parametres des macros)."
End Sub


' Ajoute (proc -> module) sans doublon de module : Property Get + Let
' dans le meme module ne compte ce module qu'une fois pour ce nom.
Private Sub AddProcModule(dict As Object, procName As String, moduleName As String)
    Dim mods As Object
    If dict.Exists(procName) Then
        Set mods = dict(procName)
    Else
        Set mods = CreateObject("Scripting.Dictionary")
        mods.CompareMode = 1
        dict.Add procName, mods
    End If
    If Not mods.Exists(moduleName) Then mods.Add moduleName, True
End Sub


' Renvoie le nom de la procedure PUBLIQUE declaree sur cette ligne,
' sinon "". Gere Public/Static + Sub/Function/Property Get|Let|Set.
' Ignore : commentaires, Private/Friend, "Declare" (API), End/Exit.
Private Function ProcNameFromLine(ByVal rawLine As String) As String
    Dim s As String, rest As String, p As Long
    Dim isPrivate As Boolean

    s = Trim$(rawLine)
    If Len(s) = 0 Then Exit Function
    If Left$(s, 1) = "'" Then Exit Function

    ' Retire les modificateurs de tete, un par un.
    Do
        If StartsWithWord(s, "Public") Then
            s = Trim$(Mid$(s, 7))
        ElseIf StartsWithWord(s, "Private") Then
            isPrivate = True
            s = Trim$(Mid$(s, 8))
        ElseIf StartsWithWord(s, "Friend") Then
            isPrivate = True
            s = Trim$(Mid$(s, 7))
        ElseIf StartsWithWord(s, "Static") Then
            s = Trim$(Mid$(s, 7))
        Else
            Exit Do
        End If
    Loop
    If isPrivate Then Exit Function                 ' locale -> jamais ambigue
    If StartsWithWord(s, "Declare") Then Exit Function  ' API -> ignore

    If StartsWithWord(s, "Sub") Then
        rest = Trim$(Mid$(s, 4))
    ElseIf StartsWithWord(s, "Function") Then
        rest = Trim$(Mid$(s, 9))
    ElseIf StartsWithWord(s, "Property") Then
        rest = Trim$(Mid$(s, 9))
        If StartsWithWord(rest, "Get") Then
            rest = Trim$(Mid$(rest, 4))
        ElseIf StartsWithWord(rest, "Let") Then
            rest = Trim$(Mid$(rest, 4))
        ElseIf StartsWithWord(rest, "Set") Then
            rest = Trim$(Mid$(rest, 4))
        Else
            Exit Function
        End If
    Else
        Exit Function
    End If

    ' Le nom va jusqu'au premier "(" ou espace.
    p = InStr(rest, "(")
    If p > 0 Then rest = Left$(rest, p - 1)
    p = InStr(rest, " ")
    If p > 0 Then rest = Left$(rest, p - 1)
    ProcNameFromLine = Trim$(rest)
End Function


' Vrai si s commence par le mot w suivi d'un separateur (pas une
' lettre/chiffre/underscore) -> evite que "Sub" matche "Subscribe".
Private Function StartsWithWord(ByVal s As String, ByVal w As String) As Boolean
    Dim nextCh As String
    If Len(s) < Len(w) Then Exit Function
    If StrComp(Left$(s, Len(w)), w, vbTextCompare) <> 0 Then Exit Function
    If Len(s) = Len(w) Then StartsWithWord = True: Exit Function
    nextCh = Mid$(s, Len(w) + 1, 1)
    StartsWithWord = (InStr("ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789_", nextCh) = 0)
End Function


' Concatene les cles (noms de modules) d'un dictionnaire, separees par ", ".
Private Function JoinKeys(d As Object) As String
    Dim k As Variant, out As String
    For Each k In d.Keys
        If Len(out) > 0 Then out = out & ", "
        out = out & CStr(k)
    Next k
    JoinKeys = out
End Function


' Message en barre d'etat (helper local, sans dependance a un autre module).
Private Sub SetStatusOutil(msg As String)
    Application.StatusBar = msg
    DoEvents
End Sub
