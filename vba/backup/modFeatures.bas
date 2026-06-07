Attribute VB_Name = "modFeatures"
' ============================================================
'  SUIVI E85 - Fonctionnalites X4 + X14            v3.3.0.10
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


' ------------------------------------------------------------
'  POINT D'ENTREE GROUPE
' ------------------------------------------------------------
Public Sub RafraichirFeatures()
    Application.ScreenUpdating = False
    On Error GoTo ErrHandler

    AppliquerMFCPrix
    CreerSuiviAuto
    SyncTableau2DepuisGS

    Application.ScreenUpdating = True
    SetStatus "[Suivi E85] " & ChrW(10003) & " Features rafraichies : MFC + 'Suivi (auto)' + Tableau2."
    Exit Sub

ErrHandler:
    Application.ScreenUpdating = True
    SetStatus "[Suivi E85] " & ChrW(9888) & " Erreur " & Err.Number & " : " & Err.Description
End Sub


' ------------------------------------------------------------
'  X4 - MISE EN FORME CONDITIONNELLE "Prix EUR/L"
'  Vert si le prix de la ligne < moyenne des 30 jours precedant
'  sa date pour le MEME carburant ; rouge si superieur.
' ------------------------------------------------------------
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
    SetStatus "[Suivi E85] " & ChrW(9888) & " Erreur MFC : " & Err.Description
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
        Debug.Print "[MFC] Colonnes introuvables sur " & nomFeuille & _
                    " (Date=" & colDate & " Type=" & colType & " Prix=" & colPrix & _
                    ") -- en-tetes ligne " & headerRow & " : " & ListerEntetes(ws, headerRow)
        MFCSurFeuille = 0
        Exit Function
    End If

    firstData = headerRow + 1
    ' Derniere ligne via la colonne Type (la colonne Prix peut contenir des
    ' libelles plus bas sur "Suivi Carburant" -> fausserait la plage).
    lastRow = ws.Cells(ws.Rows.count, colType).End(xlUp).row
    If lastRow < firstData Then
        MFCSurFeuille = 0
        Exit Function
    End If

    Dim plage As Range
    Set plage = ws.Range(ws.Cells(firstData, colPrix), ws.Cells(lastRow, colPrix))

    ' Lettres de colonnes pour formules ($-fixes sur la colonne)
    Dim cD As String, ct As String, cp As String
    cD = ColLettre(colDate)
    ct = ColLettre(colType)
    cp = ColLettre(colPrix)

    ' Reference relative a la 1ere cellule de la plage (ligne firstData)
    Dim refPrix As String, refType As String, refDate As String
    refPrix = "$" & cp & firstData
    refType = "$" & ct & firstData
    refDate = "$" & cD & firstData

    ' Moyenne 30 j glissante, meme carburant :
    '   AVERAGEIFS(prix ; type=type_ligne ; date>=date_ligne-30 ; date<=date_ligne)
    Dim avg As String
    avg = "AVERAGEIFS(" & cp & ":" & cp & "," & _
                          ct & ":" & ct & "," & refType & "," & _
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
    fc.Interior.color = VERT_FOND
    fc.Font.color = VERT_TEXTE
    fc.StopIfTrue = False

    Set fc = AjouterRegleMFC(plage, fRouge)
    If Not fc Is Nothing Then
        fc.Interior.color = ROUGE_FOND
        fc.Font.color = ROUGE_TEXTE
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
    Set tmp = ws.Cells(ws.Rows.count, ws.Columns.count)
    Dim oldF As String
    oldF = tmp.formula

    On Error Resume Next
    tmp.formula = formuleEN
    TraduireFormuleLocale = tmp.FormulaLocal
    If Len(oldF) = 0 Then tmp.ClearContents Else tmp.formula = oldF
    On Error GoTo 0
End Function

