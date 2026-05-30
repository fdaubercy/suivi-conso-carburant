Attribute VB_Name = "modFeatures"
' ============================================================
'  SUIVI E85 - Fonctionnalites X4 + X14            v3.3.0.2
'
'  X4  : Mise en forme conditionnelle "Prix EUR/L"
'        vert si < moyenne 30 j (meme carburant), rouge si >
'        Applique sur GS_Pleins ET Suivi Carburant.
'
'  X14 : Onglet "Suivi (auto)" = vue derivee de GS_Pleins.
'        Table reconstruite par formules (INDEX) -> plus de
'        double saisie ; se met a jour avec les donnees.
'
'  INSTALLATION :
'    1. Alt+F11 -> Fichier -> Importer ce .bas
'    2. Ctrl+G (Immediate) puis lancer une macro, ou Alt+F8
'
'  USAGE :
'    AppliquerMFCPrix       -> X4 sur les 2 feuilles
'    CreerSuiviAuto         -> (re)construit l'onglet "Suivi (auto)"
'    RafraichirFeatures     -> lance les deux d'un coup
' ============================================================
Option Explicit

' Noms de feuilles
Private Const WS_GS    As String = "GS_Pleins"
Private Const WS_CARB  As String = "Suivi Carburant"
Private Const WS_AUTO  As String = "Suivi (auto)"

' Couleurs MFC
Private Const VERT_FOND   As Long = 13561798   ' RGB(198,239,206)
Private Const VERT_TEXTE  As Long = 24832      ' RGB(0,97,0)
Private Const ROUGE_FOND  As Long = 13551615   ' RGB(255,199,206)
Private Const ROUGE_TEXTE As Long = 393372     ' RGB(156,0,6)

' Couleurs UI
Private Const BLEU_DARK As Long = 6048027       ' RGB(27,58,92)
Private Const BLEU_MID  As Long = 11957550      ' RGB(46,117,182)
Private Const GRIS_TXT  As Long = 8224125       ' RGB(107,114,128)


' ════════════════════════════════════════════════════════════
'  POINT D'ENTREE GROUPE
' ════════════════════════════════════════════════════════════
Public Sub RafraichirFeatures()
    Application.ScreenUpdating = False
    On Error GoTo ErrHandler

    AppliquerMFCPrix
    CreerSuiviAuto

    Application.ScreenUpdating = True
    MsgBox "Features rafraichies : MFC prix + onglet 'Suivi (auto)'.", _
           vbInformation, "Suivi E85"
    Exit Sub

ErrHandler:
    Application.ScreenUpdating = True
    MsgBox "Erreur " & Err.Number & " : " & Err.Description, vbCritical, "Suivi E85"
End Sub


' ════════════════════════════════════════════════════════════
'  X4 - MISE EN FORME CONDITIONNELLE "Prix EUR/L"
'  Vert si le prix de la ligne < moyenne des 30 jours precedant
'  sa date pour le MEME carburant ; rouge si superieur.
' ════════════════════════════════════════════════════════════
Public Sub AppliquerMFCPrix()
    Application.ScreenUpdating = False
    On Error GoTo ErrHandler

    Dim n As Long
    n = MFCSurFeuille(WS_GS) + MFCSurFeuille(WS_CARB)

    Application.ScreenUpdating = True
    Debug.Print "MFC prix appliquee sur " & n & " feuille(s)."
    Exit Sub

ErrHandler:
    Application.ScreenUpdating = True
    MsgBox "Erreur MFC : " & Err.Description, vbCritical, "Suivi E85"
End Sub

