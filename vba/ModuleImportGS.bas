Option Explicit

Private Const SHEET_SUIVI      As String = "Suivi Carburant"
Private Const SHEET_IMPORT     As String = "_ImportGS"
Private Const TABLE_SUIVI      As String = "Tableau2"
Private Const CELL_LAST_IMPORT As String = "Z1"

Private Const GS_SHEET_ID As String = "1uN170kt_n45sBRwqs2krTYfhapU3dMKjTguD-qSUqCE"

'=========================================================================
'  Bouton "Importer pleins" / activation de l'onglet "Suivi Carburant"
'  Audit 03/10/2026 : l'ancien import CSV (gviz) AJOUTAIT des lignes en
'  VALEURS figees a la fin de Tableau2 (dedup par contenu km|litres|prix).
'  Or Tableau2 est une vue DERIVEE de GS_Pleins (formules INDEX par position) :
'  des que Tableau2 etait en retard (import a +2 s AVANT la sync a +5 s,
'  suppression Excel sans recalage), il recopiait des pleins deja presents
'  -> doublons fantomes (plein 45 = plein 43). Desormais Tableau2 n'est
'  alimente QUE par la sync (sync_id) + SyncTableau2DepuisGS.
'    bSilent = True  : recalage local seul (aucun appel reseau)
'    bSilent = False : synchronisation complete puis recalage
'=========================================================================
Public Sub ImporterNouveauxPleins(Optional bSilent As Boolean = False)
    On Error Resume Next
    If Not bSilent Then modSyncGS.SyncManuel
    If modFeatures.Tableau2ARecaler() Then modFeatures.SyncTableau2DepuisGS
    On Error GoTo 0
End Sub

Public Sub ImporterNouveauxPleinsAuto()
    Call ImporterNouveauxPleins(True)
End Sub

'=========================================================================
'  Protection de "Suivi Carburant" autour des operations de TABLEAU
'  La feuille est protegee (UserInterfaceOnly:=True) a chaque ouverture
'  (ThisWorkbook). Or UserInterfaceOnly N'AUTORISE PAS les operations
'  structurelles de ListObject (ListRows.Add/Delete) -> erreur 1004
'  "les fonctionnalites du tableau ne sont pas disponibles...". Il faut
'  donc Deverrouiller AVANT puis Reverrouiller APRES ces operations.
'  Reutilise par modFeatures.SyncTableau2DepuisGS. Tolerant (On Error).
'=========================================================================
Public Sub DeverrouillerSuivi()
    On Error Resume Next
    ThisWorkbook.Worksheets(SHEET_SUIVI).Unprotect Password:=""
    On Error GoTo 0
End Sub

Public Sub VerrouillerSuivi()
    On Error Resume Next
    ThisWorkbook.Worksheets(SHEET_SUIVI).Protect _
        Password:="", _
        UserInterfaceOnly:=True, _
        DrawingObjects:=False, Contents:=True, Scenarios:=False, _
        AllowFormattingColumns:=True
    On Error GoTo 0
End Sub

'=========================================================================
'  Bouton "Ré-importer tout" — repart de zéro
'=========================================================================
Public Sub ReinitialiserImport()
    Dim rep As VbMsgBoxResult
    rep = MsgBox("Réinitialiser le suivi d'import ?" & vbCrLf & vbCrLf & _
                 "Le prochain import récupérera TOUS les pleins du Google Sheet.", _
                 vbExclamation + vbYesNo, "Confirmer")
    If rep = vbYes Then
        ThisWorkbook.Worksheets(SHEET_SUIVI).Range(CELL_LAST_IMPORT).ClearContents
        SetStatus "[Import E85] " & ChrW(10003) & " Réinitialisation effectuée."
    End If
End Sub

'=========================================================================
'  Nettoyage des doublons -> delegue au controle d'integrite (modIntegrite)
'=========================================================================
Public Sub NettoyerDoublons()
    ' Audit 03/10/2026 : ne supprime plus de lignes au milieu de Tableau2 (vue
    ' positionnelle de GS_Pleins -> une suppression decale tous les pleins).
    ' Les doublons sont detectes et corriges par le controle d'integrite.
    modIntegrite.ControleIntegrite
End Sub