' Detecte les colonnes Date / Type / Prix par en-tete (lignes 1 a 25).
' Detection SOUPLE :
'   Date  : "date" exact, ou contient "date" (hors "horodatage").
'   Type  : contient "type", ou "carburant".
'   Prix  : contient "prix" (hors station/s98/sp98) ; priorite a "/l".
Private Function DetecterColonnes(ws As Worksheet, ByRef colDate As Long, _
                                   ByRef colType As Long, ByRef colPrix As Long, _
                                   ByRef headerRow As Long) As Boolean
    Dim r As Long, c As Long
    Dim val As String
    Dim prixStrict As Long, prixLache As Long
    colDate = 0: colType = 0: colPrix = 0: headerRow = 0
    prixStrict = 0: prixLache = 0

    For r = 1 To 25
        For c = 1 To 40
            val = LCase$(Trim$(CStr(ws.Cells(r, c).value)))
            If val <> "" Then
                ' Date
                If colDate = 0 Then
                    If val = "date" Or (InStr(val, "date") > 0 And InStr(val, "horo") = 0) Then
                        colDate = c: headerRow = r
                    End If
                End If
                ' Type / Carburant
                If colType = 0 Then
                    If InStr(val, "type") > 0 Or val = "carburant" Then
                        colType = c: headerRow = r
                    End If
                End If
                ' Prix (hors prix station/S98/SP98)
                If InStr(val, "prix") > 0 And InStr(val, "station") = 0 _
                   And InStr(val, "s98") = 0 And InStr(val, "sp98") = 0 Then
                    If InStr(val, "/l") > 0 Then
                        If prixStrict = 0 Then prixStrict = c: headerRow = r
                    Else
                        If prixLache = 0 Then prixLache = c
                    End If
                End If
            End If
        Next c
        If colDate > 0 And colType > 0 And (prixStrict > 0 Or prixLache > 0) Then Exit For
    Next r

    If prixStrict > 0 Then
        colPrix = prixStrict
    ElseIf prixLache > 0 Then
        colPrix = prixLache
    End If
    If headerRow = 0 And colPrix > 0 Then headerRow = 1

    DetecterColonnes = (colDate > 0 And colType > 0 And colPrix > 0)
End Function

' Liste les en-tetes non vides d'une ligne (diagnostic Immediate Window).
Private Function ListerEntetes(ws As Worksheet, ByVal r As Long) As String
    If r < 1 Then r = 1
    Dim c As Long, s As String, v As String
    For c = 1 To 40
        v = Trim$(CStr(ws.Cells(r, c).value))
        If v <> "" Then s = s & "[" & ColLettre(c) & "]" & v & " "
    Next c
    ListerEntetes = Trim$(s)
End Function


