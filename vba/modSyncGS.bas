Attribute VB_Name = "modSyncGS"
' ============================================================
'  SUIVI E85 - Synchronisation bidirectionnelle
'  Google Sheets (_ImportGS) <-> Excel (GS_Pleins)
'
'  v2.10.0.0 (S3 / S4 / S5)  [necessite Code.gs v3.8.0.0 + redeploiement]
'    [S3] Suppression bidirectionnelle :
'         - GS soft-delete (col R "Supprime" = horodatage tombstone).
'         - handleExport renvoie un tableau "deleted":[sync_id,...] :
'           le sync efface localement les lignes supprimees cote web/GS.
'         - SupprimerPleinExcel : supprime le plein selectionne dans
'           GS_Pleins, propage la suppression a GS (action=bulkDelete),
'           puis retire la ligne locale.
'    [S4] ForceResync : vide la table GS_Pleins et re-importe TOUT depuis
'         GS (reset en cas de desalignement). Confirmation requise.
'    [S5] Resolution de conflit par horodatage : si un meme sync_id est
'         modifie des 2 cotes, on garde le plus recent (col Q Excel
'         "Modifie_local" vs champ GS "Modifie_le") au lieu d'un
'         Excel-wins systematique. modifiedAt est envoye dans le
'         bulkUpdate pour que GAS arbitre aussi cote serveur.
'
'  v2.9.2.0
'    [X22] Garde-fou : la recreation auto des graphiques ne se declenche
'          que si l'onglet "Graphiques" existe deja (GraphSheetExists).
'
'  v2.9.1.0
'    [F6] Recreation auto des graphiques (modGraphiques.CreerGraphiquesWeb
'         en mode silencieux) en fin de SyncCore si donnees changees.
'
'  v2.9.0.0
'    [F1] Auto sync_id a la saisie   (dans GS_Pleins_snippet.bas)
'    [F2] Col P = last_modified       marquage dirty pour sync bidir.
'    [F3] Validation km               (dans GS_Pleins_snippet.bas)
'    [F4] Detection doublons          (dans GS_Pleins_snippet.bas)
'    [F5] Sync bidir. modifications   Excel->GS : bulkUpdate si col P set
'                                     GS->Excel : MAJ locale si non dirty
'
'  NOTE GAS : pour que [F5] propage les modifs Excel->GS,
'  ajouter dans le Apps Script un handler action=bulkUpdate
'  (upsert par sync_id). Exemple minimal :
'    case 'bulkUpdate':
'      var rows = data.rows;
'      rows.forEach(function(row) {
'        var sid = row.sync_id;
'        // trouver la ligne par sync_id, mettre a jour les champs
'      });
'      return ContentService.createTextOutput(
'        JSON.stringify({status:'ok',updated:rows.length}))
'        .setMimeType(ContentService.MimeType.JSON);
' ============================================================
Option Explicit

Private Const GAS_URL     As String = "https://script.google.com/macros/s/AKfycbwIyCfZVTpDOGBANtFcHECcCdbg4J4t377pKQjIJ0NJYFT9FMjZm5_6XOsyQAas8jeTyA/exec"
' S6 - Token secret partage avec js/config.js (APP_TOKEN) et la propriete
' de script APP_TOKEN du projet Apps Script. Mode souple : tant que la
' propriete APP_TOKEN n'est pas posee cote GAS, ce token est ignore.
Private Const APP_TOKEN   As String = "e85_a7f3c9e21b8d4f60a5c3e8b7d12f6049"
Private Const WS_NAME     As String = "GS_Pleins"
Private Const COL_SYNC_ID  As Integer = 15  ' O
Private Const COL_PHOTO    As Integer = 16  ' P  URL Drive photo ticket (importee depuis GS)
Private Const COL_MODIFIED As Integer = 17  ' Q  timestamp derniere modif locale (col interne, hors GS)

' Liste curee des stations essence (poussee vers la feuille "Stations" du GS)
Private Const STATIONS_WS  As String = "Notes"
Private Const STATIONS_TBL As String = "tbl_stationEssence"

Private Const T_RESOLVE  As Long = 5000
Private Const T_CONNECT  As Long = 10000
Private Const T_SEND     As Long = 30000
Private Const T_RECEIVE  As Long = 30000

Private Function Euro() As String:   Euro = ChrW(8364): End Function
Private Function eAcc() As String:   eAcc = ChrW(233):  End Function

Private Function k(s As String) As String
    k = Replace(Replace(s, "{E}", Euro()), "{e}", eAcc())
End Function

' ============================================================
'  CLE PROPRIETAIRE PRIVEE (SYNC_SECRET)
'  Depuis le passage aux comptes Google (REQUIRE_AUTH), l'export GAS exige
'  une identite. Le VBA ne peut pas fournir d'idToken Google : il presente
'  donc cette cle privee (cote serveur = propriete de script SYNC_SECRET) qui
'  resout vers le compte proprietaire. La cle est stockee dans le REGISTRE
'  LOCAL (HKCU) via GetSetting/SaveSetting -> jamais dans le code ni le depot.
'
'  MISE EN PLACE (une fois) :
'   1. Editeur Apps Script -> executer genererSyncSecret() -> copier la valeur
'      affichee dans les Logs (Affichage > Journaux).
'   2. Ici : Alt+F8 -> PoserSyncSecret -> coller la valeur.
' ============================================================
Private Function SyncSecret() As String
    SyncSecret = GetSetting("SuiviE85", "Sync", "OwnerSecret", "")
End Function

' Suffixe de query-string "&syncSecret=..." (vide si non configuree).
' Le secret est alphanumerique (+ '_') -> pas d'encodage URL necessaire.
Private Function SyncSecretQS() As String
    Dim s As String: s = SyncSecret()
    If Len(s) > 0 Then SyncSecretQS = "&syncSecret=" & s Else SyncSecretQS = ""
End Function

Public Sub PoserSyncSecret()
    Dim s As String
    s = InputBox("Colle la cle SYNC_SECRET (obtenue via genererSyncSecret() " & _
                 "dans l'editeur Apps Script).", _
                 "Cle de synchro Excel <-> Google Sheets", SyncSecret())
    If StrPtr(s) = 0 Then Exit Sub                 ' bouton Annuler
    s = Trim(s)
    SaveSetting "SuiviE85", "Sync", "OwnerSecret", s
    If Len(s) > 0 Then
        MsgBox "Cle enregistree (locale a ce poste). La synchro peut reprendre.", _
               vbInformation, "SYNC_SECRET"
    Else
        MsgBox "Cle effacee.", vbInformation, "SYNC_SECRET"
    End If
End Sub


' ============================================================
'  HELPERS DE LOGGING
' ============================================================
Private Sub SetStatus(msg As String)
    Application.StatusBar = "[Sync E85] " & msg
    Debug.Print Format(now(), "hh:mm:ss") & "  " & msg
End Sub

Private Sub SetStatusBlock(title As String, body As String)
    Application.StatusBar = "[Sync E85] " & title
    Debug.Print String(60, "-")
    Debug.Print Format(now(), "hh:mm:ss") & "  " & title
    Debug.Print body
    Debug.Print String(60, "-")
End Sub

Private Sub ClearStatus()
    Application.StatusBar = False
End Sub