'=========================================================================
'  Téléchargement CSV + peuplement de la feuille _ImportGS
'=========================================================================
Private Function ChargerCSVDansFeuilleImport() As Boolean
    Dim csvData  As String
    Dim wsImport As Worksheet
    Dim tblOld   As ListObject
    Dim lo       As ListObject
    Dim lignes() As String
    Dim colonnes() As String
    Dim nbLignes As Long, nbCols As Long
    Dim i As Long, j As Long

    ChargerCSVDansFeuilleImport = False

    csvData = TelechargerCSV()
    If Len(csvData) = 0 Then Exit Function

    ' Récupérer ou créer la feuille _ImportGS
    On Error Resume Next
    Set wsImport = ThisWorkbook.Worksheets(SHEET_IMPORT)
    On Error GoTo 0
    If wsImport Is Nothing Then
        Set wsImport = ThisWorkbook.Worksheets.Add
        wsImport.name = SHEET_IMPORT
        wsImport.visible = xlSheetVeryHidden
    End If

    ' Vider la feuille
    Application.DisplayAlerts = False
    For Each tblOld In wsImport.ListObjects
        tblOld.Delete
    Next tblOld
    wsImport.Cells.ClearContents
    Application.DisplayAlerts = True

    ' Parser le CSV
    csvData = Replace(csvData, vbCrLf, vbLf)
    csvData = Replace(csvData, vbCr, vbLf)
    If Right(csvData, 1) = vbLf Then csvData = Left(csvData, Len(csvData) - 1)

    lignes = Split(csvData, vbLf)
    nbLignes = UBound(lignes) + 1

    If nbLignes < 2 Then
        SetStatus "[Import E85] Le Google Sheet ne contient pas encore de réponses " & _
                  "(vérifier que l'onglet '_ImportGS' existe et contient des données)."
        Exit Function
    End If

    ' En-têtes (ligne 0 du CSV)
    colonnes = ParseCSVLine(lignes(0))
    nbCols = UBound(colonnes) + 1
    For j = 0 To nbCols - 1
        wsImport.Cells(1, j + 1).value = Trim(colonnes(j))
    Next j

    ' Données (lignes 1..n)
    For i = 1 To nbLignes - 1
        If Trim(lignes(i)) = "" Then GoTo SuivanteLigne
        colonnes = ParseCSVLine(lignes(i))
        For j = 0 To UBound(colonnes)
            wsImport.Cells(i + 1, j + 1).value = colonnes(j)
        Next j
SuivanteLigne:
    Next i

    ' Créer le ListObject
    Dim rng As Range
    Set rng = wsImport.Range(wsImport.Cells(1, 1), wsImport.Cells(nbLignes, nbCols))
    Set lo = wsImport.ListObjects.Add(xlSrcRange, rng, , xlYes)
    lo.name = "DonneesExternes_1"

    ChargerCSVDansFeuilleImport = True
End Function

'=========================================================================
'  Téléchargement HTTP — cible l'onglet _ImportGS par son nom
'  URL 1 (principale) : gviz/tq avec sheet=_ImportGS  ? CORRECTIF
'  URL 2 (fallback)   : export direct gid=0
'=========================================================================
Private Function TelechargerCSV() As String
    Dim http    As Object
    Dim urls(1) As String
    Dim url     As String
    Dim statut  As Long
    Dim k       As Integer

    ' ? URL 1 : cible l'onglet _ImportGS par son nom (fix principal)
    urls(0) = "https://docs.google.com/spreadsheets/d/" & GS_SHEET_ID & _
              "/gviz/tq?tqx=out:csv&sheet=_ImportGS"
    ' URL 2 : export direct — garde en fallback
    urls(1) = "https://docs.google.com/spreadsheets/d/" & GS_SHEET_ID & _
              "/export?format=csv&gid=0"

    On Error GoTo ErrHTTP

    Set http = CreateObject("WinHttp.WinHttpRequest.5.1")
    http.Option(6) = True   ' suit automatiquement les redirections Google

    For k = 0 To 1
        url = urls(k)
        http.Open "GET", url, False
        http.setRequestHeader "User-Agent", "Mozilla/5.0"
        http.setRequestHeader "Cache-Control", "no-cache"
        http.Send

        statut = http.status

        If statut = 200 Then
            TelechargerCSV = http.ResponseText
            Exit Function
        End If
    Next k

    SetStatus "[Import E85] " & ChrW(9888) & " Google Sheets a répondu HTTP " & statut & _
              " (vérifier le partage du Sheet : « Tout le monde avec le lien peut consulter »)."
    TelechargerCSV = ""
    Exit Function

ErrHTTP:
    SetStatus "[Import E85] " & ChrW(9888) & " Erreur réseau (" & Err.Number & ") : " & _
              Err.Description & " (accès Internet / proxy / pare-feu)."
    TelechargerCSV = ""
End Function

