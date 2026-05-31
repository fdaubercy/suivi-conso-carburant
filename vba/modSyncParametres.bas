Attribute VB_Name = "modSyncParametres"
' ============================================================
'  SUIVI E85 - Synchronisation des PARAMETRES METIER (P1)
'  Google Sheets (onglet "Parametres") <-> Excel
'
'  v1.0.0.0  [necessite Code.gs avec getParametres / setParametres]
'
'  Source de verite unique = onglet "Parametres" du Google Sheet
'  (table cle | valeur | modifie_le, epoch ms UTC). Les memes
'  parametres sont editables dans l'app web ET dans ce classeur ;
'  la synchro resout les conflits par LAST-WRITE-WINS sur modifie_le,
'  cle par cle (meme logique que la sync des pleins de modSyncGS).
'
'  Perimetre (metier uniquement) :
'    kit_prix         <-> "Suivi Carburant"!B5
'    budget_mensuel   <-> "Graphiques"!B2
'    objectif_co2     <-> "Graphiques"!B3
'    surconso         <-> "Suivi Carburant"!J7
'    seuil_E85/GAZOLE/SP98 (+ _enabled)  -> stockes dans l'onglet
'      "Parametres" (geres cote app ; le classeur les conserve).
'
'  Onglet local "Parametres" (cree au besoin) : miroir cle/valeur/ts.
'  Les 4 parametres mappes sont en plus ecrits dans leur cellule de
'  tableau de bord (ecriture traversante) et relus pour detecter une
'  edition locale (cellule != miroir => horodatage = maintenant).
'
'  Points d'entree :
'    SyncParametres        - synchro complete (appelable seule + depuis
'                            SyncCore de modSyncGS en fin de sync).
'    SyncParametresManuel  - idem, avec message de bilan en barre d'etat.
' ============================================================
Option Explicit

' --- Endpoint GAS (identique a js/config.js et modSyncGS) ---
Private Const GAS_URL   As String = "https://script.google.com/macros/s/AKfycbwIyCfZVTpDOGBANtFcHECcCdbg4J4t377pKQjIJ0NJYFT9FMjZm5_6XOsyQAas8jeTyA/exec"
Private Const APP_TOKEN As String = "e85_a7f3c9e21b8d4f60a5c3e8b7d12f6049"

Private Const WS_PARAMS As String = "Parametres"
Private Const WS_CARB   As String = "Suivi Carburant"
Private Const WS_GRAPH  As String = "Graphiques"

Private Const T_RESOLVE As Long = 5000
Private Const T_CONNECT As Long = 10000
Private Const T_SEND    As Long = 30000
Private Const T_RECEIVE As Long = 30000

' --- Definition d'un parametre metier ---
Private Type ParamDef
    cle       As String
    wsName    As String   ' "" = pas de cellule miroir (stocke dans "Parametres" seulement)
    cellAddr  As String
    isBool    As Boolean
End Type

' ============================================================
'  POINTS D'ENTREE
' ============================================================
Public Sub SyncParametresManuel()
    Dim n As Long
    n = SyncParametres()
    If n >= 0 Then
        Application.StatusBar = "[Parametres] " & ChrW(10003) & " Synchronises (" & _
            n & " maj) - " & Format(Now(), "hh:mm:ss")
    Else
        Application.StatusBar = "[Parametres] " & ChrW(9888) & " Echec reseau (voir TestConnexion)."
    End If
End Sub