' Applique la MFC sur une feuille donnee. Retourne 1 si OK, 0 sinon.
Private Function MFCSurFeuille(nomFeuille As String) As Long
    Dim ws As Worksheet
    On Error Resume Next
    Set ws = ThisWorkbook.Sheets(nomFeuille)
    On Error GoTo 0
    If ws Is Nothing Then
        Debug.Print "[MFC] Feuille absente : " & nomFeuille
        MFCSurFeuille = 0
        Exit Function
    End If

    ' Detecter colonnes Date / Type / Prix par en-tete
    Dim colDate As Long, colType As Long, colPrix As Long
    Dim headerRow As Long, firstData As Long, lastRow As Long
    If Not DetecterColonnes(ws, colDate, colType, colPrix, headerRow) Then
        Debug.Print "[MFC] Colonnes introuvables sur " & nomFeuille
        MFCSurFeuille = 0
        Exit Function
    End If

    firstData = headerRow + 1
    ' Derniere ligne via la colonne Type (la colonne Prix peut contenir des
    ' libelles plus bas sur "Suivi Carburant" -> fausserait la plage).
    lastRow = ws.Cells(ws.Rows.Count, colType).End(xlUp).Row
    If lastRow < firstData Then
        MFCSurFeuille = 0
        Exit Function
    End If

    Dim plage As Range
    Set plage = ws.Range(ws.Cells(firstData, colPrix), ws.Cells(lastRow, colPrix))

    ' Lettres de colonnes pour formules ($-fixes sur la colonne)
    Dim cD As String, cT As String, cP As String
    cD = ColLettre(colDate)
    cT = ColLettre(colType)
    cP = ColLettre(colPrix)

    ' Reference relative a la 1ere cellule de la plage (ligne firstData)
    Dim refPrix As String, refType As String, refDate As String
    refPrix = "$" & cP & firstData
    refType = "$" & cT & firstData
    refDate = "$" & cD & firstData

    ' Moyenne 30 j glissante, meme carburant :
    '   AVERAGEIFS(prix ; type=type_ligne ; date>=date_ligne-30 ; date<=date_ligne)
    Dim avg As String
    avg = "AVERAGEIFS(" & cP & ":" & cP & "," & _
                          cT & ":" & cT & "," & refType & "," & _
                          cD & ":" & cD & ","">=""&" & refDate & "-30," & _
                          cD & ":" & cD & ","" <=""&" & refDate & ")"

    Dim fVert As String, fRouge As String
    fVert = "=AND(" & refPrix & "<>"""",ISNUMBER(" & refPrix & ")," & refPrix & "<" & avg & ")"
    fRouge = "=AND(" & refPrix & "<>"""",ISNUMBER(" & refPrix & ")," & refPrix & ">" & avg & ")"

    ' Purge des anciennes regles sur la plage puis ajout
    plage.FormatConditions.Delete

    ' Ajout robuste aux locales (FR/US) : evite l'erreur 5 de
    ' FormatConditions.Add quand le separateur attendu est ";" (FR).
    Dim fc As FormatCondition
    Set fc = AjouterRegleMFC(plage, fVert)
    If fc Is Nothing Then
        Debug.Print "[MFC] Add impossible sur " & nomFeuille
        MFCSurFeuille = 0
        Exit Function
    End If
    fc.Interior.Color = VERT_FOND
    fc.Font.Color = VERT_TEXTE
    fc.StopIfTrue = False

    Set fc = AjouterRegleMFC(plage, fRouge)
    If Not fc Is Nothing Then
        fc.Interior.Color = ROUGE_FOND
        fc.Font.Color = ROUGE_TEXTE
        fc.StopIfTrue = False
    End If

    Debug.Print "[MFC] OK " & nomFeuille & " : " & plage.Address
    MFCSurFeuille = 1
End Function