'=========================================================================
'  Parse une ligne CSV (gère les champs entre guillemets)
'=========================================================================
Private Function ParseCSVLine(ByVal ligne As String) As String()
    Dim result()  As String
    Dim nb        As Long
    Dim i         As Long
    Dim c         As String
    Dim inQuotes  As Boolean
    Dim champ     As String

    nb = 0
    ReDim result(0)
    inQuotes = False
    champ = ""

    For i = 1 To Len(ligne)
        c = Mid(ligne, i, 1)
        If inQuotes Then
            If c = Chr(34) Then
                If Mid(ligne, i + 1, 1) = Chr(34) Then
                    champ = champ & Chr(34)
                    i = i + 1
                Else
                    inQuotes = False
                End If
            Else
                champ = champ & c
            End If
        Else
            If c = Chr(34) Then
                inQuotes = True
            ElseIf c = "," Then
                result(nb) = champ
                nb = nb + 1
                ReDim Preserve result(nb)
                champ = ""
            Else
                champ = champ & c
            End If
        End If
    Next i
    result(nb) = champ
    ParseCSVLine = result
End Function

'=========================================================================
'  Outil de diagnostic — crée un onglet DiagLog pour déboguer
'=========================================================================
Public Sub DiagnosticImport()
    Dim wsImport       As Worksheet
    Dim wsSuivi        As Worksheet
    Dim tblImport      As ListObject
    Dim cellLastImport As Range
    Dim i As Long, ligne As Long
    Dim ligneSrc       As ListRow
    Dim horodatageTxt  As String, horodatage As Date
    Dim dernierHorodatage As Date
    Dim wsLog          As Worksheet

    On Error GoTo Erreur

    On Error Resume Next
    Set wsLog = ThisWorkbook.Worksheets("DiagLog")
    On Error GoTo Erreur
    If wsLog Is Nothing Then
        Set wsLog = ThisWorkbook.Worksheets.Add
        wsLog.name = "DiagLog"
    Else
        wsLog.Cells.ClearContents
    End If

    wsLog.Cells(1, 1) = "Ligne"
    wsLog.Cells(1, 2) = "Horodatage brut"
    wsLog.Cells(1, 3) = "Horodatage parsé"
    wsLog.Cells(1, 4) = "Statut"
    ligne = 2

    SetStatus "Diagnostic : téléchargement en cours…"
    If Not ChargerCSVDansFeuilleImport() Then GoTo Fin

    Set wsImport = ThisWorkbook.Worksheets(SHEET_IMPORT)
    Set wsSuivi = ThisWorkbook.Worksheets(SHEET_SUIVI)
    Set cellLastImport = wsSuivi.Range(CELL_LAST_IMPORT)

    If IsDate(cellLastImport.value) Then
        dernierHorodatage = cellLastImport.value
    Else
        dernierHorodatage = DateSerial(1900, 1, 1)
    End If

    If wsImport.ListObjects.count > 0 Then
        Set tblImport = wsImport.ListObjects(1)
        If Not tblImport.DataBodyRange Is Nothing Then
            For Each ligneSrc In tblImport.ListRows
                horodatageTxt = CStr(ligneSrc.Range.Cells(1, 1).value)
                wsLog.Cells(ligne, 1) = ligne - 1
                wsLog.Cells(ligne, 2) = horodatageTxt
                If Len(horodatageTxt) = 0 Then
                    wsLog.Cells(ligne, 4) = "IGNORÉE - horodatage vide"
                    GoTo Suite
                End If
                ' Vraie date (cellule PQ) lue telle quelle : CStr + re-parse inversait
                ' jour/mois (11/09 -> 9 novembre, cf. Z1 du 03/10/2026, lecon #27).
                On Error Resume Next
                If IsDate(ligneSrc.Range.Cells(1, 1).value) Then
                    horodatage = CDate(ligneSrc.Range.Cells(1, 1).value)
                Else
                    horodatage = ParseGoogleDateTime(horodatageTxt)
                End If
                On Error GoTo Erreur
                wsLog.Cells(ligne, 3) = Format(horodatage, "dd/mm/yyyy hh:mm:ss")
                If horodatage <= dernierHorodatage Then
                    wsLog.Cells(ligne, 4) = "IGNORÉE - déjà importée"
                Else
                    wsLog.Cells(ligne, 4) = "OK - serait importée"
                End If
Suite:
                ligne = ligne + 1
            Next ligneSrc
        End If
    End If

    wsLog.Columns("A:D").AutoFit
    wsLog.Activate
    SetStatus "[Diag E85] " & ChrW(10003) & " Diagnostic terminé. Résultats dans l'onglet 'DiagLog'."