' ============================================================
'  DIAGNOSTIC
' ============================================================
Public Sub TestConnexion()
    Dim url    As String: url = GAS_URL & "?action=export&token=" & APP_TOKEN & SyncSecretQS()
    Dim status As Long
    Dim body   As String
    Dim errTxt As String
    Dim driver As String
    Dim h      As Object

    On Error Resume Next

    Set h = CreateObject("WinHttp.WinHttpRequest.5.1")
    If Err.Number = 0 Then
        driver = "WinHttp.WinHttpRequest.5.1"
        h.SetTimeouts T_RESOLVE, T_CONNECT, T_SEND, T_RECEIVE
        h.Open "GET", url, False
        h.Send
        If Err.Number <> 0 Then errTxt = Err.Description: Err.Clear
    Else
        Err.Clear
        Set h = CreateObject("MSXML2.XMLHTTP60")
        If Err.Number = 0 Then
            driver = "MSXML2.XMLHTTP60"
            h.Open "GET", url, False
            h.Send
            If Err.Number <> 0 Then errTxt = Err.Description: Err.Clear
        Else
            errTxt = "Aucun composant HTTP disponible."
            Err.Clear
        End If
    End If

    If errTxt = "" And Not h Is Nothing Then
        status = h.status
        body = Left(h.ResponseText, 300)
    End If
    On Error GoTo 0

    Dim cause As String
    If errTxt <> "" Then
        cause = "ERREUR : " & errTxt
    ElseIf status = 200 And InStr(body, """records""") > 0 Then
        cause = "OK - reponse JSON valide."
    ElseIf status = 200 Then
        cause = "HTTP 200 mais pas de JSON. GAS pas re-deploye ?"
    ElseIf status = 0 Then
        cause = "Aucune reponse - probleme reseau."
    ElseIf status = 401 Or status = 403 Then
        cause = "Acces refuse (" & status & "). Verifier deploiement GAS."
    Else
        cause = "Code HTTP inattendu : " & status
    End If

    Dim summary As String
    summary = "HTTP " & status & " (" & IIf(driver = "", "aucun", driver) & ") - " & cause

    SetStatusBlock summary, _
        "Composant : " & IIf(driver = "", "aucun", driver) & vbNewLine & _
        "Code HTTP : " & status & vbNewLine & _
        "Diagnostic: " & cause & vbNewLine & _
        "Reponse   : " & body
End Sub


' ============================================================
'  DIAGNOSTIC DE SYNC
' ============================================================
Public Sub SyncDiagnose()
    Dim ws       As Worksheet
    Dim jsonStr  As String
    Dim gsRecs() As String
    Dim i        As Long
    Dim r        As Long
    Dim lastRow  As Long
    Dim sid      As String

    Dim nGsTotal       As Long
    Dim nGsWithSid     As Long
    Dim nLocalTotal    As Long
    Dim nLocalWithSid  As Long
    Dim nMatching      As Long
    Dim nOnlyGs        As Long
    Dim nOnlyLocal     As Long
    Dim nGsNoSid       As Long
    Dim nLocalNoSid    As Long
    Dim nDirty         As Long  ' v2.9 : lignes avec modif locale non syncees

    Set ws = ThisWorkbook.Sheets(WS_NAME)

    SetStatus "Diagnose : recuperation export GS..."
    jsonStr = HttpGet(GAS_URL & "?action=export&token=" & APP_TOKEN & SyncSecretQS())
    If jsonStr = "" Or InStr(jsonStr, """records""") = 0 Then
        SetStatus "Diagnose ERREUR : export GS inaccessible (lancer TestConnexion)"
        Exit Sub
    End If

    gsRecs = ParseRecords(jsonStr)

    Dim gsIds As Object
    Set gsIds = CreateObject("Scripting.Dictionary")
    gsIds.CompareMode = vbTextCompare

    nGsTotal = UBound(gsRecs) + 1
    If gsRecs(0) = "" Then nGsTotal = 0

    For i = 0 To UBound(gsRecs)
        If Len(gsRecs(i)) > 10 Then
            sid = JsonGet(gsRecs(i), "sync_id")
            If sid <> "" Then
                gsIds(sid) = True
                nGsWithSid = nGsWithSid + 1
            Else
                nGsNoSid = nGsNoSid + 1
            End If
        End If
    Next i

    Dim localIds As Object
    Set localIds = CreateObject("Scripting.Dictionary")
    localIds.CompareMode = vbTextCompare

    lastRow = ws.Cells(ws.rows.count, 1).End(xlUp).row
    nLocalTotal = lastRow - 1

    For r = 2 To lastRow
        sid = Trim(CStr(ws.Cells(r, COL_SYNC_ID).value))
        If sid <> "" Then
            localIds(sid) = True
            nLocalWithSid = nLocalWithSid + 1
        Else
            nLocalNoSid = nLocalNoSid + 1
        End If
        ' v2.9 : compter les lignes dirty (col P renseignee)
        If ws.Cells(r, COL_MODIFIED).value <> "" Then nDirty = nDirty + 1
    Next r

    Dim key As Variant
    For Each key In gsIds.keys
        If localIds.Exists(CStr(key)) Then
            nMatching = nMatching + 1
        Else
            nOnlyGs = nOnlyGs + 1
        End If
    Next key

    For Each key In localIds.keys
        If Not gsIds.Exists(CStr(key)) Then nOnlyLocal = nOnlyLocal + 1
    Next key

    Dim body As String
    body = "GOOGLE SHEETS (_ImportGS)" & vbNewLine & _
           "  Total enreg. : " & nGsTotal & vbNewLine & _
           "  Avec sync_id : " & nGsWithSid & vbNewLine & _
           "  Sans sync_id : " & nGsNoSid & " (ignores a l'import)" & vbNewLine & _
           vbNewLine & _
           "EXCEL (GS_Pleins)" & vbNewLine & _
           "  Total lignes : " & nLocalTotal & vbNewLine & _
           "  Avec sync_id : " & nLocalWithSid & vbNewLine & _
           "  Sans sync_id : " & nLocalNoSid & " (UUID genere au prochain sync)" & vbNewLine & _
           "  Modif. local.: " & nDirty & " (col P set -- seront envoyes en bulkUpdate)" & vbNewLine & _
           vbNewLine & _
           "INTERSECTIONS" & vbNewLine & _
           "  Communs (deja sync)  : " & nMatching & vbNewLine & _
           "  Seulement dans GS    : " & nOnlyGs & "  -> seront importes" & vbNewLine & _
           "  Seulement dans Excel : " & nOnlyLocal & "  -> seront envoyes"

    If nGsNoSid > 0 Then
        body = body & vbNewLine & vbNewLine & _
               "ATTENTION : " & nGsNoSid & " enreg. GS sans sync_id" & vbNewLine & _
               "-> Executer migrateSyncId() dans GAS Editor."
    End If

    If nDirty > 0 Then
        body = body & vbNewLine & vbNewLine & _
               "INFO v2.9 : " & nDirty & " ligne(s) avec modif. locale en attente." & vbNewLine & _
               "-> Lancer SyncManuel() pour propager vers GS (action=bulkUpdate)."
    End If

    Dim summary As String
    summary = "GS=" & nGsTotal & " (sid:" & nGsWithSid & ") | XL=" & nLocalTotal & _
              " (sid:" & nLocalWithSid & ") | dirty:" & nDirty & _
              " | sync->GS:" & nOnlyLocal & " ->XL:" & nOnlyGs

    SetStatusBlock "Diagnose : " & summary, body
End Sub


' ============================================================
'  FORMAT DATES FRANCAIS + INIT COL P
'  A appeler depuis Workbook_Open
' ============================================================
Public Sub ForceFormatDates()
    Dim ws  As Worksheet
    Dim tbl As ListObject

    On Error Resume Next
    Set ws = ThisWorkbook.Sheets(WS_NAME)
    If ws Is Nothing Then Exit Sub

    If ws.ListObjects.count > 0 Then Set tbl = ws.ListObjects(1)

    If Not tbl Is Nothing Then
        tbl.ListColumns(1).DataBodyRange.NumberFormat = "dd/mm/yyyy hh:mm:ss"
        tbl.ListColumns(2).DataBodyRange.NumberFormat = "dd/mm/yyyy"
    Else
        ws.Columns(1).NumberFormat = "dd/mm/yyyy hh:mm:ss"
        ws.Columns(2).NumberFormat = "dd/mm/yyyy"
    End If
    On Error GoTo 0

    ' v2.9 : initialiser l'en-tete et le format de la col P (last_modified)
    EnsureModifiedColHeader ws