' ------------------------------------------------------------
'  X14 - ONGLET "Suivi (auto)" : vue derivee de GS_Pleins
'  Reconstruite par formules INDEX pointant sur le ListObject.
'  Colonnes : Date | Type | Vehicule | Km | Nb km | Litres |
'             Prix EUR/L | Cout plein | L/100km | Station
' ------------------------------------------------------------
Public Sub CreerSuiviAuto()
    Application.ScreenUpdating = False
    On Error GoTo ErrHandler

    ' Source : ListObject de GS_Pleins
    Dim dataWs As Worksheet
    On Error Resume Next
    Set dataWs = ThisWorkbook.Sheets(WS_GS)
    On Error GoTo 0
    If dataWs Is Nothing Then
        SetStatus "[Suivi E85] " & ChrW(9888) & " Feuille '" & WS_GS & "' introuvable."
        GoTo CleanExit
    End If
    If dataWs.ListObjects.count = 0 Then
        SetStatus "[Suivi E85] " & ChrW(9888) & " Aucun tableau dans '" & WS_GS & "'."
        GoTo CleanExit
    End If

    Dim tbl As ListObject
    Set tbl = dataWs.ListObjects(1)
    Dim tName As String
    tName = tbl.name

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
    If tbl.DataBodyRange Is Nothing Then nRows = 0 Else nRows = tbl.DataBodyRange.Rows.count

    ' Creer / vider la feuille
    Dim ws As Worksheet
    On Error Resume Next
    Set ws = ThisWorkbook.Sheets(WS_AUTO)
    On Error GoTo 0
    If ws Is Nothing Then
        Set ws = ThisWorkbook.Sheets.Add(After:=dataWs)
        ws.name = WS_AUTO
    End If
    ws.Cells.Clear
    Dim sh As Shape
    For Each sh In ws.Shapes: sh.Delete: Next sh

    ' Titre
    With ws.Range("A1")
        .value = ChrW(9881) & " Suivi (auto) - vue derivee de " & WS_GS
        .Font.Size = 14
        .Font.bold = True
        .Font.color = vbWhite
        .Interior.color = BLEU_DARK
    End With
    ws.Range("A1:J1").Merge
    ws.Rows(1).RowHeight = 30

    With ws.Range("A2")
        .value = "Genere par formules - ne pas saisir ici. Source unique : onglet " & WS_GS & "."
        .Font.Italic = True
        .Font.Size = 9
        .Font.color = GRIS_TXT
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
            .value = hdr(j)
            .Font.bold = True
            .Font.color = vbWhite
            .Interior.color = BLEU_MID
            .HorizontalAlignment = xlCenter
        End With
    Next j
    ws.Rows(4).RowHeight = 24

    If nRows = 0 Then
        ws.Cells(5, 1).value = "Aucune donnee dans " & WS_GS & "."
        GoTo Finalise
    End If

    ' Lignes de formules (ligne 5 a 4+nRows). k = index 1..nRows dans le tableau.
    Dim i As Long, k As Long, rr As Long
    Dim refRow As String
    For i = 1 To nRows
        rr = 4 + i
        k = i   ' index dans le tableau

        ' Date / Type / Vehicule / Km / Litres / Prix / Station via INDEX
        ws.Cells(rr, 1).formula = IdxF(tName, nDate, k)
        ws.Cells(rr, 1).NumberFormat = "dd/mm/yyyy"
        ws.Cells(rr, 2).formula = IdxF(tName, nType, k)
        ws.Cells(rr, 3).formula = IdxF(tName, nVeh, k)
        ws.Cells(rr, 4).formula = IdxF(tName, nKm, k)
        ws.Cells(rr, 4).NumberFormat = "#,##0"

        ' Nb km : difference avec la ligne precedente SI meme vehicule
        If i = 1 Then
            ws.Cells(rr, 5).value = ""
        Else
            ws.Cells(rr, 5).formula = _
                "=IFERROR(IF($C" & rr & "=$C" & (rr - 1) & ",$D" & rr & "-$D" & (rr - 1) & ",""""),"""")"
        End If
        ws.Cells(rr, 5).NumberFormat = "#,##0"

        ' Litres
        ws.Cells(rr, 6).formula = IdxF(tName, nLit, k)
        ws.Cells(rr, 6).NumberFormat = "0.00"
        ' Prix
        ws.Cells(rr, 7).formula = IdxF(tName, nPrix, k)
        ws.Cells(rr, 7).NumberFormat = "0.000"
        ' Cout plein = litres * prix
        ws.Cells(rr, 8).formula = "=IFERROR($F" & rr & "*$G" & rr & ","""")"
        ws.Cells(rr, 8).NumberFormat = "0.00"
        ' L/100km = litres / nb km * 100
        ws.Cells(rr, 9).formula = _
            "=IFERROR(IF(AND(ISNUMBER($E" & rr & "),$E" & rr & ">0),$F" & rr & "/$E" & rr & "*100,""""),"""")"
        ws.Cells(rr, 9).NumberFormat = "0.00"
        ' Station
        ws.Cells(rr, 10).formula = IdxF(tName, nStation, k)
    Next i

    ' Bordures legeres
    With ws.Range(ws.Cells(4, 1), ws.Cells(4 + nRows, 10)).Borders
        .LineStyle = xlContinuous
        .color = RGB(226, 232, 240)
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
    btn.fill.ForeColor.RGB = BLEU_MID
    btn.Line.Visible = msoFalse
    btn.TextFrame.Characters.text = ChrW(8635) & " Rafraichir"
    btn.TextFrame.Characters.Font.color = vbWhite
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
    SetStatus "[Suivi E85] " & ChrW(9888) & " Erreur Suivi (auto) : " & Err.Description
End Sub


' ------------------------------------------------------------
'  Tableau2 (Suivi Carburant) = vue derivee de GS_Pleins
'  Les colonnes BRUTES sont tirees de GS_Pleins par formules INDEX ;
'  les colonnes de CALCUL de Tableau2 sont CONSERVEES telles quelles.
'  Le nombre de lignes est aligne sur GS_Pleins.
'    Brut : Date, Type, Km compteur, Nb. Litres, Prix EUR/L, Station essence
'    Calcul (intacts) : N°, Nb. km, Cout c€/km, Cout Plein, Conso,
'                       Prix S98 jour, Cout equiv. S98, Economie(s)
' ------------------------------------------------------------
Public Sub SyncTableau2DepuisGS()
    On Error GoTo done

    ' Source
    Dim gsWs As Worksheet, gsT As ListObject
    On Error Resume Next
    Set gsWs = ThisWorkbook.Sheets(WS_GS)
    On Error GoTo done
    If gsWs Is Nothing Then Exit Sub
    If gsWs.ListObjects.count = 0 Then Exit Sub
    Set gsT = gsWs.ListObjects(1)

    ' Cible
    Dim t2Ws As Worksheet, t2 As ListObject
    On Error Resume Next
    Set t2Ws = ThisWorkbook.Sheets(WS_CARB)
    If t2Ws Is Nothing Then Exit Sub
    Set t2 = t2Ws.ListObjects("Tableau2")
    On Error GoTo done
    If t2 Is Nothing Then Exit Sub

    Dim nGS As Long
    If gsT.DataBodyRange Is Nothing Then nGS = 0 Else nGS = gsT.DataBodyRange.Rows.count
    If nGS = 0 Then Exit Sub

    Application.ScreenUpdating = False
    Application.Calculation = xlCalculationManual

    ' Deverrouille "Suivi Carburant" : UserInterfaceOnly:=True n'autorise pas
    ' ListRows.Add/Delete (erreur 1004). Reverrouille apres + dans "done".
    ModuleImportGS.DeverrouillerSuivi

    ' Aligner le nombre de lignes de Tableau2 sur GS_Pleins
    Dim nT2 As Long
    If t2.DataBodyRange Is Nothing Then nT2 = 0 Else nT2 = t2.DataBodyRange.Rows.count
    Do While nT2 < nGS
        t2.ListRows.Add
        nT2 = nT2 + 1
    Loop
    Do While nT2 > nGS And nT2 > 1
        t2.ListRows(nT2).Delete
        nT2 = nT2 - 1
    Loop
    ModuleImportGS.VerrouillerSuivi        ' reverrouille apres les operations de tableau

    ' Colonnes brutes <- GS_Pleins (formules INDEX) ; calculs preserves
    Dim t2Name As String: t2Name = t2.name
    SetT2ColFromGS t2, "Date", "Date", t2Name
    SetT2ColFromGS t2, "Type", "Type", t2Name
    SetT2ColFromGS t2, "Km compteur", "Km", t2Name
    SetT2ColFromGS t2, "Nb. Litres", "Litres", t2Name
    SetT2ColFromGS t2, "Prix " & ChrW(8364) & "/L", "PrixL", t2Name
    SetT2ColFromGS t2, "Station essence", "Station essence", t2Name

    ' Format date lisible sur la colonne Date
    On Error Resume Next
    t2.ListColumns("Date").DataBodyRange.NumberFormat = "dd/mm/yyyy"
    On Error GoTo done

    Application.Calculation = xlCalculationAutomatic
    Application.ScreenUpdating = True
    SetStatus "[Suivi Carburant] " & ChrW(10003) & " " & nGS & _
              " ligne(s) tirees de GS_Pleins (calculs Tableau2 preserves)."
    Exit Sub
done:
    On Error Resume Next
    ModuleImportGS.VerrouillerSuivi        ' garantit le reverrouillage meme sur erreur
    On Error GoTo 0
    Application.Calculation = xlCalculationAutomatic
    Application.ScreenUpdating = True
End Sub

' Pose sur toute la colonne t2ColName une formule INDEX qui tire la
' colonne gsColName de GS_Pleins, ligne par ligne. La position de ligne
' est calculee dynamiquement (ROW() - ligne d'en-tete du tableau) : aucune
' dependance a un numero de ligne code en dur -> robuste si la table bouge.
Private Sub SetT2ColFromGS(t2 As ListObject, t2ColName As String, _
                            gsColName As String, t2Name As String)
    Dim lc As ListColumn
    On Error Resume Next
    Set lc = t2.ListColumns(t2ColName)
    On Error GoTo 0
    If lc Is Nothing Then Exit Sub
    If t2.DataBodyRange Is Nothing Then Exit Sub
    lc.DataBodyRange.formula = _
        "=IFERROR(INDEX(GS_Pleins[" & gsColName & "]," & _
        "ROW()-ROW(" & t2Name & "[#Headers])),"""")"
