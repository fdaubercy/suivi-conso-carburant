Attribute VB_Name = "modSyncJson"
' ============================================================
'  modSyncJson - Helpers JSON/format PURS (X44)
' ============================================================
'  Extrait de modSyncGS : serialisation/parse JSON sans etat module.
'  Rendu Public pour reutilisation (modSyncGS, modSyncParametres).
Option Explicit

Public Function Euro() As String:   Euro = ChrW(8364): End Function

Public Function eAcc() As String:   eAcc = ChrW(233):  End Function

Public Function k(s As String) As String
    k = Replace(Replace(s, "{E}", Euro()), "{e}", eAcc())
End Function

Public Function JsonGet(jsonObj As String, key As String) As String
    Dim pat As String
    Dim pos As Long
    Dim ch  As String
    Dim vs  As Long
    Dim ve  As Long
    Dim ns  As Long

    pat = """" & key & """:"
    pos = InStr(jsonObj, pat)
    If pos = 0 Then Exit Function
    pos = pos + Len(pat)

    Do While pos <= Len(jsonObj) And Mid(jsonObj, pos, 1) = " "
        pos = pos + 1
    Loop

    ch = Mid(jsonObj, pos, 1)

    If ch = """" Then
        vs = pos + 1
        ve = vs
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

Public Function ParseRecords(jsonStr As String) As String()
    Dim emp(0)   As String
    Dim parts()  As String
    Dim result() As String
    Dim p        As Long
    Dim endP     As Long
    Dim arr      As String
    Dim i        As Long
    Dim n        As Long
    Dim s        As String

    emp(0) = ""

    p = InStr(jsonStr, """records"":[")
    If p = 0 Then
        ParseRecords = emp
        Exit Function
    End If
    p = p + Len("""records"":[")

    endP = InStrRev(jsonStr, "]")
    If endP <= p Then
        ParseRecords = emp
        Exit Function
    End If

    arr = Trim(Mid(jsonStr, p, endP - p))
    If arr = "" Then
        ParseRecords = emp
        Exit Function
    End If

    parts = Split(arr, "},{")
    n = UBound(parts)
    ReDim result(n)

    For i = 0 To n
        s = parts(i)
        If Left(s, 1) <> "{" Then s = "{" & s
        If Right(s, 1) <> "}" Then s = s & "}"
        result(i) = s
    Next i

    ParseRecords = result
End Function

Public Function ParseDeletedIds(jsonStr As String) As String()
    Dim emp(0) As String: emp(0) = ""
    Dim p As Long, endP As Long, arr As String
    Const tag As String = """deleted"":["

    p = InStr(jsonStr, tag)
    If p = 0 Then ParseDeletedIds = emp: Exit Function
    p = p + Len(tag)
    endP = InStr(p, jsonStr, "]")
    If endP <= p Then ParseDeletedIds = emp: Exit Function

    arr = Trim(Mid(jsonStr, p, endP - p))
    If arr = "" Then ParseDeletedIds = emp: Exit Function

    Dim parts() As String: parts = Split(arr, ",")
    Dim i As Long, s As String
    For i = 0 To UBound(parts)
        s = Trim(parts(i))
        If Left(s, 1) = """" Then s = Mid(s, 2)
        If Right(s, 1) = """" Then s = Left(s, Len(s) - 1)
        parts(i) = Trim(s)
    Next i
    ParseDeletedIds = parts
End Function

Public Function jS(key As String, val As String) As String
    val = Replace(val, "\", "\\")
    val = Replace(val, """", "\""")
    jS = """" & key & """:""" & val & """"
End Function

Public Function jN(key As String, val As Variant) As String
    Dim n As String
    If IsEmpty(val) Or IsNull(val) Or val = "" Then
        n = "null"
    ElseIf IsNumeric(val) Then
        n = Replace(CStr(CDbl(val)), ",", ".")
    Else
        n = "null"
    End If
    jN = """" & key & """:" & n
End Function

Public Function JEsc(ByVal s As String) As String
    s = Replace(s, "\", "\\")
    s = Replace(s, """", "\""")
    JEsc = s
End Function

Public Function ParseDt(s As String) As Variant
    Dim norm  As String
    Dim sp    As Long
    Dim dotP  As Long
    Dim dStr  As String
    Dim tStr  As String
    Dim dp()  As String
    Dim tp()  As String
    Dim y As Integer, m As Integer, d As Integer
    Dim hH As Integer, mm As Integer, ss As Integer

    If s = "" Then
        ParseDt = ""
        Exit Function
    End If

    On Error GoTo Bad

    norm = s
    norm = Replace(norm, "T", " ")

    dotP = InStr(norm, ".")
    If dotP > 0 Then norm = Left(norm, dotP - 1)
    If Right(norm, 1) = "Z" Then norm = Left(norm, Len(norm) - 1)

    sp = InStr(norm, " ")
    If sp > 0 Then
        dStr = Left(norm, sp - 1)
        tStr = Mid(norm, sp + 1)
    Else
        dStr = norm
        tStr = ""
    End If

    dp = Split(dStr, "-")
    If UBound(dp) <> 2 Then GoTo Bad
    y = CInt(dp(0)): m = CInt(dp(1)): d = CInt(dp(2))

    If tStr <> "" Then
        tp = Split(tStr, ":")
        If UBound(tp) >= 2 Then
            hH = CInt(tp(0)): mm = CInt(tp(1)): ss = CInt(tp(2))
            ParseDt = DateSerial(y, m, d) + TimeSerial(hH, mm, ss)
        Else
            ParseDt = DateSerial(y, m, d)
        End If
    Else
        ParseDt = DateSerial(y, m, d)
    End If
    Exit Function
Bad:
    ParseDt = ""
End Function

Public Function IsoToDate(iso As String) As Variant
    IsoToDate = ParseDt(iso)
End Function

Public Function GenerateUUID() As String
    Dim g As String
    On Error GoTo Fallback
    g = CreateObject("Scriptlet.TypeLib").GUID
    GenerateUUID = Mid(g, 2, Len(g) - 2)
    Exit Function
Fallback:
    Randomize
    GenerateUUID = Format(now(), "yyyymmddHHmmss") & "-" & _
                   Right("000000" & CStr(Int(Rnd() * 1000000)), 6) & "-" & _
                   Right("000000" & CStr(Int(Rnd() * 1000000)), 6)
End Function