Fin:
    Exit Sub
Erreur:
    SetStatus "[Diag E85] " & ChrW(9888) & " Erreur " & Err.Number & " : " & Err.Description
End Sub

'=========================================================================
'  Helpers
'=========================================================================
Public Sub SetStatus(msg As String)
    Application.StatusBar = msg
    DoEvents
End Sub

Public Sub ResetStatus()
    Application.StatusBar = False
End Sub

' Clé naturelle d'un plein pour la déduplication.
' Basée sur km|litres|prix (PAS la date) : robuste même si une date est mal parsée.
' Le compteur kilométrique est strictement croissant ? identifie un plein de façon fiable.
Private Function PleinKey(vKm As Variant, vLitres As Variant, vPrix As Variant) As String
    PleinKey = CStr(CLng(ToDouble(vKm))) & "|" & _
               Format(ToDouble(vLitres), "0.00") & "|" & _
               Format(ToDouble(vPrix), "0.000")
End Function

Private Function ToDouble(v As Variant) As Double
    ' Robuste : ne leve jamais d'erreur 13 (texte non numerique -> 0)
    Dim s As String, sep As String
    On Error GoTo Fail
    If IsNumeric(v) Then
        ToDouble = CDbl(v)
        Exit Function
    End If
    sep = Application.International(xlDecimalSeparator)
    s = Trim(CStr(v))
    s = Replace(s, ".", sep)
    s = Replace(s, ",", sep)
    If Len(s) > 0 And IsNumeric(s) Then
        ToDouble = CDbl(s)
    Else
        ToDouble = 0
    End If
    Exit Function
Fail:
    ToDouble = 0
End Function

Public Function ParseGoogleDate(s As String) As Date
    Dim parts() As String
    Dim a As Long, b As Long, c As Long
    s = Trim(s)
    If Len(s) = 0 Then ParseGoogleDate = DateSerial(1900, 1, 1): Exit Function
    ' Cas numérique (serial date Excel)
    If IsNumeric(s) Then
        On Error Resume Next
        ParseGoogleDate = CDate(CDbl(s))
        If Err.Number <> 0 Then Err.Clear: ParseGoogleDate = DateSerial(1900, 1, 1)
        On Error GoTo 0
        Exit Function
    End If
    ' Retirer la partie heure : "2026-05-24T00:00:00" (ISO) ou "5/22/2026 2:00:00" (gviz US)
    Dim tPos As Integer: tPos = InStr(s, "T")
    If tPos > 0 Then s = Left(s, tPos - 1)
    Dim spPos As Integer: spPos = InStr(s, " ")
    If spPos > 0 Then s = Left(s, spPos - 1)
    On Error Resume Next
    If InStr(s, "-") > 0 Then
        parts = Split(s, "-")
        If UBound(parts) >= 2 Then
            ParseGoogleDate = DateSerial(CInt(parts(0)), CInt(parts(1)), CInt(parts(2)))
        End If
    ElseIf InStr(s, "/") > 0 Then
        parts = Split(s, "/")
        If UBound(parts) >= 2 Then
            a = CLng(parts(0)): b = CLng(parts(1)): c = CLng(parts(2))
            If c < 100 Then c = c + 2000
            If a > 12 Then
                ' jour en premier (J/M/A)
                ParseGoogleDate = DateSerial(c, b, a)
            Else
                ' format US M/J/A renvoyé par gviz : mois en premier
                ParseGoogleDate = DateSerial(c, a, b)
            End If
        End If
    Else
        ParseGoogleDate = CDate(s)
    End If
    If Err.Number <> 0 Then Err.Clear: ParseGoogleDate = DateSerial(1900, 1, 1)
    On Error GoTo 0
End Function

Private Function ParseGoogleDateTime(s As String) As Date
    Dim p As Integer, timePart As String, dotPos As Integer
    s = Trim(s)
    p = InStr(s, " ")
    If p > 0 Then
        On Error Resume Next
        timePart = Mid(s, p + 1)
        dotPos = InStr(timePart, ".")
        If dotPos = 0 Then dotPos = InStr(timePart, ",")
        If dotPos > 0 Then timePart = Left(timePart, dotPos - 1)
        ParseGoogleDateTime = ParseGoogleDate(Left(s, p - 1)) + TimeValue(timePart)
        If Err.Number <> 0 Then
            Err.Clear
            ParseGoogleDateTime = ParseGoogleDate(Left(s, p - 1))
        End If
        On Error GoTo 0
    Else
        ParseGoogleDateTime = ParseGoogleDate(s)
    End If
End Function