End Sub


' ------------------------------------------------------------
'  VERIFICATION DE L'INSTALLATION
'  Controle feuilles + tableaux requis ; rapport Immediate + barre.
' ------------------------------------------------------------
Public Sub VerifierInstallation()
    Dim rap As String, ok As Long, ko As Long
    rap = "=== Verification installation Suivi E85 ===" & vbNewLine

    ok = 0: ko = 0
    rap = rap & ChkFeuille("GS_Pleins", ok, ko)
    rap = rap & ChkTableau("GS_Pleins", "", ok, ko)        ' 1er tableau
    rap = rap & ChkFeuille("Suivi Carburant", ok, ko)
    rap = rap & ChkTableau("Suivi Carburant", "Tableau2", ok, ko)
    rap = rap & ChkFeuille("Notes", ok, ko)
    rap = rap & ChkTableau("Notes", "tbl_stationEssence", ok, ko)
    rap = rap & ChkFeuilleOpt("Vehicules", "(optionnelle : liste vehicules curee)")
    rap = rap & ChkFeuilleOpt("Suivi (auto)", "(generee par CreerSuiviAuto)")

    rap = rap & "-------------------------------------------" & vbNewLine
    rap = rap & "Resultat : " & ok & " OK / " & ko & " manquant(s)." & vbNewLine
    rap = rap & "Macros cles : RafraichirFeatures, SyncTableau2DepuisGS," & vbNewLine
    rap = rap & "AppliquerMFCPrix, CreerSuiviAuto, NouveauPlein."

    Debug.Print rap
    SetStatus "[Install] " & IIf(ko = 0, ChrW(10003) & " Tout est en place (" & ok & " OK).", _
              ChrW(9888) & " " & ko & " element(s) manquant(s) - voir Ctrl+G.")