End Sub

' Initialise les en-tetes des colonnes internes (P = Photo ticket importee de
' GS, Q = Modifie_local) et le format de la col Q. La requete Power Query pose
' deja l'en-tete "Photo ticket" (col P) : le test "" evite tout ecrasement.
Private Sub EnsureModifiedColHeader(ws As Worksheet)
    On Error Resume Next
    If CStr(ws.Cells(1, COL_PHOTO).value) = "" Then
        ws.Cells(1, COL_PHOTO).value = "Photo ticket"
    End If
    If CStr(ws.Cells(1, COL_MODIFIED).value) = "" Then
        ws.Cells(1, COL_MODIFIED).value = "Modifie_local"
        ws.Cells(1, COL_MODIFIED).Font.Italic = True
        ws.Cells(1, COL_MODIFIED).Font.color = RGB(150, 150, 150)
    End If
    ws.Columns(COL_MODIFIED).NumberFormat = "dd/mm/yyyy hh:mm:ss"
    On Error GoTo 0
End Sub


' ============================================================
'  POINTS D'ENTREE
' ============================================================
Public Sub SyncOnOpen()
    On Error Resume Next
    Dim a As Long
    Dim s As Long
    SyncCore a, s, True
    On Error GoTo 0
End Sub

Public Sub SyncManuel()
    Dim a As Long
    Dim s As Long
    SyncCore a, s, False
End Sub

' ============================================================
'  X1 : bouton "Synchroniser" sur la feuille GS_Pleins -> SyncManuel
'  Plus besoin d'Alt+F11/Alt+F8 pour lancer la sync. Idempotent (supprime
'  l'ancien avant recreation), place a droite de l'en-tete de la table
'  GS_Pleins (jamais par-dessus les donnees). Appele par Installer ;
'  lancable seul (Alt+F8 -> EnsureSyncButtonGSPleins). Persiste ensuite
'  dans le classeur enregistre.
' ============================================================
Public Sub EnsureSyncButtonGSPleins()
    Const BTN As String = "btnSyncGS"
    Const GS As String = "GS_Pleins"
    Dim ws As Worksheet
    On Error Resume Next
    Set ws = ThisWorkbook.Worksheets(GS)
    On Error GoTo 0
    If ws Is Nothing Then Exit Sub

    ' position FIXE en haut a gauche : GS_Pleins est une table pleine largeur
    '  (~1700 pt, 19 colonnes) sans marge -> tout placement relatif a la table
    '  finit hors ecran. Le bouton flotte sur le coin haut-gauche (au-dessus de
    '  l'en-tete "Date"), toujours visible a l'ouverture de la feuille.
    Dim L As Single, T As Single
    L = 5: T = 5

    On Error Resume Next
    ws.Shapes(BTN).Delete
    On Error GoTo 0

    Dim sh As Shape
    Set sh = ws.Shapes.AddShape(msoShapeRoundedRectangle, L, T, 120, 30)
    sh.name = BTN
    sh.Placement = xlFreeFloating
    sh.ZOrder msoBringToFront
    On Error Resume Next
    sh.fill.ForeColor.RGB = RGB(29, 158, 117)      ' vert charte (#1D9E75)
    sh.Line.visible = msoFalse
    With sh.TextFrame2
        .TextRange.text = "Synchroniser"
        .TextRange.Font.fill.ForeColor.RGB = RGB(255, 255, 255)
        .TextRange.Font.bold = msoTrue
        .TextRange.Font.Size = 11
        .TextRange.ParagraphFormat.Alignment = msoAlignCenter
        .HorizontalAnchor = msoAnchorCenter
        .VerticalAnchor = msoAnchorMiddle
    End With
    sh.OnAction = "SyncManuel"
    On Error GoTo 0
End Sub

' ============================================================
'  Rafraichit la Power Query "PrixHistory" (prix marche quotidien)
'  depuis le Google Sheet. Sans cet appel, l'onglet _PrixHistory
'  local reste FIGE : la requete ne se rafraichit pas toute seule
'  (contrairement a GS_Pleins, synchronise par le VBA) -> dates
'  manquantes. BackgroundQuery = False => refresh COMPLET et
'  SYNCHRONE avant toute lecture : aucune donnee loupee.
'  Appele a chaque SyncCore (donc a l'ouverture via SyncOnOpen et
'  a chaque SyncManuel) ; lancable seul (Alt+F8).
' ============================================================
Public Sub RafraichirPrixHistory(Optional silent As Boolean = False)
    Const pH As String = "PrixHistory"
    Dim ws As Worksheet, lo As ListObject, cn As WorkbookConnection
    Dim refreshed As Boolean

    Application.Cursor = xlWait

    ' 1) Voie principale : la QueryTable de la table "PrixHistory".
    For Each ws In ThisWorkbook.Worksheets
        For Each lo In ws.ListObjects
            If StrComp(lo.name, pH, vbTextCompare) = 0 Then
                On Error Resume Next
                If Not lo.QueryTable Is Nothing Then
                    lo.QueryTable.BackgroundQuery = False
                    lo.QueryTable.Refresh BackgroundQuery:=False
                    If Err.Number = 0 Then refreshed = True
                End If
                On Error GoTo 0
            End If
        Next lo
    Next ws

    ' 2) Repli : connexion Power Query dont le nom contient "PrixHistory"
    '    (le prefixe est localise : "Query - " ou "Requete - ").
    If Not refreshed Then
        On Error Resume Next
        For Each cn In ThisWorkbook.Connections
            If InStr(1, cn.name, pH, vbTextCompare) > 0 Then
                cn.OLEDBConnection.BackgroundQuery = False
                cn.Refresh
                If Err.Number = 0 Then refreshed = True
            End If
        Next cn
        On Error GoTo 0
    End If

    Application.Cursor = xlDefault
    If silent Then Exit Sub
    If refreshed Then
        SetStatus "[PrixHistory] " & ChrW(10003) & " Prix marche rafraichis depuis Google Sheets."
    Else
        SetStatus "[PrixHistory] " & ChrW(9888) & " Table 'PrixHistory' introuvable (importer powerquery\PrixHistory.m)."
    End If
End Sub