' Renvoie le nombre de parametres appliques/pousses, ou -1 si echec reseau.
Public Function SyncParametres() As Long
    Dim defs()   As ParamDef
    Dim ws       As Worksheet
    Dim dRow     As Object, dVal As Object, dTs As Object
    Dim i        As Long
    Dim resp     As String
    Dim srvObjs() As String
    Dim sCle     As String, sVal As String, sTs As Double
    Dim toPush   As String          ' liste d'objets JSON a pousser
    Dim nChanged As Long

    On Error GoTo EH

    defs = ParamDefs()
    Set ws = EnsureParamsSheet()

    Set dRow = CreateObject("Scripting.Dictionary")
    Set dVal = CreateObject("Scripting.Dictionary")
    Set dTs = CreateObject("Scripting.Dictionary")
    ReadMirror ws, dRow, dVal, dTs

    ' 1) Detecter les editions locales sur les 4 cellules mappees.
    '    - 1er passage (miroir absent) : on enregistre la valeur actuelle avec
    '      ts = 0 (baseline) pour que l'app / le serveur fasse foi -- on ne
    '      veut PAS qu'une valeur par defaut Excel ecrase une valeur app reelle.
    '    - Ensuite, cellule != miroir => edition locale genuine -> ts = maintenant.
    For i = LBound(defs) To UBound(defs)
        If defs(i).wsName <> "" Then
            Dim cellV As Variant
            cellV = ReadCell(defs(i).wsName, defs(i).cellAddr)
            If Not IsErrVal(cellV) Then
                If Not dRow.Exists(defs(i).cle) Then
                    If Not IsEmptyVal(cellV) Then
                        UpsertMirror ws, dRow, dVal, dTs, defs(i).cle, cellV, 0#
                    End If
                ElseIf Not SameVal(cellV, dVal(defs(i).cle)) Then
                    UpsertMirror ws, dRow, dVal, dTs, defs(i).cle, cellV, NowUtcMs()
                End If
            End If
        End If
    Next i

    ' 2) Lire l'etat serveur
    resp = HttpGet(GAS_URL & "?action=getParametres&token=" & APP_TOKEN)
    If resp = "" Then SyncParametres = -1: GoTo CleanFail
    If InStr(resp, """params""") = 0 Then SyncParametres = -1: GoTo CleanFail

    Dim srvCle As Object, srvVal As Object, srvTs As Object
    Set srvCle = CreateObject("Scripting.Dictionary")
    Set srvVal = CreateObject("Scripting.Dictionary")
    Set srvTs = CreateObject("Scripting.Dictionary")
    srvObjs = ParseParamObjects(resp)
    For i = LBound(srvObjs) To UBound(srvObjs)
        If srvObjs(i) <> "" Then
            sCle = JsonGet(srvObjs(i), "cle")
            If sCle <> "" Then
                srvVal(sCle) = JsonGet(srvObjs(i), "valeur")
                srvTs(sCle) = Val(JsonGet(srvObjs(i), "modifie_le"))
            End If
        End If
    Next i

    ' 3) Reconciliation LWW + collecte des pushes
    toPush = ""
    For i = LBound(defs) To UBound(defs)
        Dim cle As String: cle = defs(i).cle
        Dim lts As Double:  lts = 0
        If dTs.Exists(cle) Then lts = dTs(cle)

        If srvVal.Exists(cle) Then
            If srvTs(cle) > lts Then
                ' serveur plus recent -> applique en local (miroir + cellule)
                UpsertMirror ws, dRow, dVal, dTs, cle, NormFromServer(srvVal(cle), defs(i).isBool), srvTs(cle)
                If defs(i).wsName <> "" Then WriteCell defs(i).wsName, defs(i).cellAddr, NormFromServer(srvVal(cle), defs(i).isBool)
                nChanged = nChanged + 1
            ElseIf lts > srvTs(cle) Then
                toPush = AppendParam(toPush, cle, dVal(cle), lts)
                nChanged = nChanged + 1
            End If
        Else
            ' absent du serveur : pousser si on a une valeur horodatee localement
            If dRow.Exists(cle) And lts > 0 Then
                toPush = AppendParam(toPush, cle, dVal(cle), lts)
                nChanged = nChanged + 1
            End If
        End If
    Next i

    ' 4) Pousser les parametres localement plus recents
    If toPush <> "" Then
        Dim body As String
        body = "{""action"":""setParametres"",""token"":""" & APP_TOKEN & """,""params"":[" & toPush & "]}"
        HttpPost GAS_URL, body
    End If

    SyncParametres = nChanged
    Exit Function

CleanFail:
    Exit Function
EH:
    SyncParametres = -1
End Function

' ============================================================
'  DEFINITIONS DES PARAMETRES
' ============================================================
Private Function ParamDefs() As ParamDef()
    Dim d() As ParamDef
    ReDim d(0 To 9)
    d(0) = Mk("kit_prix", WS_CARB, "B5", False)
    d(1) = Mk("budget_mensuel", WS_GRAPH, "B2", False)
    d(2) = Mk("objectif_co2", WS_GRAPH, "B3", False)
    d(3) = Mk("surconso", WS_CARB, "J7", False)
    d(4) = Mk("seuil_E85", "", "", False)
    d(5) = Mk("seuil_GAZOLE", "", "", False)
    d(6) = Mk("seuil_SP98", "", "", False)
    d(7) = Mk("seuil_E85_enabled", "", "", True)
    d(8) = Mk("seuil_GAZOLE_enabled", "", "", True)
    d(9) = Mk("seuil_SP98_enabled", "", "", True)
    ParamDefs = d
End Function

Private Function Mk(cle As String, wsName As String, cellAddr As String, isBool As Boolean) As ParamDef
    Mk.cle = cle: Mk.wsName = wsName: Mk.cellAddr = cellAddr: Mk.isBool = isBool
End Function

' ============================================================
'  ONGLET MIROIR "Parametres"
' ============================================================
Private Function EnsureParamsSheet() As Worksheet
    Dim ws As Worksheet
    On Error Resume Next
    Set ws = ThisWorkbook.Worksheets(WS_PARAMS)
    On Error GoTo 0
    If ws Is Nothing Then
        Set ws = ThisWorkbook.Worksheets.Add(After:=ThisWorkbook.Sheets(ThisWorkbook.Sheets.Count))
        ws.Name = WS_PARAMS
        ws.Range("A1:C1").Value = Array("cle", "valeur", "modifie_le")
        ws.Range("A1:C1").Font.Bold = True
        ws.Range("A1:C1").Interior.color = RGB(27, 58, 92)
        ws.Range("A1:C1").Font.color = RGB(255, 255, 255)
        ws.Columns("A").ColumnWidth = 22
        ws.Columns("C").ColumnWidth = 16
        ws.Visible = xlSheetHidden          ' onglet technique
    End If
    Set EnsureParamsSheet = ws
End Function

Private Sub ReadMirror(ws As Worksheet, dRow As Object, dVal As Object, dTs As Object)
    Dim last As Long, r As Long, cle As String
    last = ws.Cells(ws.Rows.Count, 1).End(xlUp).Row
    For r = 2 To last
        cle = Trim(CStr(ws.Cells(r, 1).Value))
        If cle <> "" Then
            dRow(cle) = r
            dVal(cle) = ws.Cells(r, 2).Value
            dTs(cle) = Val(CStr(ws.Cells(r, 3).Value))
        End If
    Next r
End Sub

Private Sub UpsertMirror(ws As Worksheet, dRow As Object, dVal As Object, dTs As Object, _
                         cle As String, valeur As Variant, ts As Double)
    Dim r As Long
    If dRow.Exists(cle) Then
        r = dRow(cle)
    Else
        r = ws.Cells(ws.Rows.Count, 1).End(xlUp).Row + 1
        If r < 2 Then r = 2
        ws.Cells(r, 1).Value = cle
        dRow(cle) = r
    End If
    ws.Cells(r, 2).Value = valeur
    ws.Cells(r, 3).Value = Format(ts, "0")
    dVal(cle) = valeur
    dTs(cle) = ts
End Sub

' ============================================================
'  CELLULES DU TABLEAU DE BORD
' ============================================================
Private Function ReadCell(wsName As String, addr As String) As Variant
    Dim ws As Worksheet
    On Error GoTo Bad
    Set ws = ThisWorkbook.Worksheets(wsName)
    ReadCell = ws.Range(addr).Value
    Exit Function
Bad:
    ReadCell = CVErr(xlErrNA)
End Function

Private Sub WriteCell(wsName As String, addr As String, valeur As Variant)
    Dim ws As Worksheet
    On Error Resume Next
    Set ws = ThisWorkbook.Worksheets(wsName)
    If ws Is Nothing Then Exit Sub
    ' Garde-fou : ne jamais ecraser une cellule contenant une formule
    ' (l'utilisateur peut avoir branche J7/B5 sur un calcul).
    If ws.Range(addr).HasFormula Then Exit Sub
    If IsEmptyVal(valeur) Then
        ws.Range(addr).ClearContents
    Else
        ws.Range(addr).Value = valeur
    End If
    On Error GoTo 0
End Sub

' ============================================================
'  NORMALISATION / COMPARAISON
' ============================================================
' Valeur serveur (chaine JsonGet) -> Variant exploitable cote Excel.
Private Function NormFromServer(s As Variant, isBool As Boolean) As Variant
    Dim t As String: t = CStr(s)
    If isBool Then
        NormFromServer = IIf(t = "1", 1, 0)
        Exit Function
    End If
    If t = "" Or t = "null" Then
        NormFromServer = ""
    ElseIf IsNumeric(Replace(t, ".", ",")) Then
        NormFromServer = CDbl(Replace(t, ".", ","))
    Else
        NormFromServer = t
    End If
End Function

Private Function IsEmptyVal(v As Variant) As Boolean
    If IsError(v) Then IsEmptyVal = True: Exit Function
    If IsEmpty(v) Then IsEmptyVal = True: Exit Function
    If VarType(v) = vbString Then IsEmptyVal = (Trim(v) = "")
End Function

Private Function IsErrVal(v As Variant) As Boolean
    IsErrVal = IsError(v)
End Function

' Egalite tolerante (numerique a 1e-6 pres, sinon comparaison texte).
Private Function SameVal(a As Variant, b As Variant) As Boolean
    Dim ea As Boolean, eb As Boolean
    ea = IsEmptyVal(a): eb = IsEmptyVal(b)
    If ea Or eb Then SameVal = (ea And eb): Exit Function
    If IsNumeric(a) And IsNumeric(b) Then
        SameVal = (Abs(CDbl(a) - CDbl(b)) < 0.000001)
    Else
        SameVal = (CStr(a) = CStr(b))
    End If
End Function

' ============================================================
'  JSON (construction + parsing minimal)
' ============================================================
' Ajoute un objet {"cle":..,"valeur":..,"modifie_le":..} a la liste.
Private Function AppendParam(acc As String, cle As String, valeur As Variant, ts As Double) As String
    Dim valTok As String
    If IsEmptyVal(valeur) Then
        valTok = """"""                                   ' chaine vide
    ElseIf IsNumeric(valeur) Then
        valTok = Replace(CStr(CDbl(valeur)), ",", ".")    ' nombre brut
    Else
        valTok = """" & JEsc(CStr(valeur)) & """"
    End If
    Dim obj As String
    obj = "{""cle"":""" & cle & """,""valeur"":" & valTok & _
          ",""modifie_le"":" & Format(ts, "0") & "}"
    If acc = "" Then AppendParam = obj Else AppendParam = acc & "," & obj
End Function

Private Function JEsc(ByVal s As String) As String
    s = Replace(s, "\", "\\")
    s = Replace(s, """", "\""")
    JEsc = s
End Function

' Decoupe le tableau "params":[ {..},{..} ] en objets JSON individuels.
Private Function ParseParamObjects(jsonStr As String) As String()
    Dim emp(0) As String: emp(0) = ""
    Dim p As Long, endP As Long, arr As String
    Const TAG As String = """params"":["

    p = InStr(jsonStr, TAG)
    If p = 0 Then ParseParamObjects = emp: Exit Function
    p = p + Len(TAG)
    endP = InStrRev(jsonStr, "]")
    If endP <= p Then ParseParamObjects = emp: Exit Function

    arr = Trim(Mid(jsonStr, p, endP - p))
    If arr = "" Then ParseParamObjects = emp: Exit Function

    Dim parts() As String, i As Long, n As Long, s As String, result() As String
    parts = Split(arr, "},{")
    n = UBound(parts)
    ReDim result(n)
    For i = 0 To n
        s = parts(i)
        If Left(s, 1) <> "{" Then s = "{" & s
        If Right(s, 1) <> "}" Then s = s & "}"
        result(i) = s
    Next i
    ParseParamObjects = result
End Function

' Lecture d'une valeur scalaire dans un objet JSON plat (chaine ou nombre).
Private Function JsonGet(jsonObj As String, key As String) As String
    Dim pat As String, pos As Long, ch As String, vs As Long, ve As Long, ns As Long
    pat = """" & key & """:"
    pos = InStr(jsonObj, pat)
    If pos = 0 Then Exit Function
    pos = pos + Len(pat)
    Do While pos <= Len(jsonObj) And Mid(jsonObj, pos, 1) = " "
        pos = pos + 1
    Loop
    ch = Mid(jsonObj, pos, 1)
    If ch = """" Then
        vs = pos + 1: ve = vs
        Do While ve <= Len(jsonObj)
            If Mid(jsonObj, ve, 1) = """" And Mid(jsonObj, ve - 1, 1) <> "\" Then Exit Do
            ve = ve + 1
        Loop
        JsonGet = Mid(jsonObj, vs, ve - vs)
    ElseIf ch = "n" Then
        JsonGet = ""
    Else
        ns = pos
        Do While pos <= Len(jsonObj)
            ch = Mid(jsonObj, pos, 1)
            If ch = "," Or ch = "}" Then Exit Do
            pos = pos + 1
        Loop
        JsonGet = Trim(Mid(jsonObj, ns, pos - ns))
    End If
End Function

' ============================================================
'  HORODATAGE UTC (epoch ms) - aligne sur Date.now() de l'app
' ============================================================
Private Function NowUtcMs() As Double
    Dim d As Object, utc As Date
    On Error GoTo Fallback
    Set d = CreateObject("WbemScripting.SWbemDateTime")
    d.SetVarDate Now, True          ' Now() local -> stocke avec fuseau
    utc = d.GetVarDate(False)        ' relit en UTC
    NowUtcMs = (utc - DateSerial(1970, 1, 1)) * 86400000#
    Exit Function
Fallback:
    ' Repli : horloge locale (skew possible inter-appareils, non bloquant).
    NowUtcMs = (Now - DateSerial(1970, 1, 1)) * 86400000#
End Function

' ============================================================
'  HTTP (copie autonome - pas de dependance a modSyncGS)
' ============================================================
Private Function CreateHttp() As Object
    On Error Resume Next
    Set CreateHttp = CreateObject("WinHttp.WinHttpRequest.5.1")
    If Err.Number <> 0 Or CreateHttp Is Nothing Then
        Err.Clear
        Set CreateHttp = CreateObject("MSXML2.XMLHTTP60")
    End If
    On Error GoTo 0
End Function

Private Function HttpGet(url As String) As String
    Dim h As Object
    On Error GoTo Err_
    Set h = CreateHttp()
    If h Is Nothing Then Exit Function
    h.SetTimeouts T_RESOLVE, T_CONNECT, T_SEND, T_RECEIVE
    h.Open "GET", url, False
    h.Send
    If h.Status = 200 Then HttpGet = h.ResponseText
    Exit Function
Err_:
    HttpGet = ""
End Function

Private Function HttpPost(url As String, body As String) As String
    Dim h As Object
    On Error GoTo Err_
    Set h = CreateHttp()
    If h Is Nothing Then Exit Function
    h.SetTimeouts T_RESOLVE, T_CONNECT, T_SEND, T_RECEIVE
    h.Open "POST", url, False
    h.setRequestHeader "Content-Type", "application/json; charset=utf-8"
    h.Send body
    If h.Status = 200 Then HttpPost = h.ResponseText
    Exit Function
Err_:
    HttpPost = ""
End Function