End Sub

Private Function ChkFeuille(nom As String, ByRef ok As Long, ByRef ko As Long) As String
    Dim ws As Worksheet
    On Error Resume Next
    Set ws = ThisWorkbook.Sheets(nom)
    On Error GoTo 0
    If ws Is Nothing Then
        ko = ko + 1: ChkFeuille = "[X] Feuille manquante : " & nom & vbNewLine
    Else
        ok = ok + 1: ChkFeuille = "[OK] Feuille : " & nom & vbNewLine
    End If
End Function

Private Function ChkFeuilleOpt(nom As String, note As String) As String
    Dim ws As Worksheet
    On Error Resume Next
    Set ws = ThisWorkbook.Sheets(nom)
    On Error GoTo 0
    If ws Is Nothing Then
        ChkFeuilleOpt = "[--] Feuille absente : " & nom & " " & note & vbNewLine
    Else
        ChkFeuilleOpt = "[OK] Feuille : " & nom & vbNewLine
    End If
End Function

Private Function ChkTableau(nomFeuille As String, nomTbl As String, _
                            ByRef ok As Long, ByRef ko As Long) As String
    Dim ws As Worksheet, t As ListObject
    On Error Resume Next
    Set ws = ThisWorkbook.Sheets(nomFeuille)
    On Error GoTo 0
    If ws Is Nothing Then
        ko = ko + 1: ChkTableau = "[X] Tableau introuvable (feuille " & nomFeuille & " absente)" & vbNewLine
        Exit Function
    End If
    If nomTbl = "" Then
        If ws.ListObjects.count > 0 Then
            ok = ok + 1: ChkTableau = "[OK] Tableau : " & ws.ListObjects(1).name & " (" & nomFeuille & ")" & vbNewLine
        Else
            ko = ko + 1: ChkTableau = "[X] Aucun tableau dans " & nomFeuille & vbNewLine
        End If
    Else
        On Error Resume Next
        Set t = ws.ListObjects(nomTbl)
        On Error GoTo 0
        If t Is Nothing Then
            ko = ko + 1: ChkTableau = "[X] Tableau manquant : " & nomTbl & " (" & nomFeuille & ")" & vbNewLine
        Else
            ok = ok + 1: ChkTableau = "[OK] Tableau : " & nomTbl & " (" & nomFeuille & ")" & vbNewLine
        End If
    End If
End Function


' ------------------------------------------------------------
'  HELPERS
'  Note : l'affichage barre d'etat reutilise SetStatus / ResetStatus
'  (publics, definis dans ModuleImportGS.bas) -> pas de doublon.
' ------------------------------------------------------------

' Nom reel de la colonne i (1-based) d'un ListObject, "" si absente.
Private Function ColNom(tbl As ListObject, i As Long) As String
    If i >= 1 And i <= tbl.ListColumns.count Then
        ColNom = tbl.ListColumns(i).name
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