' ============================================================
'  S3 � Suppression d'un plein cote Excel + propagation a GS
'  A assigner a un bouton de la feuille GS_Pleins ou lancer
'  apres avoir selectionne la ligne du plein a supprimer.
' ============================================================
Public Sub SupprimerPleinExcel()
    Dim ws As Worksheet
    Set ws = ThisWorkbook.Sheets(WS_NAME)

    Dim r As Long
    r = ActiveCell.row
    If ActiveSheet.name <> WS_NAME Or r < 2 Then
        MsgBox "Selectionnez d'abord une ligne de plein dans la feuille '" & WS_NAME & "'.", _
               vbExclamation, "Supprimer un plein"
        Exit Sub
    End If
    If Trim(CStr(ws.Cells(r, 1).value)) = "" Then
        MsgBox "Ligne vide : rien a supprimer.", vbExclamation, "Supprimer un plein"
        Exit Sub
    End If

    Dim sid As String: sid = Trim(CStr(ws.Cells(r, COL_SYNC_ID).value))
    Dim dStr As String: dStr = ""
    If IsDate(ws.Cells(r, 2).value) Then dStr = Format(ws.Cells(r, 2).value, "dd/mm/yyyy") & " - "

    If MsgBox("Supprimer ce plein ?" & vbCrLf & vbCrLf & _
              dStr & CStr(ws.Cells(r, 3).value) & " - " & CStr(ws.Cells(r, 7).value) & vbCrLf & vbCrLf & _
              "La suppression sera propagee a Google Sheets.", _
              vbYesNo + vbQuestion, "Supprimer un plein") <> vbYes Then Exit Sub

    ' Propager a GS si le plein y est connu (sync_id present)
    If sid <> "" Then
        SetStatus "Suppression -> GS (sync_id " & Left(sid, 8) & ")..."
        Dim payload As String
        payload = "{""action"":""bulkDelete"",""token"":""" & APP_TOKEN & _
                  """,""ids"":[""" & JEsc(sid) & """]}"
        Dim resp As String: resp = HttpPost(GAS_URL, payload)
        Dim okGs As Boolean
        okGs = (resp <> "" And InStr(1, LCase(resp), "error") = 0)
        If Not okGs Then
            If MsgBox("Echec de la propagation a Google Sheets (GAS pas re-deploye ?)." & vbCrLf & _
                      "Supprimer quand meme la ligne locale ?", _
                      vbYesNo + vbExclamation, "Suppression GS") <> vbYes Then
                SetStatus "Suppression annulee."
                Exit Sub
            End If
        End If
    End If

    ' Supprimer la ligne locale (retire aussi la ligne du tableau)
    Application.EnableEvents = False
    ws.rows(r).Delete
    Application.EnableEvents = True

    SetStatus "Plein supprime (local" & IIf(sid <> "", " + GS", "") & ")."
End Sub

' ============================================================
'  S4 � Force resync : vide la table GS_Pleins et re-importe TOUT
'  depuis Google Sheets. Reset en cas de desalignement.
' ============================================================
Public Sub ForceResync()
    Dim ws As Worksheet
    Set ws = ThisWorkbook.Sheets(WS_NAME)

    If MsgBox("FORCE RESYNC" & vbCrLf & vbCrLf & _
              "Vider entierement la table locale '" & WS_NAME & "' puis tout" & vbCrLf & _
              "re-importer depuis Google Sheets ?" & vbCrLf & vbCrLf & _
              "ATTENTION : les modifications locales NON synchronisees" & vbCrLf & _
              "(col Q renseignee) seront perdues.", _
              vbYesNo + vbExclamation, "Force resync") <> vbYes Then Exit Sub

    On Error GoTo EH
    Application.Cursor = xlWait
    EnsureModifiedColHeader ws

    SetStatus "Force resync : telechargement GS..."
    Dim jsonStr As String
    jsonStr = HttpGet(GAS_URL & "?action=export&token=" & APP_TOKEN & SyncSecretQS())
    If jsonStr = "" Or InStr(jsonStr, """records""") = 0 Then
        Application.Cursor = xlDefault
        MsgBox "Export GS inaccessible. Force resync annule (table preservee).", _
               vbCritical, "Force resync"
        SetStatus "Force resync annule : GS inaccessible."
        Exit Sub
    End If

    ' Vider la table locale
    SetStatus "Force resync : vidage de la table locale..."
    Application.EnableEvents = False
    Dim tbl As ListObject
    If ws.ListObjects.count > 0 Then Set tbl = ws.ListObjects(1)
    If Not tbl Is Nothing Then
        If Not tbl.DataBodyRange Is Nothing Then tbl.DataBodyRange.Delete
    Else
        Dim lastRow As Long
        lastRow = ws.Cells(ws.rows.count, 1).End(xlUp).row
        If lastRow >= 2 Then ws.rows("2:" & lastRow).Delete
    End If
    Application.EnableEvents = True

    ' Re-importer tout
    SetStatus "Force resync : re-import complet..."
    Dim gsRecs() As String: gsRecs = ParseRecords(jsonStr)
    Dim localIds As Object: Set localIds = BuildLocalIndex(ws)
    Dim upd As Long
    Dim added As Long
    added = ImportGSToExcel(ws, gsRecs, localIds, upd)

    Application.Cursor = xlDefault
    SetStatus "Force resync OK : " & added & " plein(s) re-importes."

    If GraphSheetExists() Then
        On Error Resume Next
        CreerGraphiquesWeb silent:=True
        On Error GoTo 0
    End If

    MsgBox "Force resync termine." & vbCrLf & _
           added & " plein(s) re-importes depuis Google Sheets.", _
           vbInformation, "Force resync"
    Exit Sub
EH:
    Application.EnableEvents = True
    Application.Cursor = xlDefault
    SetStatus "Force resync ERREUR : " & Err.Description
    MsgBox "Erreur force resync : " & Err.Description, vbCritical, "Force resync"
End Sub

' X22 : vrai si l'onglet "Graphiques" existe deja dans le classeur
Private Function GraphSheetExists() As Boolean
    ' X36 : l'onglet du dashboard (ex-"Graphiques") est renomme "Tableau de bord".
    ' Repli sur l'ancien nom "Graphiques" tant que le renommage n'est pas fait.
    Dim ws As Worksheet
    On Error Resume Next
    Set ws = ThisWorkbook.Worksheets("Tableau de bord")
    If ws Is Nothing Then Set ws = ThisWorkbook.Worksheets("Graphiques")
    On Error GoTo 0
    GraphSheetExists = Not ws Is Nothing
End Function


' ============================================================
'  COEUR DU SYNC
' ============================================================
Private Sub SyncCore(ByRef addedFromGS As Long, ByRef sentToGS As Long, _
                     silentIfEmpty As Boolean)
    Dim ws          As Worksheet
    Dim jsonStr     As String
    Dim gsRecs()    As String
    Dim localIds    As Object
    Dim updFromGS   As Long   ' v2.9 : MAJ GS->Excel
    Dim sentUpdToGS As Long   ' v2.9 : MAJ Excel->GS (bulkUpdate)
    Dim tStart      As Date   ' X11 : chrono pour _SyncLog

    On Error GoTo ErrHandler

    tStart = now   ' X46 : pose le chrono avant tout (journalisation KO incluse)
    SetStatus "Connexion a Google Sheets..."
    Application.Cursor = xlWait

    Set ws = ThisWorkbook.Sheets(WS_NAME)

    ' v2.9 : s'assurer que la col P est bien initialisee
    EnsureModifiedColHeader ws

    jsonStr = HttpGet(GAS_URL & "?action=export&token=" & APP_TOKEN & SyncSecretQS())

    If jsonStr = "" Then
        SetStatus "ERREUR reseau - lancer TestConnexion() pour diagnostiquer"
        On Error Resume Next
        LogToSyncLog 0, 0, DateDiff("s", tStart, now), "KO reseau"
        On Error GoTo ErrHandler
        GoTo Cleanup
    End If

    If InStr(jsonStr, """records""") = 0 Then
        SetStatus "ERREUR : reponse non-JSON - GAS pas re-deploye ? (TestConnexion pour details)"
        On Error Resume Next
        LogToSyncLog 0, 0, DateDiff("s", tStart, now), "KO reponse GAS"
        On Error GoTo ErrHandler
        GoTo Cleanup
    End If

    SetStatus "Parsing JSON GS..."
    gsRecs = ParseRecords(jsonStr)

    ' Direction 0 : suppressions GS -> Excel (S3). Les lignes tombstone
    ' (col R "Supprime" cote GS) sont renvoyees dans "deleted":[sync_id,...].
    SetStatus "Suppressions GS -> Excel..."
    Dim delIds() As String
    delIds = ParseDeletedIds(jsonStr)
    Dim delFromGS As Long
    delFromGS = ApplyGSDeletions(ws, delIds)

    Set localIds = BuildLocalIndex(ws)

    ' Direction 1 : GS -> Excel (nouvelles lignes + MAJ si non dirty)
    SetStatus "Import GS -> Excel..."
    addedFromGS = ImportGSToExcel(ws, gsRecs, localIds, updFromGS)

    ' Direction 2a : Excel -> GS (nouvelles lignes)
    SetStatus "Export Excel -> GS (nouvelles lignes)..."
    sentToGS = ExportExcelToGS(ws, gsRecs)

    ' Direction 2b : Excel -> GS (modifications locales -- col P renseignee)
    SetStatus "Export Excel -> GS (modifications)..."
    sentUpdToGS = ExportModificationsToGS(ws, gsRecs)

    ' Direction 3 : push liste curee des stations Excel -> GS (feuille "Stations")
    SetStatus "Export stations curees -> GS..."
    Dim pushedStations As Long
    pushedStations = PushStationsToGS()

    ' P1 : synchro des parametres metier (miroir local = bloc F/G/H de
    ' l'onglet "Notes") <-> onglet "Parametres" du Google Sheet.
    ' Module autonome ; ne bloque pas la sync des pleins en cas d'echec.
    SetStatus "Sync parametres metier..."
    On Error Resume Next
    Dim paramSync As Long
    paramSync = modSyncParametres.SyncParametres()
    On Error GoTo ErrHandler

    ' Prix marche : rafraichit la Power Query "PrixHistory" depuis le Google
    ' Sheet (sinon l'onglet _PrixHistory local reste fige -> dates manquantes).
    ' Synchrone (BackgroundQuery=False) -> aucune donnee loupee. Tolerant.
    SetStatus "Refresh prix marche (_PrixHistory)..."
    On Error Resume Next
    RafraichirPrixHistory True
    On Error GoTo ErrHandler

    ' Bilan
    Dim msg As String
    msg = "OK :"
    msg = msg & " <-" & addedFromGS & " nouv."
    If updFromGS > 0 Then msg = msg & " +" & updFromGS & " MAJ"
    If delFromGS > 0 Then msg = msg & " -" & delFromGS & " suppr."
    msg = msg & " / ->" & sentToGS & " nouv."
    If sentUpdToGS > 0 Then msg = msg & " +" & sentUpdToGS & " MAJ"
    If pushedStations >= 0 Then msg = msg & " / stations:" & pushedStations
    If paramSync > 0 Then msg = msg & " / params:" & paramSync
    SetStatus msg

    ' X11 : journalise cette sync dans l'onglet _SyncLog (X46 : statut OK)
    On Error Resume Next
    LogToSyncLog addedFromGS, sentToGS, DateDiff("s", tStart, now), "OK"
    On Error GoTo ErrHandler

    ' Propage les lignes GS_Pleins -> vue derivee "Suivi Carburant" (Tableau2).
    ' Sans cela, un plein importe depuis Google Sheets reste dans GS_Pleins sans
    ' apparaitre dans "Suivi Carburant". Le nb de lignes change si ajout/suppr
    ' -> on realigne Tableau2 et on tire les colonnes brutes par formules INDEX.
    If (addedFromGS + delFromGS) > 0 Then
        On Error Resume Next
        modFeatures.SyncTableau2DepuisGS
        On Error GoTo ErrHandler
    End If

    ' v2.9.1 : recreation automatique des graphiques si des donnees ont
    ' change (ajout / MAJ dans un sens ou l'autre). Mode silencieux :
    ' aucune MsgBox bloquante meme a l'ouverture du classeur.
    ' X22 (v2.9.2) : on ne declenche QUE si l'onglet "Graphiques" existe
    ' deja -> pas de creation surprise sur un classeur qui ne s'en sert pas.
    If (addedFromGS + updFromGS + delFromGS + sentToGS + sentUpdToGS) > 0 Then
        ' X20 : declenche seulement si l'interrupteur "Graphiques auto" (B7) est actif
        If GraphSheetExists() And modGraphiques.GraphAutoActif() Then
            On Error Resume Next
            SetStatus msg & " / maj graphiques..."
            CreerGraphiquesWeb silent:=True
            SetStatus msg
            On Error GoTo 0
        End If
    End If

Cleanup:
    Application.Cursor = xlDefault
    Exit Sub

ErrHandler:
    Application.Cursor = xlDefault
    On Error Resume Next
    LogToSyncLog 0, 0, DateDiff("s", tStart, now), "KO " & Err.Description
    On Error GoTo 0
    SetStatus "ERREUR : " & Err.Description & " (TestConnexion pour verifier)"
End Sub


' ============================================================
'  DIRECTION 1 : GS -> EXCEL
'  - Nouvelles lignes GS non presentes localement : ajout
'  - Lignes existantes non dirty (col P vide)    : MAJ depuis GS si valeurs differentes
'  - Lignes existantes dirty (col P renseignee)  : Excel gagne, skip GS
' ============================================================
Private Function BuildLocalIndex(ws As Worksheet) As Object
    Dim dict    As Object
    Dim lastRow As Long
    Dim i       As Long
    Dim sid     As String

    Set dict = CreateObject("Scripting.Dictionary")
    dict.CompareMode = vbTextCompare
    lastRow = ws.Cells(ws.rows.count, 1).End(xlUp).row

    For i = 2 To lastRow
        sid = Trim(CStr(ws.Cells(i, COL_SYNC_ID).value))
        If sid <> "" Then dict(sid) = True
    Next i

    Set BuildLocalIndex = dict
End Function

' Construit un dictionnaire sid -> numero de ligne (pour les MAJ GS->Excel)
Private Function BuildLocalRowMap(ws As Worksheet) As Object
    Dim dict    As Object
    Dim lastRow As Long
    Dim i       As Long
    Dim sid     As String

    Set dict = CreateObject("Scripting.Dictionary")
    dict.CompareMode = vbTextCompare
    lastRow = ws.Cells(ws.rows.count, 1).End(xlUp).row

    For i = 2 To lastRow
        sid = Trim(CStr(ws.Cells(i, COL_SYNC_ID).value))
        If sid <> "" Then dict(sid) = i
    Next i

    Set BuildLocalRowMap = dict
End Function

' ============================================================
'  Garde anti-corruption : detecte une ligne "echo d'en-tete" par
'  son sync_id. Un sync_id legitime est un UUID (ou l'ancien format) ;
'  il ne peut JAMAIS valoir le libelle de colonne "sync_id".
'  Origine : ligne fantome du 17/06 23:39 (Type="Type", Date=1970,
'  Km=0 / Litres=2 / PrixL=3, sync_id="sync_id") presente dans l'onglet
'  GS _ImportGS et importee/propagee car l'ancien garde ne testait que
'  sid="" (or "sync_id" est non vide). On la bloque dans les DEUX sens.
' ============================================================
Private Function IsGarbageSid(ByVal sid As String) As Boolean
    IsGarbageSid = (StrComp(Trim$(sid), "sync_id", vbTextCompare) = 0)
End Function

Private Function ImportGSToExcel(ws As Worksheet, gsRecs() As String, _
                                  localIds As Object, _
                                  Optional ByRef updFromGS As Long = 0) As Long
    Dim added   As Long
    Dim tbl     As ListObject
    Dim i       As Long
    Dim rec     As String
    Dim sid     As String
    Dim rng     As Range
    Dim lr      As Long

    added = 0
    updFromGS = 0

    If ws.ListObjects.count > 0 Then Set tbl = ws.ListObjects(1)
    ForceFormatDates

    ' v2.9 : carte sid -> numero de ligne pour les MAJ
    Dim localRowMap As Object
    Set localRowMap = BuildLocalRowMap(ws)

    For i = 0 To UBound(gsRecs)
        rec = gsRecs(i)
        If Len(rec) < 10 Then GoTo NextRec

        sid = JsonGet(rec, "sync_id")
        If sid = "" Then GoTo NextRec
        ' Anti-corruption : ne jamais importer une ligne fantome (sync_id = "sync_id")
        If IsGarbageSid(sid) Then GoTo NextRec

        If Not localIds.Exists(sid) Then
            ' -- Nouvelle ligne depuis GS : ajout ------------------
            If Not tbl Is Nothing Then
                Set rng = tbl.ListRows.Add.Range
            Else
                lr = ws.Cells(ws.rows.count, 1).End(xlUp).row + 1
                Set rng = ws.Range(ws.Cells(lr, 1), ws.Cells(lr, COL_MODIFIED))
            End If

            rng(1).value = ParseDt(JsonGet(rec, "Horodatage"))
            rng(2).value = ParseDt(JsonGet(rec, "Date"))
            rng(3).value = JsonGet(rec, "Type")
            rng(4).value = ToNum(JsonGet(rec, "Km compteur"))
            rng(5).value = ToNum(JsonGet(rec, "Nb. Litres"))
            rng(6).value = ToNum(JsonGet(rec, k("Prix {E}/L")))
            rng(7).value = JsonGet(rec, "Station essence")
            rng(8).value = JsonGet(rec, k("V{e}hicule"))
            rng(9).value = ToNum(JsonGet(rec, k("E85 station ({E}/L)")))
            rng(10).value = ToNum(JsonGet(rec, k("SP98 station ({E}/L)")))
            rng(11).value = ToNum(JsonGet(rec, k("SP95 station ({E}/L)")))
            rng(12).value = ToNum(JsonGet(rec, k("E10 station ({E}/L)")))
            rng(13).value = ToNum(JsonGet(rec, k("Gazole station ({E}/L)")))
            rng(14).value = ToNum(JsonGet(rec, k("GPLc station ({E}/L)")))
            rng(15).value = sid
            rng(16).value = JsonGet(rec, "Photo ticket")   ' P - URL photo importee de GS
            ' Col 17 (Modifie_local) laissee vide : nouvelle ligne, propre

            localIds(sid) = True
            added = added + 1

        Else
            ' -- Ligne existante : MAJ GS->Excel si non dirty ------
            ' Col P vide = non modifie localement = GS peut ecraser
            ' Col P renseignee = Excel gagne (sera envoye en bulkUpdate)
            Dim rowNum As Long
            rowNum = 0
            If localRowMap.Exists(sid) Then rowNum = CLng(localRowMap(sid))
            If rowNum < 2 Then GoTo NextRec

            ' S5 : ligne locale "dirty" (col Q renseignee). On n'ignore plus
            ' systematiquement GS : on compare les horodatages et on garde le
            ' plus recent. Excel-wins seulement si GS n'est pas plus recent.
            If CStr(ws.Cells(rowNum, COL_MODIFIED).value) <> "" Then
                Dim localTs As Date, gsTs As Date
                Dim hasLocal As Boolean, hasGs As Boolean
                hasLocal = IsDate(ws.Cells(rowNum, COL_MODIFIED).value)
                If hasLocal Then localTs = CDate(ws.Cells(rowNum, COL_MODIFIED).value)
                Dim gsModV As Variant: gsModV = ParseDt(JsonGet(rec, k("Modifi{e}_le")))
                hasGs = IsDate(gsModV)
                If hasGs Then gsTs = CDate(gsModV)

                ' GS l'emporte seulement s'il est strictement plus recent
                If hasGs And (Not hasLocal Or gsTs > localTs) Then
                    If Not RowMatchesGS(ws, rowNum, rec) Then
                        UpdateRowFromGS ws, rowNum, rec
                        updFromGS = updFromGS + 1
                    End If
                    ' la version GS gagne : on abandonne la modif locale en attente
                    Application.EnableEvents = False
                    ws.Cells(rowNum, COL_MODIFIED).value = ""
                    Application.EnableEvents = True
                End If
                ' sinon : Excel >= GS -> on conserve la modif locale (bulkUpdate)
                GoTo NextRec
            End If

            ' Ligne non dirty : MAJ GS->Excel si GS differe
            If Not RowMatchesGS(ws, rowNum, rec) Then
                UpdateRowFromGS ws, rowNum, rec
                updFromGS = updFromGS + 1
            End If
        End If

NextRec:
    Next i

    ImportGSToExcel = added
End Function

' Retourne True si les champs cles Date/Km/Litres de la ligne locale
' correspondent aux valeurs GS (comparaison tolerante)
Private Function RowMatchesGS(ws As Worksheet, r As Long, rec As String) As Boolean
    On Error GoTo NoMatch

    ' Date (yyyy-mm-dd)
    Dim lDate As String
    If IsDate(ws.Cells(r, 2).value) Then
        lDate = Format(CDate(ws.Cells(r, 2).value), "yyyy-mm-dd")
    End If
    Dim gDate As String: gDate = JsonGet(rec, "Date")
    If Len(gDate) >= 10 Then gDate = Left(gDate, 10)
    If lDate <> gDate Then GoTo NoMatch

    ' Km (tolerance 0.5)
    Dim lKm As Double: lKm = 0
    If IsNumeric(ws.Cells(r, 4).value) Then lKm = CDbl(ws.Cells(r, 4).value)
    Dim gKm As Double: gKm = 0
    Dim gKmStr As String: gKmStr = JsonGet(rec, "Km compteur")
    If IsNumeric(Replace(gKmStr, ".", ",")) Then gKm = CDbl(Replace(gKmStr, ".", ","))
    If Abs(lKm - gKm) > 0.5 Then GoTo NoMatch

    ' Litres (tolerance 0.01)
    Dim lLit As Double: lLit = 0
    If IsNumeric(ws.Cells(r, 5).value) Then lLit = CDbl(ws.Cells(r, 5).value)
    Dim gLit As Double: gLit = 0
    Dim gLitStr As String: gLitStr = JsonGet(rec, "Nb. Litres")
    If IsNumeric(Replace(gLitStr, ".", ",")) Then gLit = CDbl(Replace(gLitStr, ".", ","))
    If Abs(lLit - gLit) > 0.01 Then GoTo NoMatch

    RowMatchesGS = True
    Exit Function

NoMatch:
    RowMatchesGS = False
    On Error GoTo 0
End Function

' Ecrase les champs de donnees (cols 2-14) + Photo ticket (col 16) d'une ligne
' locale depuis le record GS.
' Ne touche pas col 1 (horodatage), col 15 (sync_id), col 17 (Modifie_local).
Private Sub UpdateRowFromGS(ws As Worksheet, r As Long, rec As String)
    Application.EnableEvents = False
    On Error Resume Next
    ws.Cells(r, 2).value = ParseDt(JsonGet(rec, "Date"))
    ws.Cells(r, 3).value = JsonGet(rec, "Type")
    ws.Cells(r, 4).value = ToNum(JsonGet(rec, "Km compteur"))
    ws.Cells(r, 5).value = ToNum(JsonGet(rec, "Nb. Litres"))
    ws.Cells(r, 6).value = ToNum(JsonGet(rec, k("Prix {E}/L")))
    ws.Cells(r, 7).value = JsonGet(rec, "Station essence")
    ws.Cells(r, 8).value = JsonGet(rec, k("V{e}hicule"))
    ws.Cells(r, 9).value = ToNum(JsonGet(rec, k("E85 station ({E}/L)")))
    ws.Cells(r, 10).value = ToNum(JsonGet(rec, k("SP98 station ({E}/L)")))
    ws.Cells(r, 11).value = ToNum(JsonGet(rec, k("SP95 station ({E}/L)")))
    ws.Cells(r, 12).value = ToNum(JsonGet(rec, k("E10 station ({E}/L)")))
    ws.Cells(r, 13).value = ToNum(JsonGet(rec, k("Gazole station ({E}/L)")))
    ws.Cells(r, 14).value = ToNum(JsonGet(rec, k("GPLc station ({E}/L)")))
    ws.Cells(r, COL_PHOTO).value = JsonGet(rec, "Photo ticket")
    On Error GoTo 0
    Application.EnableEvents = True
End Sub


' ============================================================
'  DIRECTION 2a : EXCEL -> GS  (nouvelles lignes)
' ============================================================
Private Function ExportExcelToGS(ws As Worksheet, gsRecs() As String) As Long
    Dim gsIds    As Object
    Dim i        As Long
    Dim gid      As String
    Dim lastRow  As Long
    Dim rowsJson() As String
    Dim count    As Long
    Dim r        As Long
    Dim lsid     As String
    Dim payload  As String

    Set gsIds = CreateObject("Scripting.Dictionary")
    gsIds.CompareMode = vbTextCompare

    For i = 0 To UBound(gsRecs)
        gid = JsonGet(gsRecs(i), "sync_id")
        If gid <> "" Then gsIds(gid) = True
    Next i

    lastRow = ws.Cells(ws.rows.count, 1).End(xlUp).row
    ReDim rowsJson(lastRow - 2)
    count = 0

    For r = 2 To lastRow
        If ws.Cells(r, 1).value = "" Then GoTo NextRow

        lsid = Trim(CStr(ws.Cells(r, COL_SYNC_ID).value))
        ' Anti-corruption : ne jamais (re)pousser une ligne fantome vers GS
        ' (sinon un nettoyage cote GS la recreerait au prochain bulkAdd).
        If IsGarbageSid(lsid) Then GoTo NextRow
        If lsid = "" Then
            lsid = GenerateUUID()
            Application.EnableEvents = False
            ws.Cells(r, COL_SYNC_ID).value = lsid
            Application.EnableEvents = True
        End If

        ' Envoyer seulement les lignes absentes de GS
        If gsIds.Exists(lsid) Then GoTo NextRow

        rowsJson(count) = RowToJson(ws, r, lsid)
        count = count + 1
NextRow:
    Next r

    If count = 0 Then
        ExportExcelToGS = 0
        Exit Function
    End If

    ReDim Preserve rowsJson(count - 1)
    payload = "{""action"":""bulkAdd"",""token"":""" & APP_TOKEN & """,""rows"":[" & Join(rowsJson, ",") & "]}"
    HttpPost GAS_URL, payload
    ExportExcelToGS = count
End Function


' ============================================================
'  DIRECTION 2b : EXCEL -> GS  (modifications -- col P renseignee)
'  Envoie un bulkUpdate pour les lignes dont sync_id est deja
'  dans GS mais qui ont ete modifiees localement (col P set).
'  Efface col P apres succes.
'
'  NOTE : necessite action=bulkUpdate cote GAS (voir en-tete module).
' ============================================================
Private Function ExportModificationsToGS(ws As Worksheet, gsRecs() As String) As Long
    ' Construire le set des sync_id presents dans GS
    Dim gsIds As Object
    Set gsIds = CreateObject("Scripting.Dictionary")
    gsIds.CompareMode = vbTextCompare
    Dim i As Long
    For i = 0 To UBound(gsRecs)
        Dim gid As String: gid = JsonGet(gsRecs(i), "sync_id")
        If gid <> "" Then gsIds(gid) = True
    Next i

    Dim lastRow As Long
    lastRow = ws.Cells(ws.rows.count, 1).End(xlUp).row

    Dim rowsJson()  As String
    Dim dirtyRows() As Long           ' indices de ligne pour effacement col P
    ReDim rowsJson(lastRow - 2)
    ReDim dirtyRows(lastRow - 2)
    Dim count As Long: count = 0

    Dim r    As Long
    Dim lsid As String

    For r = 2 To lastRow
        If ws.Cells(r, 1).value = "" Then GoTo NextRow2

        lsid = Trim(CStr(ws.Cells(r, COL_SYNC_ID).value))

        ' Condition : sync_id connu de GS + col P renseignee (dirty)
        If lsid = "" Then GoTo NextRow2
        If Not gsIds.Exists(lsid) Then GoTo NextRow2
        If CStr(ws.Cells(r, COL_MODIFIED).value) = "" Then GoTo NextRow2

        rowsJson(count) = RowToJson(ws, r, lsid)
        dirtyRows(count) = r
        count = count + 1
NextRow2:
    Next r

    If count = 0 Then
        ExportModificationsToGS = 0
        Exit Function
    End If

    ReDim Preserve rowsJson(count - 1)
    ReDim Preserve dirtyRows(count - 1)

    Dim payload As String
    payload = "{""action"":""bulkUpdate"",""token"":""" & APP_TOKEN & """,""rows"":[" & Join(rowsJson, ",") & "]}"
    Dim resp As String
    resp = HttpPost(GAS_URL, payload)

    ' Effacer col P si le POST a reussi (reponse HTTP 200 non vide)
    ' et ne contient pas "error"
    Dim success As Boolean
    success = (resp <> "" And InStr(1, LCase(resp), "error") = 0)

    If success Then
        Application.EnableEvents = False
        Dim j As Long
        For j = 0 To count - 1
            ws.Cells(dirtyRows(j), COL_MODIFIED).value = ""
        Next j
        Application.EnableEvents = True
        ExportModificationsToGS = count
    Else
        ' GAS ne supporte pas encore bulkUpdate : col P conservee,
        ' les modifs seront renvoyees au prochain sync
        Debug.Print Format(now(), "hh:mm:ss") & _
            "  ExportModificationsToGS : reponse inattendue ou GAS sans bulkUpdate." & _
            " Reponse=" & Left(resp, 200)
        ExportModificationsToGS = 0
    End If
End Function


' ============================================================
'  HELPER JSON -> LIGNE EXCEL
' ============================================================
Private Function RowToJson(ws As Worksheet, r As Long, sid As String) As String
    Dim ts As String
    Dim ds As String
    Dim ms As String   ' S5 : horodatage de derniere modif (col Q, repli sur horodatage)

    If IsDate(ws.Cells(r, 1).value) Then
        ts = Format(ws.Cells(r, 1).value, "yyyy-mm-dd hh:mm:ss")
    End If
    If IsDate(ws.Cells(r, 2).value) Then
        ds = Format(ws.Cells(r, 2).value, "yyyy-mm-dd")
    End If
    If IsDate(ws.Cells(r, COL_MODIFIED).value) Then
        ms = Format(ws.Cells(r, COL_MODIFIED).value, "yyyy-mm-dd hh:mm:ss")
    Else
        ms = ts
    End If

    RowToJson = "{" & _
        jS("sync_id", sid) & "," & _
        jS("horodatage", ts) & "," & _
        jS("modifiedAt", ms) & "," & _
        jS("date", ds) & "," & _
        jS("type", CStr(ws.Cells(r, 3).value)) & "," & _
        jN("km", ws.Cells(r, 4).value) & "," & _
        jN("litres", ws.Cells(r, 5).value) & "," & _
        jN("prix", ws.Cells(r, 6).value) & "," & _
        jS("station", CStr(ws.Cells(r, 7).value)) & "," & _
        jS("vehicule", CStr(ws.Cells(r, 8).value)) & "," & _
        """stationPrices"":{" & _
            jN("E85", ws.Cells(r, 9).value) & "," & _
            jN("SP98", ws.Cells(r, 10).value) & "," & _
            jN("SP95", ws.Cells(r, 11).value) & "," & _
            jN("E10", ws.Cells(r, 12).value) & "," & _
            jN("GAZOLE", ws.Cells(r, 13).value) & "," & _
            jN("GPLC", ws.Cells(r, 14).value) & _
        "}}"
End Function


' ============================================================
'  JSON PARSER
' ============================================================
Private Function JsonGet(jsonObj As String, key As String) As String
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

Private Function ParseRecords(jsonStr As String) As String()
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

' S3 : extrait le tableau "deleted":[ "id", ... ] de la reponse export.
' Place AVANT "records" cote GAS pour que ParseRecords (InStrRev "]")
' continue de viser la fin du tableau records.
Private Function ParseDeletedIds(jsonStr As String) As String()
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

' S3 : supprime localement les lignes dont le sync_id figure dans la liste
' des tombstones GS. Retourne le nombre de lignes supprimees.
Private Function ApplyGSDeletions(ws As Worksheet, delIds() As String) As Long
    Dim cnt As Long: cnt = 0
    On Error GoTo done
    If UBound(delIds) < LBound(delIds) Then ApplyGSDeletions = 0: Exit Function

    Dim del As Object
    Set del = CreateObject("Scripting.Dictionary")
    del.CompareMode = vbTextCompare
    Dim i As Long
    For i = LBound(delIds) To UBound(delIds)
        If Trim(delIds(i)) <> "" Then del(Trim(delIds(i))) = True
    Next i
    If del.count = 0 Then ApplyGSDeletions = 0: Exit Function

    Dim tbl As ListObject
    If ws.ListObjects.count > 0 Then Set tbl = ws.ListObjects(1)

    Application.EnableEvents = False
    If Not tbl Is Nothing Then
        Dim li As Long, sidL As String
        For li = tbl.ListRows.count To 1 Step -1
            sidL = Trim(CStr(tbl.ListRows(li).Range.Cells(1, COL_SYNC_ID).value))
            If sidL <> "" Then
                If del.Exists(sidL) Then tbl.ListRows(li).Delete: cnt = cnt + 1
            End If
        Next li
    Else
        Dim lastRow As Long, r As Long, sid As String
        lastRow = ws.Cells(ws.rows.count, 1).End(xlUp).row
        For r = lastRow To 2 Step -1
            sid = Trim(CStr(ws.Cells(r, COL_SYNC_ID).value))
            If sid <> "" Then
                If del.Exists(sid) Then ws.rows(r).Delete: cnt = cnt + 1
            End If
        Next r
    End If
    Application.EnableEvents = True
    ApplyGSDeletions = cnt
    Exit Function
done:
    Application.EnableEvents = True
    ApplyGSDeletions = cnt
End Function


' ============================================================
'  HELPERS JSON
' ============================================================
Private Function jS(key As String, val As String) As String
    val = Replace(val, "\", "\\")
    val = Replace(val, """", "\""")
    jS = """" & key & """:""" & val & """"
End Function

Private Function jN(key As String, val As Variant) As String
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

' Echappe une chaine pour insertion dans une valeur JSON
Private Function JEsc(ByVal s As String) As String
    s = Replace(s, "\", "\\")
    s = Replace(s, """", "\""")
    JEsc = s
End Function


' ============================================================
'  DIRECTION 3 : LISTE STATIONS CUREE  Excel -> GS
'  Lit le tableau tbl_stationEssence (onglet Notes) et le pousse
'  vers la feuille "Stations" du Google Sheet via action=syncStations.
'  La 1ere entree est l'en-tete (l'app cote web saute la ligne 1).
'  Retour : nb de stations poussees, ou -1 en cas d'echec.
' ============================================================
Private Function PushStationsToGS() As Long
    Dim ws   As Worksheet
    Dim tbl  As ListObject
    Dim seen As Object
    Dim c    As Range
    Dim v    As String
    Dim json As String
    Dim body As String
    Dim resp As String
    Dim cnt  As Long

    On Error GoTo done

    Set ws = Nothing
    On Error Resume Next
    Set ws = ThisWorkbook.Sheets(STATIONS_WS)
    If ws Is Nothing Then On Error GoTo 0: PushStationsToGS = -1: Exit Function
    Set tbl = ws.ListObjects(STATIONS_TBL)
    On Error GoTo done
    If tbl Is Nothing Then PushStationsToGS = -1: Exit Function
    If tbl.DataBodyRange Is Nothing Then PushStationsToGS = -1: Exit Function

    Set seen = CreateObject("Scripting.Dictionary")
    seen.CompareMode = vbTextCompare

    ' En-tete en premier (la feuille "Stations" attend un header en ligne 1)
    json = """" & JEsc(k("Station essence utilis{e}e")) & """"

    cnt = 0
    For Each c In tbl.DataBodyRange.Columns(1).Cells
        v = Trim(CStr(c.value))
        If v <> "" And Not seen.Exists(v) Then
            seen(v) = True
            json = json & ",""" & JEsc(v) & """"
            cnt = cnt + 1
        End If
    Next c

    body = "{""action"":""syncStations"",""token"":""" & APP_TOKEN & """,""stations"":[" & json & "]}"
    resp = HttpPost(GAS_URL, body)

    If InStr(resp, """success"":true") > 0 Then
        PushStationsToGS = cnt
    Else
        Debug.Print Format(now(), "hh:mm:ss") & _
            "  PushStationsToGS : reponse inattendue. Reponse=" & Left(resp, 200)
        PushStationsToGS = -1
    End If
    Exit Function
done:
    PushStationsToGS = -1
End Function


' ============================================================
'  HELPERS DIVERS
' ============================================================
Private Function ParseDt(s As String) As Variant
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

Private Function IsoToDate(iso As String) As Variant
    IsoToDate = ParseDt(iso)
End Function

Private Function ToNum(s As String) As Variant
    If s = "" Or s = "null" Then
        ToNum = ""
    ElseIf IsNumeric(Replace(s, ".", ",")) Then
        ToNum = CDbl(Replace(s, ".", ","))
    Else
        ToNum = ""
    End If
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


' ============================================================
'  HTTP
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
    If h.status = 200 Then HttpGet = h.ResponseText
    Exit Function
Err_:
    HttpGet = ""
End Function

' ============================================================
'  X11 : JOURNAL DE SYNC (_SyncLog)
'  Ajoute une ligne date | <- GS | -> GS | duree(s) a chaque sync.
' ============================================================
'  X46 : ajout d'une colonne E "Statut" (OK / KO ...) journalisee a chaque
'  sync, succes comme echec, pour alimenter la sante de la sync (Reglages).
Private Sub LogToSyncLog(ByVal fromGS As Long, ByVal toGS As Long, ByVal dureeS As Long, _
                         ByVal statut As String)
    Const LOG_SH As String = "_SyncLog"
    Dim wsL As Worksheet
    On Error Resume Next
    Set wsL = ThisWorkbook.Sheets(LOG_SH)
    On Error GoTo 0
    If wsL Is Nothing Then
        Set wsL = ThisWorkbook.Sheets.Add(After:=ThisWorkbook.Sheets(ThisWorkbook.Sheets.count))
        wsL.name = LOG_SH
        wsL.visible = xlSheetHidden
        wsL.Cells(1, 1).value = "Horodatage"
        wsL.Cells(1, 2).value = "<- GS"
        wsL.Cells(1, 3).value = "-> GS"
        wsL.Cells(1, 4).value = "Duree (s)"
        wsL.Cells(1, 5).value = "Statut"
        wsL.Range("A1:E1").Font.bold = True
    ElseIf CStr(wsL.Cells(1, 5).value) = "" Then
        ' Migration des journaux anterieurs a X46 (4 colonnes) : ajoute l'en-tete.
        wsL.Cells(1, 5).value = "Statut"
        wsL.Cells(1, 5).Font.bold = True
    End If
    Dim nxt As Long: nxt = wsL.Cells(wsL.rows.count, 1).End(xlUp).row + 1
    wsL.Cells(nxt, 1).value = now
    wsL.Cells(nxt, 1).NumberFormat = "dd/mm/yyyy hh:mm:ss"
    wsL.Cells(nxt, 2).value = fromGS
    wsL.Cells(nxt, 3).value = toGS
    wsL.Cells(nxt, 4).value = dureeS
    wsL.Cells(nxt, 5).value = statut
End Sub

Private Function HttpPost(url As String, body As String) As String
    Dim h As Object
    On Error GoTo Err_
    Set h = CreateHttp()
    If h Is Nothing Then Exit Function
    h.SetTimeouts T_RESOLVE, T_CONNECT, T_SEND, T_RECEIVE
    h.Open "POST", url, False
    h.setRequestHeader "Content-Type", "application/json; charset=utf-8"
    h.Send body
    If h.status = 200 Then HttpPost = h.ResponseText
    Exit Function
Err_:
    HttpPost = ""
End Function


