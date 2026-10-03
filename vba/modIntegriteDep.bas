Attribute VB_Name = "modIntegriteDep"
' ============================================================
'  modIntegriteDep - Controle d'integrite des DEPENSES (v5.36)
' ============================================================
'  Analyse la table miroir tblDepenses (feuille "_Depenses") et la
'  compare au Google Sheet (getDepenses) : doublons, dates / montants
'  invalides, suppressions recentes (restaurables), ecarts Excel <-> Sheet.
'  Appele par modIntegrite.Analyser ; corrections proposees (avec
'  confirmation) par modIntegrite.ProposerCorrections :
'    FX_RESTDEP -> modSyncDepenses.RestaurerDepense
'    FX_SYNCDEP -> modSyncDepenses.SyncDepenses
'  Source ASCII : accents via ChrW (import VBE en ANSI).
' ============================================================
Option Explicit

Public Const FX_RESTDEP As String = "RESTAURER_DEP"
Public Const FX_SYNCDEP As String = "SYNC_DEP"
Private Const JOURS_RECENT As Long = 30

Private Function eA() As String: eA = ChrW(233): End Function

Private Function Src() As String
    Src = "D" & eA & "penses"
End Function

' Ajoute une anomalie au format des lignes de modIntegrite :
' Array(source, gravite, type, ligne, date, km, id, message, correction)
Private Sub AddDep(iss As Collection, grav As String, typ As String, ligne As Variant, _
                   dt As Variant, id As String, msg As String, fx As String)
    iss.Add Array(Src(), grav, typ, ligne, dt, Empty, id, msg, fx)
End Sub

Private Function DateDep(v As Variant) As Variant
    DateDep = Empty
    If VarType(v) = vbDate Then DateDep = v: Exit Function
    Dim s As String: s = Trim$(CStr(v))
    If Len(s) <> 10 Then Exit Function
    If Mid$(s, 5, 1) <> "-" Or Mid$(s, 8, 1) <> "-" Then Exit Function
    If Not (IsNumeric(Left$(s, 4)) And IsNumeric(Mid$(s, 6, 2)) And IsNumeric(Right$(s, 2))) Then Exit Function
    Dim m As Long, j As Long: m = CLng(Mid$(s, 6, 2)): j = CLng(Right$(s, 2))
    If m < 1 Or m > 12 Or j < 1 Or j > 31 Then Exit Function
    DateDep = DateSerial(CLng(Left$(s, 4)), m, j)
End Function

' Analyse les depenses ; remplit iss et renvoie un resume pour le rapport.
Public Function AnalyserDepenses(iss As Collection) As String
    Dim lo As ListObject
    On Error Resume Next
    Set lo = ThisWorkbook.Worksheets("_Depenses").ListObjects("tblDepenses")
    On Error GoTo fail
    If lo Is Nothing Then
        AnalyserDepenses = Src() & " : table locale absente (aucune synchro encore faite)."
        Exit Function
    End If

    Dim seen As Object: Set seen = CreateObject("Scripting.Dictionary")
    Dim loc As Object: Set loc = CreateObject("Scripting.Dictionary")
    Dim nowMs As Double: nowMs = (Now - DateSerial(1970, 1, 1)) * 86400000#
    Dim i As Long, r As Range, id As String, veh As String, dS As String, lib As String
    Dim mnt As Double, modMs As Double, sup As Boolean, k As String, desc As String
    Dim dt As Variant, nAct As Long, nSup As Long

    For i = 1 To lo.ListRows.Count
        Set r = lo.ListRows(i).Range
        id = Trim$(CStr(r.Cells(1, 1).Value))
        If Len(id) > 0 Then
            veh = CStr(r.Cells(1, 2).Value)
            dS = CStr(r.Cells(1, 3).Value)
            lib = CStr(r.Cells(1, 5).Value)
            mnt = Val(Replace(CStr(r.Cells(1, 6).Value), ",", "."))
            modMs = Val(CStr(r.Cells(1, 7).Value))
            sup = (Val(CStr(r.Cells(1, 8).Value)) = 1)
            loc(id) = IIf(sup, 1, 0)
            dt = DateDep(r.Cells(1, 3).Value)
            desc = "'" & lib & "' (" & veh & ", " & Format$(mnt, "0.00") & " " & ChrW(8364) & ")"
            If sup Then
                nSup = nSup + 1
                If modMs > 0 And (nowMs - modMs) < JOURS_RECENT * 86400000# Then
                    AddDep iss, "Avertissement", Src() & " supprim" & eA & "e r" & eA & "cemment", r.Row, dt, id, _
                        desc & " supprim" & eA & "e le " & _
                        Format$(DateSerial(1970, 1, 1) + modMs / 86400000#, "dd/mm/yyyy") & _
                        IIf(mnt > 0, " - restaurable.", " - restaurable (montant inconnu)."), FX_RESTDEP
                End If
            Else
                nAct = nAct + 1
                If IsEmpty(dt) Then
                    AddDep iss, "Erreur", "Date de d" & eA & "pense invalide", r.Row, Empty, id, _
                        desc & " : date '" & dS & "' illisible (attendu aaaa-mm-jj).", ""
                End If
                If mnt <= 0 Then
                    AddDep iss, "Avertissement", "Montant nul ou n" & eA & "gatif", r.Row, dt, id, _
                        desc & " : montant <= 0.", ""
                End If
                k = LCase$(Trim$(veh)) & "|" & dS & "|" & LCase$(Trim$(lib)) & "|" & Format$(mnt, "0.00")
                If seen.Exists(k) Then
                    AddDep iss, "Avertissement", "Doublon de d" & eA & "pense", r.Row, dt, id, _
                        desc & " : m" & ChrW(234) & "me v" & eA & "hicule, date, intitul" & eA & _
                        " et montant que la ligne " & seen(k) & ".", ""
                Else
                    seen(k) = r.Row
                End If
            End If
        End If
    Next i

    ' Comparaison Excel <-> Google Sheet (ids et etat supprime)
    Dim srv As Object, kk As Variant, nEcart As Long, msgSrv As String
    Set srv = modSyncDepenses.EtatServeurDepenses()
    If srv Is Nothing Then
        msgSrv = " Google Sheet injoignable."
    Else
        For Each kk In srv.Keys
            If Not loc.Exists(kk) Then
                nEcart = nEcart + 1
            ElseIf loc(kk) <> srv(kk) Then
                nEcart = nEcart + 1
            End If
        Next kk
        For Each kk In loc.Keys
            If Not srv.Exists(kk) Then nEcart = nEcart + 1
        Next kk
        If nEcart > 0 Then
            AddDep iss, "Avertissement", Src() & " : " & eA & "cart Excel / Google Sheet", Empty, Empty, "", _
                nEcart & " d" & eA & "pense(s) diff" & eA & "rente(s) entre l'Excel et le Google Sheet " & _
                "(synchro en attente ?).", FX_SYNCDEP
        End If
        msgSrv = " Google Sheet : " & srv.Count & " ligne(s)."
    End If
    AnalyserDepenses = Src() & " : " & nAct & " active(s), " & nSup & " supprim" & eA & "e(s) (Excel)." & msgSrv
    Exit Function
fail:
    AnalyserDepenses = Src() & " : erreur " & Err.Number & " (" & Err.Description & ")."
End Function
