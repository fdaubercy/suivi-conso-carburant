Attribute VB_Name = "modIntegrite"
' ============================================================
'  modIntegrite - Controle d'integrite des pleins (audit 03/10/2026)
' ============================================================
'  Verifie l'Excel local (GS_Pleins + vue derivee Tableau2 de "Suivi
'  Carburant") ET le Google Sheet (action GAS "audit") : doublons
'  (sync_id / contenu), lignes fantomes, Tableau2 desaligne ou fige, km
'  non croissants, dates futures, champs manquants.
'  Rapport dans l'onglet "Controle integrite" + etat sur la tuile Accueil.
'  Mode "signaler + proposer" : apres le rapport, les corrections SURES
'  sont proposees une par une avec confirmation ; rien en silence.
'    ControleIntegrite           : tuile Accueil / Alt+F8 (interactif)
'    ControleIntegriteSilencieux : ouverture (apres la sync), sans dialogue
'  Source ASCII : accents via ChrW (import VBE en ANSI).
' ============================================================
Option Explicit

Private Const WS_GS    As String = "GS_Pleins"
Private Const WS_CARB  As String = "Suivi Carburant"
Private Const WS_ACC   As String = "Accueil"
Private Const BTN_ACC  As String = "btnAccControle"

' Corrections proposees
Private Const FX_REALIGN As String = "RECALER"       ' Tableau2 desaligne / fige
Private Const FX_DELLOC  As String = "SUPPR_LOCALE"  ' ligne locale en trop (fantome / meme sync_id)
Private Const FX_DELCOPY As String = "SUPPR_COPIE"   ' copie d'un plein (Excel + Google Sheet)

' Anomalies : mIss(champ, i), i = 1..mN
'   0 Source | 1 Gravite | 2 Type | 3 Ligne | 4 Date | 5 Km | 6 sync_id | 7 Message | 8 Correction
Private mN   As Long
Private mIss() As Variant
Private mSkip As Object      ' index GS_Pleins exclus du controle km (doublons / fantomes)

' ------------------------------------------------------------
'  Libelles accentues
' ------------------------------------------------------------
Private Function eA() As String: eA = ChrW(233): End Function

Private Function RapportNom() As String
    RapportNom = "Contr" & ChrW(244) & "le int" & eA & "grit" & eA
End Function

Private Function Titre() As String
    Titre = "Contr" & ChrW(244) & "le d'int" & eA & "grit" & eA
End Function

' ============================================================
'  POINTS D'ENTREE
' ============================================================
Public Sub ControleIntegrite()
    On Error GoTo EH
    Application.Cursor = xlWait
    Application.StatusBar = Titre() & " : analyse en cours..."
    Dim gsMsg As String: gsMsg = Analyser()
    EcrireRapport gsMsg
    MajTuileAccueil
    Application.Cursor = xlDefault
    Application.StatusBar = False

    If mN = 0 Then
        MsgBox ChrW(10003) & " Aucune anomalie d" & eA & "tect" & eA & "e." & vbCrLf & vbCrLf & gsMsg, _
               vbInformation, Titre()
        Exit Sub
    End If

    If ProposerCorrections() Then
        Application.Cursor = xlWait
        gsMsg = Analyser()
        EcrireRapport gsMsg
        MajTuileAccueil
        Application.Cursor = xlDefault
        MsgBox "Apr" & ChrW(232) & "s correction : " & mN & " anomalie(s) restante(s)." & vbCrLf & gsMsg, _
               IIf(mN = 0, vbInformation, vbExclamation), Titre()
    End If
    On Error Resume Next
    ThisWorkbook.Worksheets(RapportNom()).Activate
    Exit Sub
EH:
    Application.Cursor = xlDefault
    Application.StatusBar = False
    MsgBox "Erreur " & Err.Number & " : " & Err.Description, vbExclamation, Titre()
End Sub

Public Sub ControleIntegriteSilencieux()
    On Error Resume Next
    Dim gsMsg As String: gsMsg = Analyser()
    EcrireRapport gsMsg
    MajTuileAccueil
    If mN > 0 Then
        Application.StatusBar = ChrW(9888) & " " & Titre() & " : " & mN & _
            " anomalie(s) - voir l'onglet '" & RapportNom() & "' ou la tuile Accueil."
    End If
End Sub

' Nombre d'anomalies du dernier controle (lecture seule, sans effet de bord).
Public Function NbAnomaliesIntegrite() As Long
    NbAnomaliesIntegrite = mN
End Function

' ============================================================
'  ANALYSE
' ============================================================
Private Function Analyser() As String
    mN = 0
    ReDim mIss(0 To 8, 0 To 0)
    Set mSkip = CreateObject("Scripting.Dictionary")
    Dim nGS As Long
    nGS = AnalyserLocal()
    AnalyserTableau2 nGS
    Analyser = AnalyserGS()
End Function

Private Sub AddIssue(src As String, grav As String, typ As String, ligne As Variant, _
                     dt As Variant, km As Variant, sid As String, msg As String, fx As String)
    mN = mN + 1
    ReDim Preserve mIss(0 To 8, 0 To mN)
    mIss(0, mN) = src: mIss(1, mN) = grav: mIss(2, mN) = typ
    mIss(3, mN) = ligne: mIss(4, mN) = dt: mIss(5, mN) = km
    mIss(6, mN) = sid: mIss(7, mN) = msg: mIss(8, mN) = fx
End Sub

Private Function ColIdx(lo As ListObject, nom As String, defaut As Long) As Long
    Dim i As Long
    For i = 1 To lo.ListColumns.Count
        If StrComp(Trim$(lo.ListColumns(i).Name), nom, vbTextCompare) = 0 Then ColIdx = i: Exit Function
    Next i
    ColIdx = defaut
End Function

Private Function Num(v As Variant) As Double
    On Error GoTo fail
    If IsNumeric(v) Then
        Num = CDbl(v)
    Else
        Dim s As String: s = Replace(Trim$(CStr(v)), ".", Application.International(xlDecimalSeparator))
        If Len(s) > 0 And IsNumeric(s) Then Num = CDbl(s)
    End If
    Exit Function
fail:
    Num = 0
End Function

Private Function TriKey(dt As Variant, hz As Variant) As String
    Dim a As String, b As String
    If IsDate(dt) Then a = Format$(CDate(dt), "yyyymmdd") Else a = "00000000"
    If IsDate(hz) Then b = Format$(CDate(hz), "yyyymmddhhnnss") Else b = "00000000000000"
    TriKey = a & b
End Function

' Excel : GS_Pleins (miroir local du Google Sheet). Renvoie le nb de lignes.
Private Function AnalyserLocal() As Long
    Dim lo As ListObject
    On Error Resume Next
    Set lo = ThisWorkbook.Worksheets(WS_GS).ListObjects(1)
    On Error GoTo 0
    If lo Is Nothing Then Exit Function
    If lo.DataBodyRange Is Nothing Then Exit Function

    Dim v As Variant: v = lo.DataBodyRange.Value
    Dim r0 As Long: r0 = lo.DataBodyRange.Row
    Dim n As Long: n = UBound(v, 1)
    AnalyserLocal = n

    Dim cH As Long, cD As Long, cT As Long, cK As Long, cL As Long, cP As Long, cV As Long, cS As Long
    cH = ColIdx(lo, "Horodatage", 1): cD = ColIdx(lo, "Date", 2): cT = ColIdx(lo, "Type", 3)
    cK = ColIdx(lo, "Km", 4): cL = ColIdx(lo, "Litres", 5): cP = ColIdx(lo, "PrixL", 6)
    cV = ColIdx(lo, "Vehicule", 8): cS = ColIdx(lo, "sync_id", 15)

    Dim src As String: src = "Excel (GS_Pleins)"
    Dim seenSid As Object, seenKey As Object
    Set seenSid = CreateObject("Scripting.Dictionary"): seenSid.CompareMode = vbTextCompare
    Set seenKey = CreateObject("Scripting.Dictionary"): seenKey.CompareMode = vbTextCompare

    Dim i As Long, j As Long, sid As String, typ As String, k As String
    Dim km As Double, lit As Double, px As Double, dt As Variant, ok As Boolean
    For i = 1 To n
        sid = Trim$(CStr(v(i, cS))): typ = Trim$(CStr(v(i, cT)))
        dt = v(i, cD)
        km = Num(v(i, cK)): lit = Num(v(i, cL)): px = Num(v(i, cP))

        If StrComp(sid, "sync_id", vbTextCompare) = 0 Or StrComp(typ, "Type", vbTextCompare) = 0 Then
            AddIssue src, "Erreur", "Ligne fant" & ChrW(244) & "me", r0 + i - 1, dt, km, sid, _
                "Copie de la ligne d'en-t" & ChrW(234) & "te (corrompt les noms de colonnes).", FX_DELLOC
            mSkip(i) = True
            GoTo nxt
        End If

        ok = (km > 0 And lit > 0 And px > 0)
        If Not ok Then
            AddIssue src, "Erreur", "Champ manquant", r0 + i - 1, dt, km, sid, _
                "Km, litres ou prix vide ou nul.", ""
        End If
        If Not IsDate(dt) Then
            AddIssue src, "Erreur", "Date invalide", r0 + i - 1, dt, km, sid, "Date absente ou illisible.", ""
        ElseIf CDate(dt) > Date + 1 Then
            AddIssue src, "Avertissement", "Date future", r0 + i - 1, dt, km, sid, _
                "Date post" & eA & "rieure " & ChrW(224) & " aujourd'hui.", ""
        End If

        If Len(sid) = 0 Then
            AddIssue src, "Avertissement", "sync_id manquant", r0 + i - 1, dt, km, sid, _
                "Plein jamais synchronis" & eA & " : il sera envoy" & eA & " au Google Sheet " & _
                ChrW(224) & " la prochaine synchronisation.", ""
        ElseIf seenSid.Exists(sid) Then
            AddIssue src, "Erreur", "Doublon sync_id", r0 + i - 1, dt, km, sid, _
                "M" & ChrW(234) & "me sync_id que la ligne " & seenSid(sid) & " : ligne locale en trop.", FX_DELLOC
            mSkip(i) = True
            GoTo nxt
        Else
            seenSid(sid) = r0 + i - 1
        End If

        If ok Then
            k = LCase$(Trim$(CStr(v(i, cV)))) & "|" & CStr(CLng(km)) & "|" & _
                Format$(lit, "0.00") & "|" & Format$(px, "0.000")
            If seenKey.Exists(k) Then
                j = seenKey(k)
                ' La copie = la saisie la plus recente (horodatage) ; l'autre est l'originale.
                If TriKey(v(j, cH), v(j, cH)) > TriKey(v(i, cH), v(i, cH)) Then
                    seenKey(k) = i
                    AddCopie src, v, j, i, r0, cD, cK, cS
                Else
                    AddCopie src, v, i, j, r0, cD, cK, cS
                End If
            Else
                seenKey(k) = i
            End If
        End If
nxt:
    Next i

    KmNonCroissants v, n, r0, cH, cD, cK, cV, cS, src
End Function

Private Sub AddCopie(src As String, v As Variant, iCopie As Long, iOrig As Long, r0 As Long, _
                     cD As Long, cK As Long, cS As Long)
    mSkip(iCopie) = True
    Dim dO As String
    If IsDate(v(iOrig, cD)) Then dO = Format$(CDate(v(iOrig, cD)), "dd/mm/yyyy")
    AddIssue src, "Erreur", "Doublon (contenu)", r0 + iCopie - 1, v(iCopie, cD), Num(v(iCopie, cK)), _
        Trim$(CStr(v(iCopie, cS))), _
        "M" & ChrW(234) & "me plein que la ligne " & (r0 + iOrig - 1) & " (" & dO & ", v" & eA & "hicule, km, " & _
        "litres et prix identiques) : copie probable (double envoi ou rejeu hors-ligne).", FX_DELCOPY
End Sub

' Par vehicule, ordre chronologique (Date puis Horodatage) : km <= km precedent.
Private Sub KmNonCroissants(v As Variant, n As Long, r0 As Long, cH As Long, cD As Long, _
                            cK As Long, cV As Long, cS As Long, src As String)
    Dim veh As Object: Set veh = CreateObject("Scripting.Dictionary")
    veh.CompareMode = vbTextCompare
    Dim i As Long, nm As Variant
    For i = 1 To n
        If Not mSkip.Exists(i) And Num(v(i, cK)) > 0 Then
            nm = LCase$(Trim$(CStr(v(i, cV))))
            If Not veh.Exists(nm) Then veh.Add nm, New Collection
            veh(nm).Add i
        End If
    Next i

    Dim col As Collection, idx() As Long, a As Long, b As Long, t As Long, m As Long
    For Each nm In veh.Keys
        Set col = veh(nm)
        m = col.Count
        If m >= 2 Then
            ReDim idx(1 To m)
            For a = 1 To m: idx(a) = col(a): Next a
            For a = 2 To m                       ' tri par insertion (n faible)
                t = idx(a): b = a - 1
                Do While b >= 1
                    If TriKey(v(idx(b), cD), v(idx(b), cH)) <= TriKey(v(t, cD), v(t, cH)) Then Exit Do
                    idx(b + 1) = idx(b): b = b - 1
                Loop
                idx(b + 1) = t
            Next a
            For a = 2 To m
                If Num(v(idx(a), cK)) <= Num(v(idx(a - 1), cK)) Then
                    AddIssue src, "Avertissement", "Km non croissant", r0 + idx(a) - 1, v(idx(a), cD), _
                        Num(v(idx(a), cK)), Trim$(CStr(v(idx(a), cS))), _
                        "Km inf" & eA & "rieur ou " & eA & "gal au plein pr" & eA & "c" & eA & "dent du v" & eA & _
                        "hicule (" & Num(v(idx(a - 1), cK)) & " km, ligne " & (r0 + idx(a - 1) - 1) & ").", ""
                End If
            Next a
        End If
    Next nm
End Sub

' Vue derivee "Suivi Carburant" (Tableau2) : meme nb de lignes que GS_Pleins
' et uniquement des formules (une valeur figee = ancien import / saisie).
Private Sub AnalyserTableau2(nGS As Long)
    Dim lo As ListObject
    On Error Resume Next
    Set lo = ThisWorkbook.Worksheets(WS_CARB).ListObjects("Tableau2")
    On Error GoTo 0
    If lo Is Nothing Then Exit Sub
    Dim src As String: src = "Excel (Suivi Carburant)"
    Dim nT2 As Long
    If Not lo.DataBodyRange Is Nothing Then nT2 = lo.DataBodyRange.Rows.Count

    If nT2 <> nGS Then
        AddIssue src, "Erreur", "Tableau d" & eA & "salign" & eA, lo.HeaderRowRange.Row, Empty, Empty, "", _
            nT2 & " plein(s) dans Suivi Carburant contre " & nGS & " dans GS_Pleins.", FX_REALIGN
    End If
    If nT2 = 0 Then Exit Sub

    Dim hf As Variant: hf = lo.DataBodyRange.HasFormula
    If Not IsNull(hf) Then
        If hf = True Then Exit Sub
    End If
    Dim i As Long, c As Long, cols As String, body As Range
    Set body = lo.DataBodyRange
    For i = 1 To nT2
        cols = ""
        For c = 1 To lo.ListColumns.Count
            If modFeatures.T2CelluleFigeeAnormale(lo, i, c) Then
                cols = cols & IIf(Len(cols) > 0, ", ", "") & lo.ListColumns(c).Name
            End If
        Next c
        If Len(cols) > 0 Then
            AddIssue src, "Erreur", "Valeur fig" & eA & "e", body.Rows(i).Row, body.Cells(i, 2).Value, _
                body.Cells(i, 4).Value, "", _
                "Plein n" & ChrW(176) & " " & i & " : valeur saisie au lieu de la formule (" & cols & _
                ") -> risque de doublon ou de d" & eA & "calage.", FX_REALIGN
        End If
    Next i
End Sub

' Google Sheet : action GAS "audit" (meme authentification que l'export).
Private Function AnalyserGS() As String
    On Error GoTo fail
    Dim js As String
    js = HttpGet(GAS_URL & "?action=audit&token=" & APP_TOKEN & SyncSecretQS())
    If Len(js) = 0 Then
        AnalyserGS = "Google Sheet : injoignable (r" & eA & "seau).": Exit Function
    End If
    If InStr(js, """issues""") = 0 Then
        AnalyserGS = "Google Sheet : r" & eA & "ponse inattendue (" & Left$(JsonGet(js, "error"), 60) & ")."
        Exit Function
    End If

    Dim arr() As String: arr = ParseIssues(js)
    Dim i As Long, o As String, nb As Long, typ As String, fx As String, grav As String
    For i = LBound(arr) To UBound(arr)
        o = arr(i)
        If Len(o) > 2 Then
            typ = JsonGet(o, "type")
            fx = IIf(typ = "dup_contenu", FX_DELCOPY, "")
            grav = IIf(JsonGet(o, "severity") = "error", "Erreur", "Avertissement")
            AddIssue "Google Sheet", grav, LibelleType(typ), Val(JsonGet(o, "row")), _
                IsoDate(JsonGet(o, "date")), Num(JsonGet(o, "km")), JsonGet(o, "sync_id"), _
                JsonUnesc(JsonGet(o, "message")), fx
            nb = nb + 1
        End If
    Next i
    AnalyserGS = "Google Sheet : " & JsonGet(js, "active") & " plein(s) actif(s) analys" & eA & "s, " & _
                 nb & " anomalie(s)."
    Exit Function