' Ajoute une regle xlExpression robuste a la locale.
' 1) tente la formule anglaise (separateurs ",") ;
' 2) en repli, la traduit en formule locale via FormulaLocal d'une
'    cellule tampon (separateurs ";" + noms de fonctions FR si besoin).
' Retourne la FormatCondition creee, ou Nothing si echec total.
Private Function AjouterRegleMFC(plage As Range, formuleEN As String) As FormatCondition
    Dim fc As FormatCondition

    On Error Resume Next
    Set fc = plage.FormatConditions.Add(Type:=xlExpression, Formula1:=formuleEN)
    On Error GoTo 0
    If Not fc Is Nothing Then
        Set AjouterRegleMFC = fc
        Exit Function
    End If

    Dim fLoc As String
    fLoc = TraduireFormuleLocale(plage.Worksheet, formuleEN)
    If Len(fLoc) > 0 Then
        On Error Resume Next
        Set fc = plage.FormatConditions.Add(Type:=xlExpression, Formula1:=fLoc)
        On Error GoTo 0
    End If
    Set AjouterRegleMFC = fc
End Function

' Traduit une formule anglaise (commas) vers la langue/locale d'Excel
' en l'ecrivant dans une cellule tampon (derniere cellule de la feuille,
' supposee vide) puis en relisant .FormulaLocal. Restaure la cellule.
Private Function TraduireFormuleLocale(ws As Worksheet, formuleEN As String) As String
    Dim tmp As Range
    Set tmp = ws.Cells(ws.Rows.Count, ws.Columns.Count)
    Dim oldF As String
    oldF = tmp.Formula

    On Error Resume Next
    tmp.Formula = formuleEN
    TraduireFormuleLocale = tmp.FormulaLocal
    If Len(oldF) = 0 Then tmp.ClearContents Else tmp.Formula = oldF
    On Error GoTo 0
End Function

' Detecte les colonnes Date / Type / Prix par en-tete (lignes 1 a 20).
Private Function DetecterColonnes(ws As Worksheet, ByRef colDate As Long, _
                                   ByRef colType As Long, ByRef colPrix As Long, _
                                   ByRef headerRow As Long) As Boolean
    Dim r As Long, c As Long
    Dim val As String
    colDate = 0: colType = 0: colPrix = 0: headerRow = 0

    For r = 1 To 20
        For c = 1 To 30
            val = LCase$(Trim$(CStr(ws.Cells(r, c).Value)))
            If val <> "" Then
                If colDate = 0 And val = "date" Then colDate = c: headerRow = r
                If colType = 0 And val = "type" Then colType = c: headerRow = r
                If colPrix = 0 And (InStr(val, "prix") > 0 And InStr(val, "/l") > 0 _
                                    And InStr(val, "station") = 0 And InStr(val, "s98") = 0 _
                                    And InStr(val, "sp98") = 0) Then
                    colPrix = c: headerRow = r
                End If
            End If
        Next c
        If colDate > 0 And colType > 0 And colPrix > 0 Then Exit For
    Next r

    DetecterColonnes = (colDate > 0 And colType > 0 And colPrix > 0)
End Function


' ════════════════════════════════════════════════════════════
'  X14 - ONGLET "Suivi (auto)" : vue derivee de GS_Pleins
'  Reconstruite par formules INDEX pointant sur le ListObject.
'  Colonnes : Date | Type | Vehicule | Km | Nb km | Litres |
'             Prix EUR/L | Cout plein | L/100km | Station
' ════════════════════════════════════════════════════════════
Public Sub CreerSuiviAuto()
    Application.ScreenUpdating = False
    On Error GoTo ErrHandler

    ' Source : ListObject de GS_Pleins
    Dim dataWs As Worksheet
    On Error Resume Next
    Set dataWs = ThisWorkbook.Sheets(WS_GS)
    On Error GoTo 0
    If dataWs Is Nothing Then
        MsgBox "Feuille '" & WS_GS & "' introuvable.", vbCritical, "Suivi E85"
        GoTo CleanExit
    End If
    If dataWs.ListObjects.Count = 0 Then
        MsgBox "Aucun tableau dans '" & WS_GS & "'.", vbCritical, "Suivi E85"
        GoTo CleanExit
    End If

    Dim tbl As ListObject
    Set tbl = dataWs.ListObjects(1)
    Dim tName As String
    tName = tbl.Name

    ' Noms reels des colonnes (par position du schema E85)
    Dim nDate As String, nType As String, nKm As String, nLit As String
    Dim nPrix As String, nStation As String, nVeh As String
    nDate = ColNom(tbl, 2)
    nType = ColNom(tbl, 3)
    nKm = ColNom(tbl, 4)
    nLit = ColNom(tbl, 5)
    nPrix = ColNom(tbl, 6)
    nStation = ColNom(tbl, 7)
    nVeh = ColNom(tbl, 8)

    ' Nombre de lignes de donnees
    Dim nRows As Long
    If tbl.DataBodyRange Is Nothing Then nRows = 0 Else nRows = tbl.DataBodyRange.Rows.Count

    ' Creer / vider la feuille
    Dim ws As Worksheet
    On Error Resume Next
    Set ws = ThisWorkbook.Sheets(WS_AUTO)
    On Error GoTo 0
    If ws Is Nothing Then
        Set ws = ThisWorkbook.Sheets.Add(After:=dataWs)
        ws.Name = WS_AUTO
    End If
    ws.Cells.Clear
    Dim sh As Shape
    For Each sh In ws.Shapes: sh.Delete: Next sh

    ' Titre
    With ws.Range("A1")
        .Value = ChrW(9881) & " Suivi (auto) - vue derivee de " & WS_GS
        .Font.Size = 14
        .Font.Bold = True
        .Font.Color = vbWhite
        .Interior.Color = BLEU_DARK
    End With
    ws.Range("A1:J1").Merge
    ws.Rows(1).RowHeight = 30

    With ws.Range("A2")
        .Value = "Genere par formules - ne pas saisir ici. Source unique : onglet " & WS_GS & "."
        .Font.Italic = True
        .Font.Size = 9
        .Font.Color = GRIS_TXT
    End With
    ws.Range("A2:J2").Merge

    ' En-tetes (ligne 4)
    Dim hdr As Variant
    hdr = Array("Date", "Type", "Vehicule", "Km compteur", "Nb km", _
                "Nb. Litres", "Prix " & ChrW(8364) & "/L", "Cout plein (" & ChrW(8364) & ")", _
                "L/100 km", "Station essence")
    Dim j As Long
    For j = 0 To UBound(hdr)
        With ws.Cells(4, j + 1)
            .Value = hdr(j)
            .Font.Bold = True
            .Font.Color = vbWhite
            .Interior.Color = BLEU_MID
            .HorizontalAlignment = xlCenter
        End With
    Next j
    ws.Rows(4).RowHeight = 24

    If nRows = 0 Then
        ws.Cells(5, 1).Value = "Aucune donnee dans " & WS_GS & "."
        GoTo Finalise
    End If

    ' Lignes de formules (ligne 5 a 4+nRows). k = index 1..nRows dans le tableau.
    Dim i As Long, k As Long, rr As Long
    Dim refRow As String
    For i = 1 To nRows
        rr = 4 + i
        k = i   ' index dans le tableau

        ' Date / Type / Vehicule / Km / Litres / Prix / Station via INDEX
        ws.Cells(rr, 1).Formula = IdxF(tName, nDate, k)
        ws.Cells(rr, 1).NumberFormat = "dd/mm/yyyy"
        ws.Cells(rr, 2).Formula = IdxF(tName, nType, k)
        ws.Cells(rr, 3).Formula = IdxF(tName, nVeh, k)
        ws.Cells(rr, 4).Formula = IdxF(tName, nKm, k)
        ws.Cells(rr, 4).NumberFormat = "#,##0"

        ' Nb km : difference avec la ligne precedente SI meme vehicule
        If i = 1 Then
            ws.Cells(rr, 5).Value = ""
        Else
            ws.Cells(rr, 5).Formula = _
                "=IFERROR(IF($C" & rr & "=$C" & (rr - 1) & ",$D" & rr & "-$D" & (rr - 1) & ",""""),"""")"
        End If
        ws.Cells(rr, 5).NumberFormat = "#,##0"

        ' Litres
        ws.Cells(rr, 6).Formula = IdxF(tName, nLit, k)
        ws.Cells(rr, 6).NumberFormat = "0.00"
        ' Prix
        ws.Cells(rr, 7).Formula = IdxF(tName, nPrix, k)
        ws.Cells(rr, 7).NumberFormat = "0.000"
        ' Cout plein = litres * prix
        ws.Cells(rr, 8).Formula = "=IFERROR($F" & rr & "*$G" & rr & ","""")"
        ws.Cells(rr, 8).NumberFormat = "0.00"
        ' L/100km = litres / nb km * 100
        ws.Cells(rr, 9).Formula = _
            "=IFERROR(IF(AND(ISNUMBER($E" & rr & "),$E" & rr & ">0),$F" & rr & "/$E" & rr & "*100,""""),"""")"
        ws.Cells(rr, 9).NumberFormat = "0.00"
        ' Station
        ws.Cells(rr, 10).Formula = IdxF(tName, nStation, k)
    Next i

    ' Bordures legeres
    With ws.Range(ws.Cells(4, 1), ws.Cells(4 + nRows, 10)).Borders
        .LineStyle = xlContinuous
        .Color = RGB(226, 232, 240)
        .Weight = xlThin
    End With

Finalise:
    ws.Columns("A:J").AutoFit
    ws.Columns("A").ColumnWidth = 12
    ws.Columns("J").ColumnWidth = 24
    On Error Resume Next
    ws.Range("A5").Select
    ActiveWindow.FreezePanes = False
    ws.Activate
    ws.Range("A5").Select
    ActiveWindow.SplitRow = 4
    ActiveWindow.FreezePanes = True
    On Error GoTo 0

    ' Bouton "Rafraichir"
    Dim btn As Shape
    Set btn = ws.Shapes.AddShape(msoShapeRoundedRectangle, ws.Range("L1").Left, 4, 110, 26)
    btn.Fill.ForeColor.RGB = BLEU_MID
    btn.Line.Visible = msoFalse
    btn.TextFrame.Characters.Text = ChrW(8635) & " Rafraichir"
    btn.TextFrame.Characters.Font.Color = vbWhite
    btn.TextFrame.Characters.Font.Size = 10
    btn.TextFrame.HorizontalAlignment = xlHAlignCenter
    btn.TextFrame.VerticalAlignment = xlVAlignCenter
    btn.OnAction = "CreerSuiviAuto"

CleanExit:
    Application.ScreenUpdating = True
    Debug.Print "Suivi (auto) reconstruit : " & nRows & " lignes."
    Exit Sub

ErrHandler:
    Application.ScreenUpdating = True
    MsgBox "Erreur Suivi (auto) : " & Err.Description, vbCritical, "Suivi E85"
End Sub


' ════════════════════════════════════════════════════════════
'  HELPERS
' ════════════════════════════════════════════════════════════

' Nom reel de la colonne i (1-based) d'un ListObject, "" si absente.
Private Function ColNom(tbl As ListObject, i As Long) As String
    If i >= 1 And i <= tbl.ListColumns.Count Then
        ColNom = tbl.ListColumns(i).Name
    Else
        ColNom = ""
    End If
End Function

' Formule INDEX structuree : =IFERROR(INDEX(Tbl[Col],k),"")
Private Function IdxF(tName As String, colName As String, k As Long) As String
    If colName = "" Then
        IdxF = """"""
    Else
        IdxF = "=IFERROR(INDEX(" & tName & "[" & colName & "]," & k & "),"""")"
    End If
End Function

' Lettre(s) de colonne a partir d'un index (1 -> A, 27 -> AA)
Private Function ColLettre(col As Long) As String
    Dim s As String, n As Long
    n = col
    Do While n > 0
        s = Chr$(65 + ((n - 1) Mod 26)) & s
        n = (n - 1) \ 26
    Loop
    ColLettre = s
End Function