fail:
    AnalyserGS = "Google Sheet : erreur " & Err.Number & " (" & Err.Description & ")."
End Function

Private Function LibelleType(t As String) As String
    Select Case t
        Case "dup_contenu":      LibelleType = "Doublon (contenu)"
        Case "dup_sync_id":      LibelleType = "Doublon sync_id"
        Case "km_non_croissant": LibelleType = "Km non croissant"
        Case "date_future":      LibelleType = "Date future"
        Case "champ_manquant":   LibelleType = "Champ manquant"
        Case "entete_fantome":   LibelleType = "Ligne fant" & ChrW(244) & "me"
        Case "sync_id_manquant": LibelleType = "sync_id manquant"
        Case Else:               LibelleType = t
    End Select
End Function

Private Function IsoDate(s As String) As Variant
    IsoDate = s
    If Len(s) >= 10 Then
        On Error Resume Next
        IsoDate = DateSerial(CInt(Left$(s, 4)), CInt(Mid$(s, 6, 2)), CInt(Mid$(s, 9, 2)))
        On Error GoTo 0
    End If
End Function

' Objets du tableau "issues":[...] (parcours avec profondeur : les objets
' contiennent eux-memes des tableaux "related":[...]).
Private Function ParseIssues(js As String) As String()
    Dim res() As String, n As Long: n = -1
    ReDim res(0)
    Dim p As Long: p = InStr(js, """issues"":[")
    If p = 0 Then ParseIssues = res: Exit Function
    p = p + Len("""issues"":[")
    Dim i As Long, ch As String, inS As Boolean, esc As Boolean, depth As Long, st As Long
    For i = p To Len(js)
        ch = Mid$(js, i, 1)
        If inS Then
            If esc Then
                esc = False
            ElseIf ch = "\" Then
                esc = True
            ElseIf ch = """" Then
                inS = False
            End If
        Else
            Select Case ch
                Case """"
                    inS = True
                Case "{", "["
                    If depth = 0 And ch = "{" Then st = i
                    depth = depth + 1
                Case "}", "]"
                    If depth = 0 Then Exit For
                    depth = depth - 1
                    If depth = 0 And ch = "}" Then
                        n = n + 1: ReDim Preserve res(n): res(n) = Mid$(js, st, i - st + 1)
                    End If
            End Select
        End If
    Next i
    ParseIssues = res
End Function

Private Function JsonUnesc(ByVal s As String) As String
    Dim out As String, i As Long, ch As String
    i = 1
    Do While i <= Len(s)
        ch = Mid$(s, i, 1)
        If ch = "\" And i < Len(s) Then
            ch = Mid$(s, i + 1, 1)
            Select Case ch
                Case "n", "r", "t": out = out & " ": i = i + 2
                Case "u"
                    On Error Resume Next
                    out = out & ChrW(CLng("&H" & Mid$(s, i + 2, 4)))
                    On Error GoTo 0
                    i = i + 6
                Case Else: out = out & ch: i = i + 2
            End Select
        Else
            out = out & ch: i = i + 1
        End If
    Loop
    JsonUnesc = out
End Function

' ============================================================
'  RAPPORT
' ============================================================
Private Function LibelleFix(fx As String) As String
    Select Case fx
        Case FX_REALIGN: LibelleFix = "Recaler Suivi Carburant sur GS_Pleins"
        Case FX_DELLOC:  LibelleFix = "Supprimer la ligne locale en trop"
        Case FX_DELCOPY: LibelleFix = "Supprimer cette copie (Excel + Google Sheet)"
        Case Else:       LibelleFix = ""
    End Select
End Function

Private Sub EcrireRapport(gsMsg As String)
    Dim ws As Worksheet, evt As Boolean
    evt = Application.EnableEvents
    On Error Resume Next
    Set ws = ThisWorkbook.Worksheets(RapportNom())
    On Error GoTo fin
    Application.EnableEvents = False
    If ws Is Nothing Then
        Set ws = ThisWorkbook.Worksheets.Add(After:=ThisWorkbook.Worksheets(ThisWorkbook.Worksheets.Count))
        ws.Name = RapportNom()
    End If
    ws.Cells.Clear

    With ws.Range("A1")
        .Value = Titre() & " des pleins"
        .Font.Bold = True: .Font.Size = 14
    End With
    ws.Range("A2").Value = "Analyse du " & Format$(Now, "dd/mm/yyyy hh:nn") & " : " & mN & _
                           " anomalie(s). " & gsMsg
    ws.Range("A3").Value = "Relancer : tuile '" & Titre() & "' de l'Accueil (corrections propos" & eA & _
                           "es avec confirmation)."
    ws.Range("A3").Font.Italic = True

    Dim hdr As Variant
    hdr = Array("Source", "Gravit" & eA, "Type", "Ligne", "Date", "Km", "sync_id", "Message", "Correction propos" & eA & "e")
    With ws.Range("A5").Resize(1, 9)
        .Value = hdr
        .Font.Bold = True
        .Interior.Color = RGB(226, 232, 240)
    End With

    Dim i As Long, f As Long
    For i = 1 To mN
        For f = 0 To 7
            ws.Cells(5 + i, f + 1).Value = mIss(f, i)
        Next f
        ws.Cells(5 + i, 9).Value = LibelleFix(CStr(mIss(8, i)))
        If mIss(1, i) = "Erreur" Then
            ws.Cells(5 + i, 2).Font.Color = RGB(185, 28, 28)
        Else
            ws.Cells(5 + i, 2).Font.Color = RGB(180, 83, 9)
        End If
    Next i
    If mN = 0 Then ws.Range("A6").Value = ChrW(10003) & " Aucune anomalie."

    ws.Columns("E").NumberFormat = "dd/mm/yyyy"
    ws.Columns("A:G").AutoFit
    ws.Columns("H").ColumnWidth = 80
    ws.Columns("H").WrapText = True
    ws.Columns("I").AutoFit
fin:
    Application.EnableEvents = evt
End Sub

Private Sub MajTuileAccueil()
    On Error Resume Next
    Dim shp As Shape
    Set shp = ThisWorkbook.Worksheets(WS_ACC).Shapes(BTN_ACC)
    If shp Is Nothing Then Exit Sub
    If mN = 0 Then
        shp.TextFrame2.TextRange.Text = ChrW(10003) & " " & Titre() & " : OK"
    Else
        shp.TextFrame2.TextRange.Text = ChrW(9888) & " " & Titre() & " : " & mN & " anomalie(s)"
    End If
End Sub

' ============================================================
'  CORRECTIONS PROPOSEES (confirmation a chaque etape)
' ============================================================
Private Function ProposerCorrections() As Boolean
    Dim i As Long, nRe As Long, nLoc As Long, nCop As Long, lst As String
    For i = 1 To mN
        Select Case mIss(8, i)
            Case FX_REALIGN: nRe = nRe + 1
            Case FX_DELLOC:  nLoc = nLoc + 1: lst = lst & IIf(Len(lst) > 0, ", ", "") & mIss(3, i)
            Case FX_DELCOPY: nCop = nCop + 1
        End Select
    Next i
    If nRe + nLoc + nCop = 0 Then
        MsgBox mN & " anomalie(s) signal" & eA & "e(s), sans correction automatique s" & ChrW(251) & "re." & _
               vbCrLf & "D" & eA & "tail dans l'onglet '" & RapportNom() & "'.", vbExclamation, Titre()
        Exit Function
    End If

    ' 1. Lignes locales en trop (fantome / meme sync_id) : Excel seul
    If nLoc > 0 Then
        If MsgBox(nLoc & " ligne(s) en trop dans GS_Pleins (ligne fant" & ChrW(244) & "me ou sync_id en double)." & _
                  vbCrLf & "Lignes : " & lst & vbCrLf & vbCrLf & _
                  "Les supprimer de l'Excel ? (le Google Sheet n'est pas modifi" & eA & ")", _
                  vbYesNo + vbQuestion, Titre()) = vbYes Then
            SupprimerLignesLocales
            ProposerCorrections = True
        End If
    End If

    ' 2. Copies de pleins : une confirmation par copie (sync_id distincts)
    Dim fait As Object: Set fait = CreateObject("Scripting.Dictionary")
    Dim sid As String, rep As VbMsgBoxResult, dS As String
    For i = 1 To mN
        sid = CStr(mIss(6, i))
        If mIss(8, i) = FX_DELCOPY And Len(sid) > 0 Then
            If Not fait.Exists(sid) Then
                fait(sid) = True
                dS = ""
                If IsDate(mIss(4, i)) Then dS = Format$(CDate(mIss(4, i)), "dd/mm/yyyy")
                rep = MsgBox("Doublon d" & eA & "tect" & eA & " (" & mIss(0, i) & ") :" & vbCrLf & mIss(7, i) & _
                             vbCrLf & vbCrLf & "Copie : plein du " & dS & " - " & mIss(5, i) & " km" & _
                             vbCrLf & "sync_id " & sid & vbCrLf & vbCrLf & _
                             "Supprimer CETTE copie (Excel + Google Sheet) ?" & vbCrLf & _
                             "(Annuler = arr" & ChrW(234) & "ter les propositions)", _
                             vbYesNoCancel + vbQuestion, Titre())
                If rep = vbCancel Then Exit For
                If rep = vbYes Then
                    If SupprimerCopie(sid) Then ProposerCorrections = True
                End If
            End If
        End If
    Next i

    ' 3. Recalage de la vue Suivi Carburant
    If modFeatures.Tableau2ARecaler() Then
        If MsgBox("Recaler 'Suivi Carburant' sur GS_Pleins ?" & vbCrLf & _
                  "(lignes en trop retir" & eA & "es, valeurs fig" & eA & "es remplac" & eA & "es par les formules)", _
                  vbYesNo + vbQuestion, Titre()) = vbYes Then
            modFeatures.SyncTableau2DepuisGS
            ProposerCorrections = True
        End If
    End If
End Function

Private Sub SupprimerLignesLocales()
    Dim ws As Worksheet: Set ws = ThisWorkbook.Worksheets(WS_GS)
    Dim lig() As Long, n As Long, i As Long, j As Long, t As Long
    ReDim lig(1 To mN)
    For i = 1 To mN
        If mIss(8, i) = FX_DELLOC And mIss(0, i) = "Excel (GS_Pleins)" Then
            n = n + 1: lig(n) = CLng(mIss(3, i))
        End If
    Next i
    If n = 0 Then Exit Sub
    For i = 1 To n - 1                       ' tri decroissant : supprimer du bas vers le haut
        For j = i + 1 To n
            If lig(j) > lig(i) Then t = lig(i): lig(i) = lig(j): lig(j) = t
        Next j
    Next i
    Application.EnableEvents = False
    On Error Resume Next
    For i = 1 To n
        ws.rows(lig(i)).Delete
    Next i
    On Error GoTo 0
    Application.EnableEvents = True
    modFeatures.SyncTableau2DepuisGS
End Sub

' Soft-delete GS (bulkDelete) puis suppression de la ligne locale portant ce sync_id.
Private Function SupprimerCopie(sid As String) As Boolean
    Dim payload As String, resp As String, s As String
    s = SyncSecret()
    payload = "{""action"":""bulkDelete"",""token"":""" & APP_TOKEN & """" & _
              IIf(Len(s) > 0, ",""syncSecret"":""" & s & """", "") & _
              ",""ids"":[""" & JEsc(sid) & """]}"
    resp = HttpPost(GAS_URL, payload)
    If Len(resp) = 0 Or InStr(1, LCase$(resp), "error") > 0 Then
        If MsgBox("La suppression c" & ChrW(244) & "t" & eA & " Google Sheet a " & eA & "chou" & eA & "." & vbCrLf & _
                  "Supprimer quand m" & ChrW(234) & "me la copie locale ?", vbYesNo + vbExclamation, Titre()) <> vbYes Then
            Exit Function
        End If
    End If

    Dim lo As ListObject
    On Error Resume Next
    Set lo = ThisWorkbook.Worksheets(WS_GS).ListObjects(1)
    On Error GoTo 0
    If Not lo Is Nothing Then
        Dim cS As Long: cS = ColIdx(lo, "sync_id", 15)
        Dim i As Long
        Application.EnableEvents = False
        For i = lo.ListRows.Count To 1 Step -1
            If StrComp(Trim$(CStr(lo.ListRows(i).Range.Cells(1, cS).Value)), sid, vbTextCompare) = 0 Then
                lo.ListRows(i).Delete
            End If
        Next i
        Application.EnableEvents = True
    End If
    modFeatures.SyncTableau2DepuisGS
    SupprimerCopie = True
End Function

Private Function SyncSecret() As String
    SyncSecret = GetSetting("SuiviE85", "Sync", "OwnerSecret", "")
End Function
