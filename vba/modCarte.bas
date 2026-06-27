Attribute VB_Name = "modCarte"
' ============================================================
'  SUIVI E85 - Feuille CARTE (prix moyens + carte OSM)     v1.0.0.0
'  Etape 3a/3 du dashboard miroir de l'app PWA (onglet Carte).
'
'  Reproduit la vue Carte de l'app :
'   - tableau des STATIONS HABITUELLES + PRIX MOYENS par carburant
'     (E85 / Gazole / SP98), trie par prix, etoile meilleur prix,
'     favori auto (>= 4 pleins) -- fidele a computeStationAverages.
'   - CARTE OSM (tuiles tile.openstreetmap.org + marqueurs prix)
'     generee en HTML et ouverte dans le navigateur (rendu fidele,
'     OSM s'affiche correctement). L'embarquement dans un UserForm
'     (moteur IE) viendra en etape 3b sur cette meme base HTML.
'
'  Coordonnees : table editable "_StationCoords" (Station|Lat|Lon|Src),
'  auto-remplie par geocodage via l'API gouv. v2.1 (ville extraite du
'  nom "Enseigne - Ville"), comme l'app. Corrigeable a la main.
'
'  DEPENDANCES (non redefinies) : SetStatus (ModuleImportGS),
'    NavAccueil (modWorkbook). GS_Pleins = table source (14 col).
'
'  USAGE : CreerFeuilleCarte | RafraichirCarte | OuvrirCarteNavigateur
' ============================================================
Option Explicit

Private Const WS_CARTE  As String = "Carte"
Private Const WS_COORDS As String = "_StationCoords"
Private Const WS_DATA   As String = "GS_Pleins"
Private Const PRIX_API  As String = "https://data.economie.gouv.fr/api/explore/v2.1/catalog/datasets/prix-des-carburants-en-france-flux-instantane-v2/records"
Private Const FAVORITE_MIN As Long = 4
Private Const TILE_SZ   As Long = 256
Private Const OSRM_API  As String = "https://router.project-osrm.org/route/v1/driving/"

' Colonnes GS_Pleins (1-based)
Private Const COL_TYPE    As Long = 3
Private Const COL_PRIX    As Long = 6
Private Const COL_STATION As Long = 7

' Dimensions de la carte HTML
Private Const MAP_W As Long = 760
Private Const MAP_H As Long = 460

' Station agregee
Private Type StAvg
    name     As String
    avg      As Double
    count    As Long
    lat      As Double
    lon      As Double
    hasCoord As Boolean
    ville    As String
End Type
Private g_st() As StAvg
Private g_n    As Long

' Position utilisateur (resolue depuis la cellule Carte_Position avant rendu)
Private g_userHas As Boolean
Private g_userLat As Double
Private g_userLon As Double

' Cache des icones de marque (slug -> data URI base64), rempli a la demande.
Private g_iconCache As Object
' Cache des ratios largeur/hauteur des SVG d'enseigne (slug -> Double).
Private g_arCache As Object


' ============================================================
'  CONSTRUCTION DE LA FEUILLE
' ============================================================
Public Sub CreerFeuilleCarte()
    Dim ws As Worksheet
    Application.ScreenUpdating = False
    On Error GoTo ErrH

    Set ws = GetOrCreateSheet(WS_CARTE)
    ws.Cells.Clear
    Dim shp As Shape
    For Each shp In ws.Shapes: shp.Delete: Next shp

    ws.Tab.Color = RGB(217, 119, 6)
    ws.Activate
    On Error Resume Next
    ActiveWindow.DisplayGridlines = False
    On Error GoTo ErrH
    ws.Columns("A").ColumnWidth = 2
    ws.Columns("B").ColumnWidth = 34
    ws.Columns("C").ColumnWidth = 14
    ws.Columns("D").ColumnWidth = 9
    ws.Columns("E").ColumnWidth = 9
    ws.Columns("F").ColumnWidth = 12

    With ws.Range("B1")
        .Value = Emo(&H1F5FA&) & " Carte des stations"
        .Font.Size = 18: .Font.Bold = True: .Font.Color = RGB(27, 58, 92)
    End With
    ws.Rows(1).RowHeight = 34

    ' Selecteur de carburant (cellule nommee + validation)
    ws.Cells(3, 2).Value = "Carburant :"
    ws.Cells(3, 2).Font.Bold = True
    With ws.Cells(3, 3)
        .Name = "Carte_Fuel"
        If CStr(.Value) = "" Then .Value = "E85"
        .Interior.Color = RGB(243, 244, 246)
        .HorizontalAlignment = xlCenter
        .Borders.LineStyle = xlContinuous
        .Borders.Color = RGB(209, 213, 219)
        On Error Resume Next
        .Validation.Delete
        .Validation.Add Type:=xlValidateList, AlertStyle:=xlValidAlertStop, Formula1:="E85,Gazole,SP98"
        .Validation.InCellDropdown = True
        On Error GoTo ErrH
    End With

    ' Ma position (pour tracer le marqueur "vous etes ici" sur la carte)
    ws.Cells(4, 2).Value = "Ma position (lat;lon ou ville)"
    ws.Cells(4, 2).Font.Bold = True
    With ws.Cells(4, 3)
        .Name = "Carte_Position"
        .Interior.Color = RGB(243, 244, 246)
        .HorizontalAlignment = xlCenter
        .Borders.LineStyle = xlContinuous
        .Borders.Color = RGB(209, 213, 219)
    End With

    ' Rayon de recherche (vue proximite)
    ws.Cells(5, 2).Value = "Rayon proximite (km)"
    ws.Cells(5, 2).Font.Bold = True
    With ws.Cells(5, 3)
        .Name = "Carte_Rayon"
        If Not IsNumeric(.Value) Then .Value = 15
        .Interior.Color = RGB(243, 244, 246)
        .HorizontalAlignment = xlCenter
        .Borders.LineStyle = xlContinuous
        .Borders.Color = RGB(209, 213, 219)
        On Error Resume Next
        .Validation.Delete
        .Validation.Add Type:=xlValidateList, AlertStyle:=xlValidAlertStop, Formula1:="5,10,15,20"
        .Validation.InCellDropdown = True
        On Error GoTo ErrH
    End With

    ' Itineraire : depart / arrivee
    ws.Cells(6, 2).Value = "Itineraire - depart"
    ws.Cells(6, 2).Font.Bold = True
    With ws.Cells(6, 3)
        .Name = "Carte_Depart"
        .Interior.Color = RGB(243, 244, 246)
        .HorizontalAlignment = xlLeft
        .Borders.LineStyle = xlContinuous
        .Borders.Color = RGB(209, 213, 219)
    End With
    ws.Cells(7, 2).Value = "Itineraire - arrivee"
    ws.Cells(7, 2).Font.Bold = True
    With ws.Cells(7, 3)
        .Name = "Carte_Arrivee"
        .Interior.Color = RGB(243, 244, 246)
        .HorizontalAlignment = xlLeft
        .Borders.LineStyle = xlContinuous
        .Borders.Color = RGB(209, 213, 219)
    End With

    ' Boutons
    Dim L As Single: L = ws.Cells(3, 8).Left
    Dim T As Single: T = ws.Cells(3, 8).Top
    AddButton ws, "btnCarte1", L, T, "Ouvrir la carte (navigateur)", "OuvrirCarteNavigateur", RGB(217, 119, 6)
    AddButton ws, "btnCarte2", L, T + 30, "Geocoder + Actualiser", "RafraichirCarte", RGB(46, 117, 182)
    AddButton ws, "btnCarte3", L, T + 60, "Accueil", "NavAccueil", RGB(75, 85, 99)
    AddButton ws, "btnCarte4", L, T + 90, "Stations a proximite", "CarteProximite", RGB(29, 158, 117)
    AddButton ws, "btnCarte5", L, T + 120, "Carte itineraire", "CarteItineraire", RGB(46, 117, 182)
    AddButton ws, "btnCarte6", L, T + 150, "Me localiser (auto)", "GeolocaliserAuto", RGB(37, 99, 235)

    RafraichirCarte

    ws.Range("B1").Select
    GoTo Done
ErrH:
    SetStatus "[Carte] " & ChrW(9888) & " Erreur " & Err.Number & " : " & Err.Description
Done:
    Application.ScreenUpdating = True
End Sub


' ============================================================
'  RAFRAICHISSEMENT (prix moyens + geocodage + tableau)
' ============================================================
Public Sub RafraichirCarte()
    Dim ws As Worksheet
    Application.ScreenUpdating = False
    On Error GoTo ErrH

    Set ws = GetOrCreateSheet(WS_CARTE)
    EnsureData CurrentFuelKey()
    RenderTable ws

    SetStatus "[Carte] " & ChrW(10003) & " " & g_n & " stations (" & CurrentFuelShort() & "). " & _
              "Bouton 'Ouvrir la carte' pour la vue OSM."
    GoTo Done
ErrH:
    SetStatus "[Carte] " & ChrW(9888) & " Erreur " & Err.Number & " : " & Err.Description
Done:
    Application.ScreenUpdating = True
End Sub


' Met a jour le TABLEAU pour le carburant courant SANS reseau (pas de geocodage).
' Appele par le Worksheet_Change de la feuille quand on change de carburant (C3).
Public Sub RafraichirTableauCarte()
    Dim ws As Worksheet
    Application.ScreenUpdating = False
    On Error GoTo ErrH
    Set ws = GetOrCreateSheet(WS_CARTE)
    ComputeAverages CurrentFuelKey()
    AttacherCoords
    RenderTable ws
    SetStatus "[Carte] " & ChrW(10003) & " " & g_n & " stations (" & CurrentFuelShort() & ")."
    GoTo Done
ErrH:
    SetStatus "[Carte] " & ChrW(9888) & " Erreur " & Err.Number & " : " & Err.Description
Done:
    Application.ScreenUpdating = True
End Sub


' Vide le cache _StationCoords puis re-geocode tout (apres correction de logique
' ou pour forcer une resolution propre des homonymes).
Public Sub ReinitialiserCoords()
    Dim ws As Worksheet: Set ws = CoordsSheet()
    Dim last As Long: last = ws.Cells(ws.Rows.Count, 1).End(xlUp).Row
    If last >= 2 Then ws.Range("A2:D" & last).ClearContents
    SetStatus "[Carte] Cache coordonnees vide -> re-geocodage..."
    RafraichirCarte
End Sub


' ============================================================
'  OUVERTURE DE LA CARTE OSM DANS LE NAVIGATEUR
' ============================================================
Public Sub OuvrirCarteNavigateur()
    Dim html As String, path As String
    On Error GoTo ErrH

    EnsureData CurrentFuelKey()

    Dim withCoord As Long, i As Long
    For i = 1 To g_n
        If g_st(i).hasCoord Then withCoord = withCoord + 1
    Next i
    If withCoord = 0 Then
        SetStatus "[Carte] " & ChrW(9888) & " Aucune coordonnee. Lancez 'Geocoder + Actualiser' ou remplissez _StationCoords."
        Exit Sub
    End If

    g_userHas = ResolveUserPos(g_userLat, g_userLon)
    html = GenererHtmlCarte(CurrentFuelShort())
    path = Environ$("TEMP") & "\suivi_carte.html"
    EcrireUtf8 path, html

    Shell "explorer.exe """ & path & """", vbNormalFocus
    SetStatus "[Carte] " & ChrW(10003) & " Carte ouverte dans le navigateur (" & withCoord & " stations geolocalisees)."
    Exit Sub
ErrH:
    SetStatus "[Carte] " & ChrW(9888) & " Erreur ouverture carte " & Err.Number & " : " & Err.Description
End Sub


' ============================================================
'  DIAGNOSTIC (a lancer si le geocodage ne ramene rien)
' ============================================================
Public Sub DiagnoseCarte()
    Dim msg As String, i As Long
    ComputeAverages CurrentFuelKey()

    msg = "DIAGNOSE CARTE" & vbCrLf & _
          "Carburant : " & CurrentFuelShort() & vbCrLf & _
          "Stations trouvees : " & g_n & vbCrLf & vbCrLf
    If g_n = 0 Then
        msg = msg & "(aucune station -> verifier GS_Pleins et le type de carburant)"
        MsgBox msg, vbExclamation, "Diagnose Carte"
        Exit Sub
    End If

    msg = msg & "Premieres stations (nom -> ville extraite) :" & vbCrLf
    For i = 1 To Application.Min(5, g_n)
        msg = msg & "  - [" & g_st(i).name & "]  ->  ville=[" & VilleFromName(g_st(i).name) & "]" & vbCrLf
    Next i

    Dim ville As String: ville = VilleFromName(g_st(1).name)
    msg = msg & vbCrLf & "Test geocodage de la station #1 :" & vbCrLf
    If ville = "" Then
        msg = msg & "  -> aucune ville extraite, rien a geocoder."
        MsgBox msg, vbInformation, "Diagnose Carte"
        Exit Sub
    End If

    Dim whereClause As String, url As String, enc As String
    whereClause = "ville like """ & Replace(ville, """", "") & "%"""
    On Error Resume Next
    enc = Application.WorksheetFunction.EncodeURL(whereClause)
    If Err.Number <> 0 Then enc = "(EncodeURL ECHEC : " & Err.Description & ")": Err.Clear
    On Error GoTo 0
    url = PRIX_API & "?where=" & enc & "&select=geom&limit=5"
    msg = msg & "  ville=[" & ville & "]" & vbCrLf

    Dim http As Object, statut As String, body As String
    On Error Resume Next
    Set http = CreateObject("WinHttp.WinHttpRequest.5.1")
    http.SetTimeouts 5000, 10000, 15000, 15000
    http.Open "GET", url, False
    http.Send
    statut = "HTTP " & http.Status
    body = http.ResponseText
    If Err.Number <> 0 Then statut = "EXCEPTION " & Err.Number & " : " & Err.Description
    On Error GoTo 0

    msg = msg & "  " & statut & vbCrLf
    If Len(body) > 0 Then msg = msg & "  reponse (400 1ers car.) :" & vbCrLf & Left$(body, 400)

    Debug.Print msg
    MsgBox msg, vbInformation, "Diagnose Carte"
End Sub


' ============================================================
'  DONNEES : prix moyens + coordonnees
' ============================================================

' Calcule g_st()/g_n pour le carburant, puis complete les coordonnees.
Private Sub EnsureData(fuelKey As String)
    ComputeAverages fuelKey
    GeocoderManquantes
    AttacherCoords
End Sub

' Agrege GS_Pleins par station pour le carburant donne (prix moyen + nb pleins),
' trie par prix croissant. Fidele a computeStationAverages de l'app.
Private Sub ComputeAverages(fuelKey As String)
    g_n = 0
    Erase g_st

    Dim lo As ListObject: Set lo = GetDataTable()
    If lo Is Nothing Then Exit Sub
    If lo.DataBodyRange Is Nothing Then Exit Sub

    Dim data As Variant: data = lo.DataBodyRange.Value
    Dim n As Long: n = UBound(data, 1)

    Dim dTot As Object: Set dTot = CreateObject("Scripting.Dictionary")
    Dim dCnt As Object: Set dCnt = CreateObject("Scripting.Dictionary")

    Dim r As Long, nm As String, prix As Variant, typ As String
    For r = 1 To n
        nm = Trim$(CStr(data(r, COL_STATION)))
        If nm = "" Then GoTo NextR
        prix = data(r, COL_PRIX)
        If Not IsNumeric(prix) Then GoTo NextR
        If CDbl(prix) <= 0 Then GoTo NextR
        typ = CStr(data(r, COL_TYPE))
        If Not FuelMatch(fuelKey, typ) Then GoTo NextR
        dTot(nm) = dTot(nm) + CDbl(prix)
        dCnt(nm) = dCnt(nm) + 1
NextR:
    Next r

    Dim keys As Variant: keys = dTot.keys
    Dim m As Long: m = dTot.Count
    If m = 0 Then Exit Sub
    ReDim g_st(1 To m)
    Dim i As Long
    For i = 0 To m - 1
        g_st(i + 1).name = CStr(keys(i))
        g_st(i + 1).count = CLng(dCnt(keys(i)))
        g_st(i + 1).avg = dTot(keys(i)) / dCnt(keys(i))
    Next i
    g_n = m

    ' Tri par prix moyen croissant (insertion)
    Dim j As Long, tmp As StAvg
    For i = 2 To g_n
        tmp = g_st(i): j = i - 1
        Do While j >= 1
            If g_st(j).avg <= tmp.avg Then Exit Do
            g_st(j + 1) = g_st(j): j = j - 1
        Loop
        g_st(j + 1) = tmp
    Next i
End Sub

' Geocode les stations sans coordonnees connues (API gouv. v2.1) -> _StationCoords.
' Desambiguise les homonymes (plusieurs villes de meme nom) en choisissant le
' candidat le plus proche du barycentre des autres stations (ancre = ville la
' moins dispersee si aucune coord connue). Cf. _refPoint de l'app.
Private Sub GeocoderManquantes()
    If g_n = 0 Then Exit Sub
    Dim cache As Object: Set cache = LoadCoordsDict()

    Dim cand As Object:    Set cand = CreateObject("Scripting.Dictionary")   ' key -> Double(1..k,1..2) [lon,lat]
    Dim cenLat As Object:  Set cenLat = CreateObject("Scripting.Dictionary")
    Dim cenLon As Object:  Set cenLon = CreateObject("Scripting.Dictionary")
    Dim spreadD As Object: Set spreadD = CreateObject("Scripting.Dictionary")

    Dim i As Long, k As Long, j As Long, ville As String, key As String
    Dim lats() As Double, lons() As Double

    ' 1) Recupere TOUS les candidats de chaque station non encore connue.
    For i = 1 To g_n
        key = LCase$(g_st(i).name)
        If cache.Exists(key) Then GoTo NextI
        ville = VilleFromName(g_st(i).name)
        If ville = "" Then GoTo NextI
        k = GeocodeCandidates(ville, lats, lons)
        If k > 0 Then
            Dim arr() As Double: ReDim arr(1 To k, 1 To 2)
            Dim sLat As Double, sLon As Double: sLat = 0: sLon = 0
            For j = 1 To k
                arr(j, 1) = lons(j): arr(j, 2) = lats(j)
                sLat = sLat + lats(j): sLon = sLon + lons(j)
            Next j
            cand(key) = arr
            cenLat(key) = sLat / k: cenLon(key) = sLon / k
            Dim mx As Double: mx = 0
            For j = 1 To k
                Dim ds As Double: ds = MetricDist(lats(j), lons(j), CDbl(cenLat(key)), CDbl(cenLon(key)))
                If ds > mx Then mx = ds
            Next j
            spreadD(key) = mx
        End If
NextI:
    Next i
    If cand.Count = 0 Then Exit Sub

    ' 2) Reference = barycentre des coords connues + centroides des villes "serrees".
    Dim refLat As Double, refLon As Double, an As Long
    Dim kk As Variant, parts() As String
    For Each kk In cache.keys
        parts = Split(CStr(cache(kk)), ";")
        If UBound(parts) >= 1 Then
            If IsNumeric(parts(0)) And IsNumeric(parts(1)) Then
                refLat = refLat + CDbl(parts(0)): refLon = refLon + CDbl(parts(1)): an = an + 1
            End If
        End If
    Next kk
    For Each kk In cand.keys
        If CDbl(spreadD(kk)) < 0.3 Then
            refLat = refLat + CDbl(cenLat(kk)): refLon = refLon + CDbl(cenLon(kk)): an = an + 1
        End If
    Next kk
    If an = 0 Then
        ' Aucune ancre fiable : amorce sur la ville la MOINS dispersee.
        Dim bestKey As String, bestSp As Double: bestSp = 1E+30
        For Each kk In cand.keys
            If CDbl(spreadD(kk)) < bestSp Then bestSp = CDbl(spreadD(kk)): bestKey = CStr(kk)
        Next kk
        refLat = CDbl(cenLat(bestKey)): refLon = CDbl(cenLon(bestKey)): an = 1
    End If
    refLat = refLat / an: refLon = refLon / an

    ' 3) Pour chaque station, choisit le candidat le plus proche de la reference.
    For Each kk In cand.keys
        Dim a As Variant: a = cand(kk)
        Dim bLat As Double, bLon As Double, bD As Double: bD = 1E+30
        For j = LBound(a, 1) To UBound(a, 1)
            Dim d2 As Double: d2 = MetricDist(a(j, 2), a(j, 1), refLat, refLon)
            If d2 < bD Then bD = d2: bLon = a(j, 1): bLat = a(j, 2)
        Next j
        SaveCoord NameFromKey(CStr(kk)), bLat, bLon, "geo"
    Next kk
End Sub

' Attache au tableau g_st les coordonnees connues (cache _StationCoords).
Private Sub AttacherCoords()
    If g_n = 0 Then Exit Sub
    Dim cache As Object: Set cache = LoadCoordsDict()
    Dim i As Long, parts() As String, k As String
    For i = 1 To g_n
        g_st(i).hasCoord = False
        k = LCase$(g_st(i).name)
        If cache.Exists(k) Then
            parts = Split(CStr(cache(k)), ";")
            If UBound(parts) >= 1 Then
                If IsNumeric(parts(0)) And IsNumeric(parts(1)) Then
                    g_st(i).lat = CDbl(parts(0))
                    g_st(i).lon = CDbl(parts(1))
                    g_st(i).hasCoord = (g_st(i).lat <> 0 Or g_st(i).lon <> 0)
                End If
            End If
        End If
    Next i
End Sub


' ============================================================
'  TABLEAU PRIX MOYENS
' ============================================================
Private Sub RenderTable(ws As Worksheet)
    ws.Range("B9:F100000").Clear

    ws.Cells(9, 2).Value = "Stations " & CurrentFuelShort() & " habituelles"
    ws.Cells(9, 2).Font.Bold = True: ws.Cells(9, 2).Font.Color = RGB(27, 58, 92)

    Dim hdr As Variant: hdr = Array("Station", "Prix moyen", "Pleins", "Coord.", "")
    Dim c As Long
    For c = 0 To 3
        With ws.Cells(10, 2 + c)
            .Value = hdr(c)
            .Font.Bold = True: .Font.Color = vbWhite
            .Interior.Color = RGB(217, 119, 6)
            .HorizontalAlignment = xlCenter
        End With
    Next c

    If g_n = 0 Then
        ws.Cells(11, 2).Value = "Aucun plein " & CurrentFuelShort() & " enregistre."
        Exit Sub
    End If

    Dim minAvg As Double: minAvg = g_st(1).avg     ' g_st trie par prix
    Dim i As Long, rr As Long
    For i = 1 To g_n
        rr = 10 + i
        Dim label As String: label = g_st(i).name
        If g_st(i).count >= FAVORITE_MIN Then label = Emo(&H2B50&) & " " & label   ' etoile favori
        ws.Cells(rr, 2).Value = label
        ws.Cells(rr, 3).Value = g_st(i).avg: ws.Cells(rr, 3).NumberFormat = "0.000"" " & ChrW(8364) & "/L"""
        ws.Cells(rr, 4).Value = g_st(i).count
        ws.Cells(rr, 5).Value = IIf(g_st(i).hasCoord, ChrW(10003), ChrW(8212))
        If (g_st(i).avg - minAvg) < 0.002 Then
            ws.Cells(rr, 6).Value = Emo(&H2605&) & " meilleur"
            ws.Cells(rr, 6).Font.Color = RGB(29, 158, 117)
        End If
        ws.Range(ws.Cells(rr, 3), ws.Cells(rr, 5)).HorizontalAlignment = xlCenter
    Next i
End Sub


' ============================================================
'  GENERATION HTML DE LA CARTE (Leaflet via CDN)
'  Carte interactive OSM (pan/zoom) + marqueurs prix. Necessite Internet.
' ============================================================
Private Function GenererHtmlCarte(titre As String) As String
    ' Points geolocalises -> tableau JS [lat, lon, "nom", "prix", "slug", "color"]
    Dim pts As String, i As Long, n As Long
    Dim slugs As Object: Set slugs = CreateObject("Scripting.Dictionary")
    Dim sl As String, col As String
    For i = 1 To g_n
        If g_st(i).hasCoord Then
            BrandSlugColor g_st(i).name, sl, col
            If sl <> "" Then slugs(sl) = True
            If pts <> "" Then pts = pts & ","
            pts = pts & "[" & JsNum(g_st(i).lat) & "," & JsNum(g_st(i).lon) & ",""" & _
                  EscJs(g_st(i).name) & """,""" & PrixStr(g_st(i).avg) & """,""" & _
                  sl & """,""" & col & """]"
            n = n + 1
        End If
    Next i
    If n = 0 Then
        GenererHtmlCarte = "<!doctype html><meta charset='utf-8'>" & _
            "<p style='font-family:sans-serif'>Aucune station geolocalisee pour " & EscHtml(titre) & ".</p>"
        Exit Function
    End If

    ' JS de position utilisateur : marqueur fixe si "Ma position" renseignee,
    ' sinon geoloc live du navigateur (peut etre bloquee sur un fichier local).
    Dim ujs As String
    If g_userHas Then
        ujs = "var u=[" & JsNum(g_userLat) & "," & JsNum(g_userLon) & "];" & _
              "L.marker(u,{icon:meIcon,zIndexOffset:1000}).addTo(map).bindPopup('Votre position');" & _
              "b.push(u);map.fitBounds(b,{padding:[60,60]});"
    Else
        ujs = "map.locate({setView:false,enableHighAccuracy:true,timeout:8000});" & _
              "map.on('locationfound',function(e){" & _
              "L.marker(e.latlng,{icon:meIcon,zIndexOffset:1000}).addTo(map).bindPopup('Votre position');" & _
              "if(e.accuracy){L.circle(e.latlng,{radius:e.accuracy,color:'#2A7FFF',weight:1,fillOpacity:.08}).addTo(map);}" & _
              "b.push([e.latlng.lat,e.latlng.lng]);map.fitBounds(b,{padding:[60,60]});});"
    End If

    Dim h As String
    h = HtmlHead("Carte " & EscHtml(titre))
    h = h & "<body><div class='ttl'>" & Emo(&H26FD&) & " Stations " & EscHtml(titre) & " - prix moyens</div>" & _
        "<div id='map'></div><script>" & _
        "var pts=[" & pts & "];" & _
        "var map=L.map('map');" & _
        "L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png'," & _
        "{maxZoom:19,attribution:'&copy; OpenStreetMap'}).addTo(map);" & _
        "var meIcon=L.divIcon({className:'me',iconSize:[28,28],iconAnchor:[14,14],html:'" & Emo(&H1F697&) & "'});" & _
        LogosJs(slugs) & _
        StIconJs() & _
        "var b=[];pts.forEach(function(p){" & _
        "var ic=stIcon(p[3]+' EUR/L',p[4],p[5]);" & _
        "var mk=L.marker([p[0],p[1]],{icon:ic}).addTo(map);"
    h = h & "mk.bindPopup('<b>'+p[2]+'</b><br>'+p[3]+' EUR/L<br>'+" & _
        "'<a href=""https://www.google.com/maps/dir/?api=1&destination='+p[0]+','+p[1]+'"" target=""_blank"">Google Maps</a> &middot; '+" & _
        "'<a href=""https://waze.com/ul?ll='+p[0]+','+p[1]+'&navigate=yes"" target=""_blank"">Waze</a>');" & _
        "b.push([p[0],p[1]]);});" & _
        "if(b.length===1){map.setView(b[0],13);}else{map.fitBounds(b,{padding:[60,60]});}" & _
        ujs & _
        "</script></body></html>"
    GenererHtmlCarte = h
End Function

' Head HTML commun : Leaflet CDN + CSS marqueurs style app (pin goutte + badge prix).
Private Function HtmlHead(titre As String) As String
    HtmlHead = "<!doctype html><html><head><meta charset='utf-8'>" & _
        "<meta name='viewport' content='width=device-width,initial-scale=1'>" & _
        "<title>" & titre & "</title>" & _
        "<link rel='stylesheet' href='https://unpkg.com/leaflet@1.9.4/dist/leaflet.css'>" & _
        "<script src='https://unpkg.com/leaflet@1.9.4/dist/leaflet.js'></script>" & _
        "<style>html,body{margin:0;height:100%;font-family:Segoe UI,Arial,sans-serif}#map{height:100%}" & _
        ".ttl{position:absolute;z-index:1000;top:8px;left:54px;background:#1B3A5C;color:#fff;" & _
        "padding:6px 12px;border-radius:8px;font:700 14px Segoe UI,Arial;max-width:60%}"
    HtmlHead = HtmlHead & _
        ".b-mk{display:flex;flex-direction:column;align-items:center;line-height:1}" & _
        ".b-pin{width:30px;height:30px;background:#fff;border:2px solid #2E75B6;" & _
        "border-radius:10px;box-shadow:0 1px 4px rgba(0,0,0,.3);overflow:hidden;" & _
        "display:flex;align-items:center;justify-content:center}" & _
        ".b-pin img{width:100%;height:100%;min-width:0;min-height:0;object-fit:contain;padding:4px;" & _
        "box-sizing:border-box;display:block;pointer-events:none}" & _
        ".b-badge{background:#fff;color:#2E75B6;font:700 10px/1 Arial;padding:3px 6px;" & _
        "border-radius:7px;border:2px solid #2E75B6;white-space:nowrap;box-shadow:0 1px 4px rgba(0,0,0,.3)}" & _
        ".b-badge.hb{border-radius:0 0 7px 7px;margin-top:-3px}" & _
        ".me{width:28px;height:28px;display:flex;align-items:center;justify-content:center;" & _
        "background:#2563EB;border:2px solid #fff;border-radius:50%;" & _
        "box-shadow:0 0 0 3px rgba(37,99,235,.35),0 2px 6px rgba(0,0,0,.3);" & _
        "font-size:15px;animation:mepulse 2s infinite}" & _
        "@keyframes mepulse{0%{box-shadow:0 0 0 3px rgba(37,99,235,.35)}" & _
        "70%{box-shadow:0 0 0 16px rgba(37,99,235,0)}100%{box-shadow:0 0 0 3px rgba(37,99,235,.35)}}" & _
        ".ep{width:16px;height:16px;border:3px solid #fff;border-radius:50%;box-shadow:0 0 3px rgba(0,0,0,.4)}" & _
        ".dep{background:#1D9E75}.arr{background:#D64545}" & _
        "</style></head>"
End Function


' JS factory : DivIcon style app (badge LOGO enseigne + pastille prix).
' p = [lat,lon,nom,prix,...,slug,color,medaille?]. LOGOS = {slug:dataUri}.
Private Function StIconJs() As String
    StIconJs = "function stIcon(label,slug,color){" & _
        "var uri=LOGOS[slug]||LOGOS['generic'];" & _
        "var ar=(typeof LOGOS_AR!=='undefined'&&LOGOS_AR[slug])||1;" & _
        "var W=30,H=30;if(ar>1.3){W=Math.round(22*ar)+8;if(W>72){W=72;H=Math.round(64/ar)+8;}}" & _
        "var pin=uri?('<div class=""b-pin"" style=""border-color:'+color+';width:'+W+'px;height:'+H+'px""><img src=""'+uri+'""></div>'):'';" & _
        "var hb=uri?' hb':'';var iw=Math.max(W,52);" & _
        "return L.divIcon({className:'',iconSize:[iw,54],iconAnchor:[iw/2,54]," & _
        "html:'<div class=""b-mk"">'+pin+'<span class=""b-badge""'+hb+' style=""color:'+color+';border-color:'+color+'"">'+label+'</span></div>'});}"
End Function


' Double -> chaine JS a point decimal (independant de la locale).
Private Function JsNum(ByVal v As Double) As String
    JsNum = Trim$(Str$(v))
End Function

' Prix -> chaine 3 decimales, point decimal.
Private Function PrixStr(ByVal v As Double) As String
    PrixStr = Replace(Format$(v, "0.000"), ",", ".")
End Function

' Echappe une chaine pour un litteral JS entre guillemets doubles.
Private Function EscJs(s As String) As String
    Dim x As String: x = s
    x = Replace(x, "\", "\\")
    x = Replace(x, """", "\""")
    x = Replace(x, vbCr, " ")
    x = Replace(x, vbLf, " ")
    EscJs = x
End Function


' ============================================================
'  GEOCODAGE (API gouv. v2.1)
' ============================================================

' Extrait la ville d'un nom "Enseigne - Ville" -> "Ville".
' Repli : si pas de separateur " - ", on tente le nom entier comme ville.
Private Function VilleFromName(name As String) As String
    Dim s As String: s = Trim$(name)
    Dim p As Long
    p = InStrRev(s, " - ")
    If p = 0 Then p = InStrRev(s, " " & ChrW(8211) & " ")   ' tiret demi-cadratin
    If p > 0 Then
        VilleFromName = Trim$(Mid$(s, p + 3))
    Else
        VilleFromName = s
    End If
End Function

' Resout lat/lon d'une ville (1er candidat) - utilise par DiagnoseCarte.
Private Function GeocodeVille(ville As String, ByRef lat As Double, ByRef lon As Double) As Boolean
    Dim lats() As Double, lons() As Double
    If GeocodeCandidates(ville, lats, lons) > 0 Then
        lat = lats(1): lon = lons(1)
        GeocodeVille = (lat <> 0 Or lon <> 0)
    End If
End Function

' Recupere TOUS les candidats (lon/lat) d'une ville via l'API v2.1.
' geom v2.1 = {"lon": x, "lat": y}. Renvoie le nombre de candidats.
Private Function GeocodeCandidates(ville As String, ByRef lats() As Double, ByRef lons() As Double) As Long
    On Error GoTo Fail
    Dim whereClause As String, url As String, resp As String
    whereClause = "ville like """ & Replace(ville, """", "") & "%"""
    url = PRIX_API & "?where=" & Application.WorksheetFunction.EncodeURL(whereClause) & "&select=geom&limit=20"

    Dim http As Object
    Set http = CreateObject("WinHttp.WinHttpRequest.5.1")
    http.SetTimeouts 5000, 10000, 15000, 15000
    http.Open "GET", url, False
    http.Send
    If http.Status <> 200 Then GoTo Fail
    resp = http.ResponseText

    Dim re As Object: Set re = CreateObject("VBScript.RegExp")
    re.Global = True
    re.Pattern = """lon""\s*:\s*(-?\d+\.?\d*)\s*,\s*""lat""\s*:\s*(-?\d+\.?\d*)"
    Dim mm As Object: Set mm = re.Execute(resp)
    Dim n As Long: n = mm.Count
    If n = 0 Then GoTo Fail

    ReDim lats(1 To n): ReDim lons(1 To n)
    Dim i As Long
    For i = 0 To n - 1
        lons(i + 1) = CDbl(Replace(mm(i).SubMatches(0), ".", DecSep()))
        lats(i + 1) = CDbl(Replace(mm(i).SubMatches(1), ".", DecSep()))
    Next i
    GeocodeCandidates = n
    Exit Function
Fail:
    GeocodeCandidates = 0
End Function

' Distance approchee (en degres equivalents) pour comparer des candidats.
Private Function MetricDist(ByVal lat1 As Double, ByVal lon1 As Double, ByVal lat2 As Double, ByVal lon2 As Double) As Double
    Dim dLat As Double, dLon As Double
    dLat = lat1 - lat2
    dLon = (lon1 - lon2) * Cos(lat1 * 3.14159265358979 / 180)
    MetricDist = Sqr(dLat * dLat + dLon * dLon)
End Function

' Retrouve le nom original (casse d'origine) d'une station depuis sa cle minuscule.
Private Function NameFromKey(key As String) As String
    Dim i As Long
    For i = 1 To g_n
        If LCase$(g_st(i).name) = key Then NameFromKey = g_st(i).name: Exit Function
    Next i
    NameFromKey = key
End Function

' Position utilisateur depuis la cellule Carte_Position : "lat;lon" (ou "lat,lon")
' ou un nom de ville/adresse (geocode via api-adresse.data.gouv.fr).
Private Function ResolveUserPos(ByRef lat As Double, ByRef lon As Double) As Boolean
    Dim s As String: s = Trim$(CStr(ReadName("Carte_Position")))
    If s = "" Then
        ' Repli : geolocalisation automatique par IP (sans saisie).
        Dim vIP As String
        ResolveUserPos = GeolocaliserIP(lat, lon, vIP)
        Exit Function
    End If

    Dim sep As String
    If InStr(s, ";") > 0 Then
        sep = ";"
    ElseIf InStr(s, ",") > 0 Then
        sep = ","
    End If
    If sep <> "" Then
        Dim p() As String: p = Split(s, sep)
        If UBound(p) >= 1 Then
            Dim a As String, b As String
            a = Replace(Trim$(p(0)), ".", DecSep())
            b = Replace(Trim$(p(1)), ".", DecSep())
            If IsNumeric(a) And IsNumeric(b) Then
                lat = CDbl(a): lon = CDbl(b)
                ResolveUserPos = (lat <> 0 Or lon <> 0)
                Exit Function
            End If
        End If
    End If

    ResolveUserPos = GeocodeAdresse(s, lat, lon)
End Function

' Geocode une adresse/ville via la Base Adresse Nationale (GeoJSON coordinates[lon,lat]).
Private Function GeocodeAdresse(q As String, ByRef lat As Double, ByRef lon As Double) As Boolean
    On Error GoTo Fail
    Dim url As String, resp As String
    url = "https://api-adresse.data.gouv.fr/search/?limit=1&q=" & Application.WorksheetFunction.EncodeURL(q)
    Dim http As Object: Set http = CreateObject("WinHttp.WinHttpRequest.5.1")
    http.SetTimeouts 5000, 10000, 15000, 15000
    http.Open "GET", url, False
    http.Send
    If http.Status <> 200 Then GoTo Fail
    resp = http.ResponseText

    Dim re As Object: Set re = CreateObject("VBScript.RegExp")
    re.Pattern = """coordinates""\s*:\s*\[\s*(-?\d+\.?\d*)\s*,\s*(-?\d+\.?\d*)"
    Dim mm As Object: Set mm = re.Execute(resp)
    If mm.Count > 0 Then
        lon = CDbl(Replace(mm(0).SubMatches(0), ".", DecSep()))
        lat = CDbl(Replace(mm(0).SubMatches(1), ".", DecSep()))
        GeocodeAdresse = (lat <> 0 Or lon <> 0)
    End If
    Exit Function
Fail:
    GeocodeAdresse = False
End Function

' Separateur decimal local (pour CDbl d'une chaine a point).
Private Function DecSep() As String
    DecSep = Mid$(CStr(1.5), 2, 1)
End Function


' ============================================================
'  CACHE COORDONNEES (_StationCoords)
' ============================================================
Private Function CoordsSheet() As Worksheet
    On Error Resume Next
    Set CoordsSheet = ThisWorkbook.Sheets(WS_COORDS)
    On Error GoTo 0
    If CoordsSheet Is Nothing Then
        Set CoordsSheet = ThisWorkbook.Sheets.Add(After:=ThisWorkbook.Sheets(ThisWorkbook.Sheets.Count))
        CoordsSheet.Name = WS_COORDS
        CoordsSheet.Range("A1:D1").Value = Array("Station", "Lat", "Lon", "Source")
        CoordsSheet.Range("A1:D1").Font.Bold = True
        CoordsSheet.Visible = xlSheetHidden
    End If
End Function

Private Function LoadCoordsDict() As Object
    Dim d As Object: Set d = CreateObject("Scripting.Dictionary")
    Dim ws As Worksheet: Set ws = CoordsSheet()
    Dim last As Long: last = ws.Cells(ws.Rows.Count, 1).End(xlUp).Row
    Dim r As Long, nm As String
    For r = 2 To last
        nm = Trim$(CStr(ws.Cells(r, 1).Value))
        If nm <> "" Then d(LCase$(nm)) = ws.Cells(r, 2).Value & ";" & ws.Cells(r, 3).Value
    Next r
    Set LoadCoordsDict = d
End Function

Private Sub SaveCoord(name As String, lat As Double, lon As Double, src As String)
    Dim ws As Worksheet: Set ws = CoordsSheet()
    Dim last As Long: last = ws.Cells(ws.Rows.Count, 1).End(xlUp).Row
    Dim r As Long, found As Long: found = 0
    For r = 2 To last
        If LCase$(Trim$(CStr(ws.Cells(r, 1).Value))) = LCase$(name) Then found = r: Exit For
    Next r
    If found = 0 Then found = last + 1
    ws.Cells(found, 1).Value = name
    ws.Cells(found, 2).Value = lat
    ws.Cells(found, 3).Value = lon
    ws.Cells(found, 4).Value = src
End Sub


' ============================================================
'  HELPERS
' ============================================================

Private Function CurrentFuelKey() As String
    Dim v As String: v = LCase$(CStr(ReadName("Carte_Fuel")))
    If InStr(v, "gazole") > 0 Then
        CurrentFuelKey = "GAZOLE"
    ElseIf InStr(v, "98") > 0 Then
        CurrentFuelKey = "SP98"
    Else
        CurrentFuelKey = "E85"
    End If
End Function

Private Function CurrentFuelShort() As String
    Select Case CurrentFuelKey()
        Case "GAZOLE": CurrentFuelShort = "Gazole"
        Case "SP98":   CurrentFuelShort = "SP98"
        Case Else:     CurrentFuelShort = "E85"
    End Select
End Function

Private Function ReadName(nm As String) As Variant
    On Error Resume Next
    ReadName = ThisWorkbook.Names(nm).RefersToRange.Value
    On Error GoTo 0
End Function

' Le type d'un plein correspond-il au carburant ? (tokens, comme l'app)
Private Function FuelMatch(fuelKey As String, typeStr As String) As Boolean
    Dim t As String: t = LCase$(typeStr)
    Select Case fuelKey
        Case "E85"
            FuelMatch = (InStr(t, "e85") > 0 Or InStr(t, "ethanol") > 0 Or InStr(t, "thanol") > 0)
        Case "GAZOLE"
            FuelMatch = (InStr(t, "gazole") > 0 Or InStr(t, "diesel") > 0 Or InStr(t, "gasoil") > 0 Or InStr(t, "gazoil") > 0)
        Case "SP98"
            FuelMatch = (InStr(t, "sp98") > 0 Or InStr(t, "super 98") > 0 Or InStr(t, "super98") > 0 Or InStr(t, "98") > 0)
    End Select
End Function

Private Function EscHtml(s As String) As String
    Dim x As String: x = s
    x = Replace(x, "&", "&amp;")
    x = Replace(x, "<", "&lt;")
    x = Replace(x, ">", "&gt;")
    x = Replace(x, """", "&quot;")
    EscHtml = x
End Function

Private Sub EcrireUtf8(path As String, contenu As String)
    On Error GoTo Fallback
    Dim st As Object: Set st = CreateObject("ADODB.Stream")
    st.Type = 2: st.Charset = "utf-8": st.Open
    st.WriteText contenu
    st.SaveToFile path, 2
    st.Close
    Exit Sub
Fallback:
    Dim f As Integer: f = FreeFile
    Open path For Output As #f
    Print #f, contenu;
    Close #f
End Sub

Private Function GetDataTable() As ListObject
    Dim dataWs As Worksheet
    On Error Resume Next
    Set dataWs = ThisWorkbook.Sheets(WS_DATA)
    On Error GoTo 0
    If dataWs Is Nothing Then Exit Function
    If dataWs.ListObjects.Count = 0 Then Exit Function
    Set GetDataTable = dataWs.ListObjects(1)
End Function

Private Function GetOrCreateSheet(nm As String) As Worksheet
    On Error Resume Next
    Set GetOrCreateSheet = ThisWorkbook.Sheets(nm)
    On Error GoTo 0
    If GetOrCreateSheet Is Nothing Then
        Set GetOrCreateSheet = ThisWorkbook.Sheets.Add(After:=ThisWorkbook.Sheets(ThisWorkbook.Sheets.Count))
        GetOrCreateSheet.Name = nm
    End If
End Function

Private Sub AddButton(ws As Worksheet, nm As String, L As Single, T As Single, _
                      caption As String, macro As String, fill As Long)
    Dim sh As Shape
    Set sh = ws.Shapes.AddShape(msoShapeRoundedRectangle, L, T, 200, 26)
    sh.Name = nm
    With sh
        .Fill.ForeColor.RGB = fill
        .Line.Visible = msoFalse
        With .TextFrame2
            .TextRange.Text = caption
            .TextRange.Font.Fill.ForeColor.RGB = vbWhite
            .TextRange.Font.Bold = msoTrue
            .TextRange.Font.Size = 10
            .TextRange.ParagraphFormat.Alignment = msoAlignCenter
            .HorizontalAnchor = msoAnchorCenter
            .VerticalAnchor = msoAnchorMiddle
        End With
        .OnAction = macro
    End With
End Sub

' ============================================================
'  VUE 1 - CARTE A PROXIMITE
' ============================================================
Public Sub CarteProximite()
    Dim html As String, path As String
    On Error GoTo ErrH

    g_userHas = ResolveUserPos(g_userLat, g_userLon)
    If Not g_userHas Then
        SetStatus "[Carte] " & ChrW(9888) & " Renseignez 'Ma position' (lat;lon ou ville) avant la recherche de proximite."
        Exit Sub
    End If

    Dim rayonKm As Double: rayonKm = ReadRayonKm()
    Dim rayonM As Double: rayonM = rayonKm * 1000#

    Dim fuelKey As String: fuelKey = CurrentFuelKey()
    Dim field As String: field = FuelApiField(fuelKey)

    Dim res() As StAvg, nb As Long
    nb = QueryProximite(field, g_userLon, g_userLat, rayonM, res)
    If nb = 0 Then
        SetStatus "[Carte] " & ChrW(9888) & " Aucune station " & CurrentFuelShort() & _
                  " dans un rayon de " & Format$(rayonKm, "0") & " km."
        Exit Sub
    End If

    EnrichEnseignesOSM res, nb        ' enseigne reelle via OSM (logos + "Enseigne - Ville")
    html = GenererHtmlProximite(res, nb, CurrentFuelShort(), rayonKm, rayonM)
    path = Environ$("TEMP") & "\suivi_carte_proximite.html"
    EcrireUtf8 path, html
    Shell "explorer.exe """ & path & """", vbNormalFocus
    SetStatus "[Carte] " & ChrW(10003) & " " & nb & " stations " & CurrentFuelShort() & _
              " a proximite (rayon " & Format$(rayonKm, "0") & " km)."
    Exit Sub
ErrH:
    SetStatus "[Carte] " & ChrW(9888) & " Erreur proximite " & Err.Number & " : " & Err.Description
End Sub


Private Function QueryProximite(field As String, lon As Double, lat As Double, _
                                rayonM As Double, ByRef res() As StAvg) As Long
    On Error GoTo Fail
    Dim whereClause As String, sel As String, url As String, resp As String
    whereClause = "(" & field & " is not null) and distance(geom, geom'POINT(" & _
                  JsNum(lon) & " " & JsNum(lat) & ")', " & Format$(rayonM, "0") & "m)"
    sel = "adresse,ville,cp,geom," & field
    url = PRIX_API & "?where=" & Application.WorksheetFunction.EncodeURL(whereClause) & _
          "&select=" & Application.WorksheetFunction.EncodeURL(sel) & "&limit=50"

    Dim http As Object: Set http = CreateObject("WinHttp.WinHttpRequest.5.1")
    http.SetTimeouts 5000, 10000, 15000, 15000
    http.Open "GET", url, False
    http.Send
    If http.Status <> 200 Then GoTo Fail
    resp = http.ResponseText

    QueryProximite = ParseRecords(resp, field, res)
    If QueryProximite > 0 Then SortByPrice res, QueryProximite
    Exit Function
Fail:
    QueryProximite = 0
End Function


Private Function GenererHtmlProximite(res() As StAvg, nb As Long, titre As String, _
                                      rayonKm As Double, rayonM As Double) As String
    Dim pts As String, i As Long
    Dim slugs As Object: Set slugs = CreateObject("Scripting.Dictionary")
    Dim sl As String, col As String
    For i = 1 To nb
        Dim dk As Double: dk = HaversineKm(g_userLat, g_userLon, res(i).lat, res(i).lon)
        Dim med As String: med = ""
        If i = 1 Then
            med = Emo(&H1F947&)
        ElseIf i = 2 Then
            med = Emo(&H1F948&)
        ElseIf i = 3 Then
            med = Emo(&H1F949&)
        End If
        BrandSlugColor res(i).name, sl, col
        If sl <> "" Then slugs(sl) = True
        If pts <> "" Then pts = pts & ","
        pts = pts & "[" & JsNum(res(i).lat) & "," & JsNum(res(i).lon) & ",""" & _
              EscJs(res(i).name) & """,""" & PrixStr(res(i).avg) & """,""" & _
              JsNum(dk) & """,""" & EscJs(med) & """,""" & sl & """,""" & col & """]"
    Next i

    Dim h As String
    h = HtmlHead("Stations " & EscHtml(titre) & " a proximite")
    h = h & "<body><div class='ttl'>" & Emo(&H26FD&) & " Stations " & EscHtml(titre) & _
        " a proximite (" & Format$(rayonKm, "0") & " km)</div>" & _
        "<div id='map'></div><script>" & _
        "var pts=[" & pts & "];" & _
        "var u=[" & JsNum(g_userLat) & "," & JsNum(g_userLon) & "];" & _
        "var map=L.map('map');" & _
        "L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png'," & _
        "{maxZoom:19,attribution:'&copy; OpenStreetMap'}).addTo(map);" & _
        "var meIcon=L.divIcon({className:'me',iconSize:[28,28],iconAnchor:[14,14],html:'" & Emo(&H1F697&) & "'});" & _
        LogosJs(slugs) & _
        StIconJs() & _
        "L.circle(u,{radius:" & JsNum(rayonM) & ",color:'#2E75B6',weight:2,fillOpacity:0.05}).addTo(map);" & _
        "var b=[u];pts.forEach(function(p){" & _
        "var lab=(p[5]?p[5]+' ':'')+p[3]+' EUR/L';" & _
        "var ic=stIcon(lab,p[6],p[7]);" & _
        "var mk=L.marker([p[0],p[1]],{icon:ic}).addTo(map);"
    h = h & "mk.bindPopup('<b>'+(p[5]?p[5]+' ':'')+p[2]+'</b><br>'+p[3]+' EUR/L<br>'+p[4]+' km<br>'+" & _
        "'<a href=""https://www.google.com/maps/dir/?api=1&destination='+p[0]+','+p[1]+'"" target=""_blank"">Google Maps</a> &middot; '+" & _
        "'<a href=""https://waze.com/ul?ll='+p[0]+','+p[1]+'&navigate=yes"" target=""_blank"">Waze</a>');" & _
        "b.push([p[0],p[1]]);});" & _
        "L.marker(u,{icon:meIcon,zIndexOffset:1000}).addTo(map).bindPopup('Votre position');" & _
        "map.fitBounds(b,{padding:[60,60]});" & _
        "</script></body></html>"
    GenererHtmlProximite = h
End Function


' ============================================================
'  VUE 2 - CARTE ITINERAIRE
' ============================================================
Public Sub CarteItineraire()
    Dim html As String, path As String
    On Error GoTo ErrH

    Dim dep As String, arr As String
    dep = Trim$(CStr(ReadName("Carte_Depart")))
    arr = Trim$(CStr(ReadName("Carte_Arrivee")))
    If dep = "" Or arr = "" Then
        SetStatus "[Carte] " & ChrW(9888) & " Renseignez le depart ET l'arrivee de l'itineraire."
        Exit Sub
    End If

    Dim lat1 As Double, lon1 As Double, lat2 As Double, lon2 As Double
    If Not GeocodeAdresse(dep, lat1, lon1) Then
        SetStatus "[Carte] " & ChrW(9888) & " Depart introuvable : " & dep
        Exit Sub
    End If
    If Not GeocodeAdresse(arr, lat2, lon2) Then
        SetStatus "[Carte] " & ChrW(9888) & " Arrivee introuvable : " & arr
        Exit Sub
    End If

    Dim rLats() As Double, rLons() As Double, nPoly As Long
    nPoly = OsrmRoute(lon1, lat1, lon2, lat2, rLats, rLons)
    If nPoly = 0 Then
        SetStatus "[Carte] " & ChrW(9888) & " Itineraire OSRM indisponible (reseau ?)."
        Exit Sub
    End If

    Dim fuelKey As String: fuelKey = CurrentFuelKey()
    Dim field As String: field = FuelApiField(fuelKey)

    Dim res() As StAvg, nb As Long
    nb = QueryItineraire(field, rLats, rLons, nPoly, res)
    If nb > 0 Then EnrichEnseignesOSM res, nb   ' enseigne reelle via OSM (logos + nommage)

    html = GenererHtmlItineraire(res, nb, CurrentFuelShort(), dep, arr, _
                                 rLats, rLons, nPoly, lat1, lon1, lat2, lon2)
    path = Environ$("TEMP") & "\suivi_carte_itineraire.html"
    EcrireUtf8 path, html
    Shell "explorer.exe """ & path & """", vbNormalFocus
    SetStatus "[Carte] " & ChrW(10003) & " Itineraire " & dep & " -> " & arr & _
              " : " & nb & " stations " & CurrentFuelShort() & " le long du trajet."
    Exit Sub
ErrH:
    SetStatus "[Carte] " & ChrW(9888) & " Erreur itineraire " & Err.Number & " : " & Err.Description
End Sub


Private Function OsrmRoute(lon1 As Double, lat1 As Double, lon2 As Double, lat2 As Double, _
                           ByRef rLats() As Double, ByRef rLons() As Double) As Long
    On Error GoTo Fail
    Dim url As String, resp As String
    url = OSRM_API & JsNum(lon1) & "," & JsNum(lat1) & ";" & _
          JsNum(lon2) & "," & JsNum(lat2) & "?overview=full&geometries=geojson"

    Dim http As Object: Set http = CreateObject("WinHttp.WinHttpRequest.5.1")
    http.SetTimeouts 5000, 10000, 20000, 20000
    http.Open "GET", url, False
    http.Send
    If http.Status <> 200 Then GoTo Fail
    resp = http.ResponseText

    Dim p As Long, q As Long, blob As String
    p = InStr(resp, """coordinates""")
    If p = 0 Then GoTo Fail
    p = InStr(p, resp, "[")
    If p = 0 Then GoTo Fail
    q = InStr(p, resp, "]]")
    If q = 0 Then GoTo Fail
    blob = Mid$(resp, p, q - p + 2)

    Dim re As Object: Set re = CreateObject("VBScript.RegExp")
    re.Global = True
    re.Pattern = "\[\s*(-?\d+\.?\d*)\s*,\s*(-?\d+\.?\d*)\s*\]"
    Dim mm As Object: Set mm = re.Execute(blob)
    Dim n As Long: n = mm.Count
    If n = 0 Then GoTo Fail

    ReDim rLats(1 To n): ReDim rLons(1 To n)
    Dim i As Long
    For i = 0 To n - 1
        rLons(i + 1) = CDbl(Replace(mm(i).SubMatches(0), ".", DecSep()))
        rLats(i + 1) = CDbl(Replace(mm(i).SubMatches(1), ".", DecSep()))
    Next i
    OsrmRoute = n
    Exit Function
Fail:
    OsrmRoute = 0
End Function


Private Function QueryItineraire(field As String, rLats() As Double, rLons() As Double, _
                                 nPoly As Long, ByRef res() As StAvg) As Long
    On Error GoTo Fail
    Dim dseen As Object: Set dseen = CreateObject("Scripting.Dictionary")
    Dim acc() As StAvg, accN As Long: accN = 0
    ReDim acc(1 To 60)

    Dim fracs As Variant: fracs = Array(0#, 0.25, 0.5, 0.75, 1#)
    Dim s As Long, idx As Long
    For s = 0 To UBound(fracs)
        idx = 1 + CLng(CDbl(fracs(s)) * (nPoly - 1))
        If idx < 1 Then idx = 1
        If idx > nPoly Then idx = nPoly

        Dim tmp() As StAvg, k As Long
        k = QueryAround(field, rLons(idx), rLats(idx), 5000#, tmp)
        Dim j As Long
        For j = 1 To k
            ' Dedup par COORDONNEES (le nommage "Station - Ville" pre-OSM fusionnerait
            ' a tort des stations homonymes distinctes).
            Dim key As String: key = Format$(tmp(j).lat, "0.0000") & "," & Format$(tmp(j).lon, "0.0000")
            If Not dseen.Exists(key) Then
                dseen(key) = 1
                accN = accN + 1
                If accN > UBound(acc) Then ReDim Preserve acc(1 To accN + 30)
                acc(accN) = tmp(j)
            End If
        Next j
    Next s

    If accN = 0 Then QueryItineraire = 0: Exit Function
    ReDim res(1 To accN)
    For j = 1 To accN: res(j) = acc(j): Next j
    SortByPrice res, accN
    QueryItineraire = accN
    Exit Function
Fail:
    QueryItineraire = 0
End Function


Private Function QueryAround(field As String, lon As Double, lat As Double, _
                             rayonM As Double, ByRef res() As StAvg) As Long
    On Error GoTo Fail
    Dim whereClause As String, sel As String, url As String, resp As String
    whereClause = "(" & field & " is not null) and distance(geom, geom'POINT(" & _
                  JsNum(lon) & " " & JsNum(lat) & ")', " & Format$(rayonM, "0") & "m)"
    sel = "adresse,ville,cp,geom," & field
    url = PRIX_API & "?where=" & Application.WorksheetFunction.EncodeURL(whereClause) & _
          "&select=" & Application.WorksheetFunction.EncodeURL(sel) & "&limit=10"

    Dim http As Object: Set http = CreateObject("WinHttp.WinHttpRequest.5.1")
    http.SetTimeouts 5000, 10000, 15000, 15000
    http.Open "GET", url, False
    http.Send
    If http.Status <> 200 Then GoTo Fail
    resp = http.ResponseText
    QueryAround = ParseRecords(resp, field, res)
    Exit Function
Fail:
    QueryAround = 0
End Function


Private Function GenererHtmlItineraire(res() As StAvg, nb As Long, titre As String, _
                                       dep As String, arr As String, _
                                       rLats() As Double, rLons() As Double, nPoly As Long, _
                                       lat1 As Double, lon1 As Double, _
                                       lat2 As Double, lon2 As Double) As String
    Dim poly As String, i As Long
    For i = 1 To nPoly
        If poly <> "" Then poly = poly & ","
        poly = poly & "[" & JsNum(rLats(i)) & "," & JsNum(rLons(i)) & "]"
    Next i

    Dim pts As String
    Dim slugs As Object: Set slugs = CreateObject("Scripting.Dictionary")
    Dim sl As String, col As String
    For i = 1 To nb
        BrandSlugColor res(i).name, sl, col
        If sl <> "" Then slugs(sl) = True
        If pts <> "" Then pts = pts & ","
        pts = pts & "[" & JsNum(res(i).lat) & "," & JsNum(res(i).lon) & ",""" & _
              EscJs(res(i).name) & """,""" & PrixStr(res(i).avg) & """,""" & _
              sl & """,""" & col & """]"
    Next i

    Dim h As String
    h = HtmlHead("Itineraire " & EscHtml(titre))
    h = h & "<body><div class='ttl'>" & Emo(&H1F6E3&) & " Itineraire " & EscHtml(dep) & _
        " " & ChrW(8594) & " " & EscHtml(arr) & " - Stations " & EscHtml(titre) & "</div>" & _
        "<div id='map'></div><script>" & _
        "var poly=[" & poly & "];" & _
        "var pts=[" & pts & "];" & _
        "var d=[" & JsNum(lat1) & "," & JsNum(lon1) & "];" & _
        "var a=[" & JsNum(lat2) & "," & JsNum(lon2) & "];" & _
        "var map=L.map('map');" & _
        "L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png'," & _
        "{maxZoom:19,attribution:'&copy; OpenStreetMap'}).addTo(map);" & _
        LogosJs(slugs) & _
        StIconJs() & _
        "var line=L.polyline(poly,{color:'#1B3A5C',weight:4}).addTo(map);" & _
        "var depIcon=L.divIcon({className:'ep dep',iconSize:[16,16],iconAnchor:[8,8]});" & _
        "var arrIcon=L.divIcon({className:'ep arr',iconSize:[16,16],iconAnchor:[8,8]});" & _
        "L.marker(d,{icon:depIcon,zIndexOffset:1000}).addTo(map).bindPopup('Depart : " & EscJs(dep) & "');" & _
        "L.marker(a,{icon:arrIcon,zIndexOffset:1000}).addTo(map).bindPopup('Arrivee : " & EscJs(arr) & "');"
    h = h & "pts.forEach(function(p){" & _
        "var ic=stIcon(p[3]+' EUR/L',p[4],p[5]);" & _
        "var mk=L.marker([p[0],p[1]],{icon:ic}).addTo(map);" & _
        "mk.bindPopup('<b>'+p[2]+'</b><br>'+p[3]+' EUR/L<br>'+" & _
        "'<a href=""https://www.google.com/maps/dir/?api=1&destination='+p[0]+','+p[1]+'"" target=""_blank"">Google Maps</a> &middot; '+" & _
        "'<a href=""https://waze.com/ul?ll='+p[0]+','+p[1]+'&navigate=yes"" target=""_blank"">Waze</a>');" & _
        "});" & _
        "map.fitBounds(line.getBounds(),{padding:[60,60]});" & _
        "</script></body></html>"
    GenererHtmlItineraire = h
End Function


' ============================================================
'  HELPERS PARTAGES (proximite + itineraire)
' ============================================================
Private Function ParseRecords(resp As String, field As String, ByRef res() As StAvg) As Long
    On Error GoTo Fail
    Dim reG As Object: Set reG = CreateObject("VBScript.RegExp")
    reG.Global = True
    reG.Pattern = """lon""\s*:\s*(-?\d+\.?\d*)\s*,\s*""lat""\s*:\s*(-?\d+\.?\d*)"
    Dim mG As Object: Set mG = reG.Execute(resp)

    Dim reP As Object: Set reP = CreateObject("VBScript.RegExp")
    reP.Global = True
    reP.Pattern = """" & field & """\s*:\s*(\d+\.?\d*)"
    Dim mP As Object: Set mP = reP.Execute(resp)

    Dim reA As Object: Set reA = CreateObject("VBScript.RegExp")
    reA.Global = True
    reA.Pattern = """adresse""\s*:\s*""([^""]*)"""
    Dim mA As Object: Set mA = reA.Execute(resp)

    Dim reV As Object: Set reV = CreateObject("VBScript.RegExp")
    reV.Global = True
    reV.Pattern = """ville""\s*:\s*""([^""]*)"""
    Dim mV As Object: Set mV = reV.Execute(resp)

    Dim n As Long: n = mG.Count
    If n = 0 Then GoTo Fail

    ReDim res(1 To n)
    Dim i As Long, valid As Long: valid = 0
    For i = 0 To n - 1
        Dim prix As Double: prix = 0
        If i < mP.Count Then prix = CDbl(Replace(mP(i).SubMatches(0), ".", DecSep()))
        If prix <= 0 Then GoTo NextI2
        valid = valid + 1
        res(valid).lon = CDbl(Replace(mG(i).SubMatches(0), ".", DecSep()))
        res(valid).lat = CDbl(Replace(mG(i).SubMatches(1), ".", DecSep()))
        res(valid).avg = prix
        res(valid).hasCoord = True
        res(valid).count = 1
        Dim ad As String, vl As String
        ad = "": vl = ""
        If i < mA.Count Then ad = JsonUnescape(mA(i).SubMatches(0))
        If i < mV.Count Then vl = JsonUnescape(mV(i).SubMatches(0))
        ' Protocole app : "enseigne - ville". L'API ne fournit PAS la marque ->
        ' enseigne approximee depuis l'adresse ici, AFFINEE ensuite via OSM
        ' (EnrichEnseignesOSM). La ville est conservee pour ce renommage.
        res(valid).ville = vl
        res(valid).name = ComposeName(ResolveEnseigne(ad), vl)
        If res(valid).name = "" Then res(valid).name = "Station"
NextI2:
    Next i
    If valid = 0 Then GoTo Fail
    If valid < n Then ReDim Preserve res(1 To valid)
    ParseRecords = valid
    Exit Function
Fail:
    ParseRecords = 0
End Function


Private Sub SortByPrice(ByRef a() As StAvg, nb As Long)
    Dim i As Long, j As Long, tmp As StAvg
    For i = 2 To nb
        tmp = a(i): j = i - 1
        Do While j >= 1
            If a(j).avg <= tmp.avg Then Exit Do
            a(j + 1) = a(j): j = j - 1
        Loop
        a(j + 1) = tmp
    Next i
End Sub


Private Function FuelApiField(fuelKey As String) As String
    Select Case fuelKey
        Case "GAZOLE": FuelApiField = "gazole_prix"
        Case "SP98":   FuelApiField = "sp98_prix"
        Case Else:     FuelApiField = "e85_prix"
    End Select
End Function


Private Function HaversineKm(ByVal lat1 As Double, ByVal lon1 As Double, _
                             ByVal lat2 As Double, ByVal lon2 As Double) As Double
    Const R As Double = 6371#
    Const PI As Double = 3.14159265358979
    Dim rlat1 As Double, rlat2 As Double, dLat As Double, dLon As Double, aa As Double
    rlat1 = lat1 * PI / 180
    rlat2 = lat2 * PI / 180
    dLat = (lat2 - lat1) * PI / 180
    dLon = (lon2 - lon1) * PI / 180
    aa = Sin(dLat / 2) * Sin(dLat / 2) + _
         Cos(rlat1) * Cos(rlat2) * Sin(dLon / 2) * Sin(dLon / 2)
    Dim c As Double
    c = 2 * Atn2Sqrt(aa)
    HaversineKm = Int(R * c * 10 + 0.5) / 10
End Function


Private Function Atn2Sqrt(ByVal aa As Double) As Double
    Dim y As Double, x As Double
    y = Sqr(aa)
    x = Sqr(1 - aa)
    If x = 0 Then
        Atn2Sqrt = 1.5707963267949
    Else
        Atn2Sqrt = Atn(y / x)
    End If
End Function


Private Function ReadRayonKm() As Double
    Dim v As Variant: v = ReadName("Carte_Rayon")
    If IsNumeric(v) Then
        ReadRayonKm = CDbl(v)
        If ReadRayonKm <= 0 Then ReadRayonKm = 15
    Else
        ReadRayonKm = 15
    End If
End Function


' ============================================================
'  NOMMAGE STATIONS "enseigne - ville" (protocole de l'app)
' ============================================================

' Compose "enseigne - ville" (ville en casse propre, 1er segment).
Private Function ComposeName(enseigne As String, ville As String) As String
    Dim v As String: v = FormatVilleC(ville)
    Dim e As String: e = Trim$(enseigne)
    If v <> "" And e <> "" Then
        ComposeName = e & " - " & v
    ElseIf e <> "" Then
        ComposeName = e
    Else
        ComposeName = v
    End If
End Function

' Ville -> "nom propre" : 1er segment avant espace/tiret, capitalise.
' Ex : "FLERS-EN-ESCREBIEUX" -> "Flers" / "DOUAI" -> "Douai".
Private Function FormatVilleC(ville As String) As String
    Dim s As String: s = Trim$(CStr(ville))
    If s = "" Then Exit Function
    Dim i As Long, ch As String
    For i = 1 To Len(s)
        ch = Mid$(s, i, 1)
        If ch = " " Or ch = "-" Then Exit For
    Next i
    Dim first As String: first = Left$(s, i - 1)
    If first = "" Then Exit Function
    FormatVilleC = UCase$(Left$(first, 1)) & LCase$(Mid$(first, 2))
End Function

' Detecte l'enseigne depuis l'adresse (liste de marques, comme detectBrand).
' Renvoie le libelle de marque ou "Station" si rien.
Private Function ResolveEnseigne(adresse As String) As String
    Dim s As String: s = adresse
    ' Neutralise "Leclerc" comme odonyme (av./rue/bd... [General] Leclerc).
    If RegTest(s, "(g[e" & ChrW(233) & "]n[e" & ChrW(233) & "]ral|av(enue)?\.?|rue|bd|boulevard|place|pl\.?|chemin|route|rte)\s+(du\s+|de\s+|d'\s*)?(g[e" & ChrW(233) & "]n[e" & ChrW(233) & "]ral\s+)?leclerc") Then
        s = RegReplace(s, "leclerc", " ")
    End If
    Dim b As String: b = DetectEnseigne(s)
    If b <> "" Then
        ResolveEnseigne = b
    Else
        ResolveEnseigne = "Station"
    End If
End Function

' Liste de marques (ordre = specifique d'abord). Renvoie le libelle ou "".
Private Function DetectEnseigne(name As String) As String
    Dim s As String: s = name
    If RegTest(s, "total\s*acc|totalenergies|\btotal\b") Then DetectEnseigne = "Total": Exit Function
    If RegTest(s, "e[.\s]*leclerc|leclerc") Then DetectEnseigne = "Leclerc": Exit Function
    If RegTest(s, "intermarch|\bnetto\b|\broady\b") Then DetectEnseigne = "Intermarch" & ChrW(233): Exit Function
    If RegTest(s, "carrefour") Then DetectEnseigne = "Carrefour": Exit Function
    If RegTest(s, "super\s*u|hyper\s*u|\bu\s*express|syst[e" & ChrW(232) & "]me\s*u|magasins?\s*u") Then DetectEnseigne = "Syst" & ChrW(232) & "me U": Exit Function
    If RegTest(s, "auchan") Then DetectEnseigne = "Auchan": Exit Function
    If RegTest(s, "\besso\b") Then DetectEnseigne = "Esso": Exit Function
    If RegTest(s, "\bavia\b") Then DetectEnseigne = "Avia": Exit Function
    If RegTest(s, "\bbp\b") Then DetectEnseigne = "BP": Exit Function
    If RegTest(s, "\bshell\b") Then DetectEnseigne = "Shell": Exit Function
    If RegTest(s, "\bagip\b|\beni\b") Then DetectEnseigne = "Eni": Exit Function
    If RegTest(s, "dyneff") Then DetectEnseigne = "Dyneff": Exit Function
    If RegTest(s, "\bcora\b") Then DetectEnseigne = "Cora": Exit Function
    If RegTest(s, "casino|g[e" & ChrW(233) & "]ant|geant") Then DetectEnseigne = "Casino": Exit Function
    If RegTest(s, "\b" & ChrW(233) & "lan\b|\belan\b") Then DetectEnseigne = ChrW(201) & "lan": Exit Function
    If RegTest(s, "\bcolruyt\b") Then DetectEnseigne = "Colruyt": Exit Function
    DetectEnseigne = ""
End Function

' Mappe un nom (ou "enseigne - ville") vers slug d'icone + couleur de marque.
' Memes patterns/couleurs que brand.js de l'app. slug="" -> generic.
Private Sub BrandSlugColor(name As String, ByRef slug As String, ByRef color As String)
    Dim s As String: s = name
    slug = "": color = "#2E75B6"
    If RegTest(s, "total\s*acc|totalenergies|\btotal\b") Then slug = "total": color = "#E2001A": Exit Sub
    If RegTest(s, "e[.\s]*leclerc|leclerc") Then slug = "leclerc": color = "#0066B3": Exit Sub
    If RegTest(s, "intermarch|\bnetto\b|\broady\b") Then slug = "intermarche": color = "#D81E20": Exit Sub
    If RegTest(s, "carrefour") Then slug = "carrefour": color = "#0E4C96": Exit Sub
    If RegTest(s, "super\s*u|hyper\s*u|\bu\s*express|syst[e" & ChrW(232) & "]me\s*u|magasins?\s*u") Then slug = "systeme-u": color = "#E2001A": Exit Sub
    If RegTest(s, "auchan") Then slug = "auchan": color = "#E2001A": Exit Sub
    If RegTest(s, "\besso\b") Then slug = "esso": color = "#0033A0": Exit Sub
    If RegTest(s, "\bavia\b") Then slug = "avia": color = "#E2001A": Exit Sub
    If RegTest(s, "\bbp\b") Then slug = "bp": color = "#0A9A00": Exit Sub
    If RegTest(s, "\bshell\b") Then slug = "shell": color = "#D52B1E": Exit Sub
    If RegTest(s, "\bagip\b|\beni\b") Then slug = "eni": color = "#C8A21A": Exit Sub
    If RegTest(s, "dyneff") Then slug = "dyneff": color = "#E2001A": Exit Sub
    If RegTest(s, "\bcora\b") Then slug = "cora": color = "#E2001A": Exit Sub
    If RegTest(s, "casino|g[e" & ChrW(233) & "]ant|geant") Then slug = "casino": color = "#C8102E": Exit Sub
    If RegTest(s, "\b" & ChrW(233) & "lan\b|\belan\b") Then slug = "elan": color = "#0066B3": Exit Sub
    If RegTest(s, "\bcolruyt\b") Then slug = "colruyt": color = "#E2001A": Exit Sub
End Sub

' ============================================================
'  ENRICHISSEMENT ENSEIGNE via OSM/Overpass (comme enrichStationsBulk de l'app)
' ============================================================
' L'API prix-carburants ne fournit PAS la marque (que l'adresse = rue). On recupere
' l'enseigne (brand > name > operator) du noeud `amenity=fuel` OSM le plus proche
' (<= 300 m) via UNE requete Overpass groupee, et on renomme res().name en
' "Enseigne - Ville" -> BrandSlugColor retrouve alors le logo. Repli silencieux
' (noms inchanges) si Overpass echoue/timeout.
Private Sub EnrichEnseignesOSM(ByRef res() As StAvg, nb As Long)
    On Error GoTo Done
    If nb < 1 Then Exit Sub
    Const OVERPASS As String = "https://overpass-api.de/api/interpreter"
    Const QRAD As String = "300"
    Const MATCH_M As Double = 300#

    Dim q As String, i As Long
    q = "[out:json][timeout:25];("
    For i = 1 To nb
        q = q & "node(around:" & QRAD & "," & JsNum(res(i).lat) & "," & JsNum(res(i).lon) & ")[amenity=fuel];"
        q = q & "way(around:" & QRAD & "," & JsNum(res(i).lat) & "," & JsNum(res(i).lon) & ")[amenity=fuel];"
    Next i
    q = q & ");out tags center;"

    Dim http As Object: Set http = CreateObject("WinHttp.WinHttpRequest.5.1")
    http.SetTimeouts 5000, 10000, 25000, 25000
    http.Open "POST", OVERPASS, False
    http.SetRequestHeader "Content-Type", "application/x-www-form-urlencoded"
    ' Overpass renvoie 406 sans User-Agent explicite.
    http.SetRequestHeader "User-Agent", "SuiviConsoCarburant/1.0 (Excel VBA; +github.com/fdaubercy)"
    http.Send "data=" & Application.WorksheetFunction.EncodeURL(q)
    If http.Status <> 200 Then Exit Sub
    Dim resp As String: resp = http.ResponseText
    If Len(resp) = 0 Then Exit Sub

    ' Decoupe par element sur la cle "type" (Overpass renvoie du JSON INDENTE :
    ' "{" et "type" sont separes par des espaces/sauts de ligne -> ne pas inclure "{").
    Dim parts() As String: parts = Split(resp, """type""")
    Dim ub As Long: ub = UBound(parts)
    If ub < 1 Then Exit Sub
    Dim oLat() As Double, oLon() As Double, oBr() As String
    ReDim oLat(1 To ub): ReDim oLon(1 To ub): ReDim oBr(1 To ub)
    Dim reLat As Object: Set reLat = CreateObject("VBScript.RegExp")
    reLat.Pattern = """lat""\s*:\s*(-?\d+\.?\d*)"
    Dim reLon As Object: Set reLon = CreateObject("VBScript.RegExp")
    reLon.Pattern = """lon""\s*:\s*(-?\d+\.?\d*)"

    Dim m As Long: m = 0
    Dim k As Long
    For k = 1 To ub
        Dim blk As String: blk = parts(k)
        Dim la As Object: Set la = reLat.Execute(blk)
        Dim lo As Object: Set lo = reLon.Execute(blk)
        If la.Count > 0 And lo.Count > 0 Then
            Dim br As String: br = OsmBrand(blk)
            If br <> "" Then
                m = m + 1
                oLat(m) = CDbl(Replace(la(0).SubMatches(0), ".", DecSep()))
                oLon(m) = CDbl(Replace(lo(0).SubMatches(0), ".", DecSep()))
                oBr(m) = br
            End If
        End If
    Next k
    If m = 0 Then Exit Sub

    ' Appariement : noeud OSM le plus proche (<= 300 m, MetricDist en degres).
    For i = 1 To nb
        Dim best As Long, bestD As Double: best = 0: bestD = 1E+30
        For k = 1 To m
            Dim dd As Double: dd = MetricDist(res(i).lat, res(i).lon, oLat(k), oLon(k))
            If dd < bestD Then bestD = dd: best = k
        Next k
        If best > 0 And (bestD * 111320#) <= MATCH_M Then
            Dim norm As String, lbl As String
            norm = DetectEnseigne(oBr(best))
            If norm <> "" Then lbl = norm Else lbl = Trim$(oBr(best))
            If lbl <> "" Then res(i).name = ComposeName(lbl, res(i).ville)
        End If
    Next i
Done:
End Sub

' brand > name > operator depuis un bloc JSON d'element OSM.
Private Function OsmBrand(blk As String) As String
    OsmBrand = JsonStrVal(blk, "brand")
    If OsmBrand = "" Then OsmBrand = JsonStrVal(blk, "name")
    If OsmBrand = "" Then OsmBrand = JsonStrVal(blk, "operator")
End Function

' Valeur d'une cle chaine "key":"val" dans un fragment JSON.
Private Function JsonStrVal(blk As String, key As String) As String
    Dim re As Object: Set re = CreateObject("VBScript.RegExp")
    re.Pattern = """" & key & """\s*:\s*""([^""]*)"""
    Dim mm As Object: Set mm = re.Execute(blk)
    If mm.Count > 0 Then JsonStrVal = JsonUnescape(mm(0).SubMatches(0))
End Function

' Decode les echappements JSON usuels (\uXXXX, \/, \", \\) d'une chaine.
Private Function JsonUnescape(s As String) As String
    Dim x As String: x = s
    If InStr(x, "\u") > 0 Then
        Dim re As Object: Set re = CreateObject("VBScript.RegExp")
        re.Global = True: re.Pattern = "\\u([0-9a-fA-F]{4})"
        Dim m As Object: Set m = re.Execute(x)
        Dim i As Long
        For i = m.Count - 1 To 0 Step -1
            x = Left$(x, m(i).FirstIndex) & ChrW(CLng("&H" & m(i).SubMatches(0))) & _
                Mid$(x, m(i).FirstIndex + 7)
        Next i
    End If
    x = Replace(x, "\/", "/")
    x = Replace(x, "\""", """")
    x = Replace(x, "\\", "\")
    JsonUnescape = x
End Function

' Dossier des icones de marque (depot : excel\..\public\icons\brands\).
Private Function BrandsDir() As String
    BrandsDir = ThisWorkbook.Path & "\..\public\icons\brands\"
End Function

' Renvoie le data URI base64 du SVG d'un slug (repli generic). Cache module.
Private Function IconDataUri(slug As String) As String
    Dim sl As String: sl = slug
    If sl = "" Then sl = "generic"
    If g_iconCache Is Nothing Then Set g_iconCache = CreateObject("Scripting.Dictionary")
    If g_iconCache.Exists(sl) Then IconDataUri = g_iconCache(sl): Exit Function

    Dim b64 As String: b64 = FileToBase64(BrandsDir() & sl & ".svg")
    If b64 = "" And sl <> "generic" Then
        IconDataUri = IconDataUri("generic"): Exit Function
    End If
    Dim uri As String
    If b64 <> "" Then uri = "data:image/svg+xml;base64," & b64
    g_iconCache(sl) = uri
    IconDataUri = uri
End Function

' Lit un fichier binaire et l'encode en base64 (une seule ligne).
Private Function FileToBase64(path As String) As String
    On Error GoTo Fail
    Dim st As Object: Set st = CreateObject("ADODB.Stream")
    st.Type = 1: st.Open
    st.LoadFromFile path
    Dim bytes() As Byte: bytes = st.Read
    st.Close
    Dim dom As Object: Set dom = CreateObject("MSXML2.DOMDocument")
    Dim el As Object: Set el = dom.createElement("b64")
    el.DataType = "bin.base64"
    el.nodeTypedValue = bytes
    FileToBase64 = Replace(Replace(el.Text, vbCr, ""), vbLf, "")
    Exit Function
Fail:
    FileToBase64 = ""
End Function

' Construit le JS "var LOGOS={slug:'datauri',...};" pour les slugs d'un Dictionary.
Private Function LogosJs(slugs As Object) As String
    Dim js As String, ar As String, k As Variant, sep As String
    js = "var LOGOS={": ar = "var LOGOS_AR={"
    sep = ""
    ' generic toujours present (repli).
    Dim gu As String: gu = IconDataUri("generic")
    If gu <> "" Then
        js = js & "'generic':'" & gu & "'"
        ar = ar & "'generic':" & SvgAspectStr("generic")
        sep = ","
    End If
    For Each k In slugs.keys
        If CStr(k) <> "" And CStr(k) <> "generic" Then
            Dim u As String: u = IconDataUri(CStr(k))
            If u <> "" Then
                js = js & sep & "'" & CStr(k) & "':'" & u & "'"
                ar = ar & sep & "'" & CStr(k) & "':" & SvgAspectStr(CStr(k))
                sep = ","
            End If
        End If
    Next k
    js = js & "};"
    ar = ar & "};"
    ' LOGOS_AR : ratio largeur/hauteur du SVG -> StIconJs elargit la pastille
    ' pour les logos "wordmark" larges (sinon ecrases/illisibles a 38px).
    LogosJs = js & ar
End Function

' Ratio largeur/hauteur du SVG d'une enseigne, en chaine JS (point decimal).
Private Function SvgAspectStr(slug As String) As String
    SvgAspectStr = Replace(Format$(SvgAspect(slug), "0.###"), ",", ".")
End Function

' Lit le ratio largeur/hauteur du SVG (viewBox prioritaire, sinon width/height).
' Defaut 1 (carre) si illisible. Mis en cache par slug.
Private Function SvgAspect(slug As String) As Double
    On Error GoTo Fail
    SvgAspect = 1
    If g_arCache Is Nothing Then Set g_arCache = CreateObject("Scripting.Dictionary")
    If g_arCache.Exists(slug) Then SvgAspect = g_arCache(slug): Exit Function

    Dim txt As String: txt = ReadTextFile(BrandsDir() & slug & ".svg")
    If txt <> "" Then
        Dim w As Double, h As Double
        Dim re As Object: Set re = CreateObject("VBScript.RegExp")
        re.IgnoreCase = True
        re.Pattern = "viewBox\s*=\s*""\s*[-\d.]+\s+[-\d.]+\s+([\d.]+)\s+([\d.]+)"
        Dim m As Object: Set m = re.Execute(txt)
        If m.Count > 0 Then
            w = CDbl(Replace(m(0).SubMatches(0), ".", DecSep()))
            h = CDbl(Replace(m(0).SubMatches(1), ".", DecSep()))
        Else
            re.Pattern = "\bwidth\s*=\s*""([\d.]+)"
            Dim mw As Object: Set mw = re.Execute(txt)
            re.Pattern = "\bheight\s*=\s*""([\d.]+)"
            Dim mh As Object: Set mh = re.Execute(txt)
            If mw.Count > 0 And mh.Count > 0 Then
                w = CDbl(Replace(mw(0).SubMatches(0), ".", DecSep()))
                h = CDbl(Replace(mh(0).SubMatches(0), ".", DecSep()))
            End If
        End If
        If w > 0 And h > 0 Then SvgAspect = w / h
    End If
    g_arCache(slug) = SvgAspect
    Exit Function
Fail:
    SvgAspect = 1
End Function

' Lit un fichier texte (UTF-8) en chaine. "" si echec.
Private Function ReadTextFile(path As String) As String
    On Error GoTo Fail
    Dim st As Object: Set st = CreateObject("ADODB.Stream")
    st.Type = 2: st.Charset = "utf-8": st.Open
    st.LoadFromFile path
    ReadTextFile = st.ReadText
    st.Close
    Exit Function
Fail:
    ReadTextFile = ""
End Function

' RegExp test (insensible a la casse).
Private Function RegTest(s As String, pattern As String) As Boolean
    On Error GoTo Fail
    Dim re As Object: Set re = CreateObject("VBScript.RegExp")
    re.Global = False: re.IgnoreCase = True
    re.Pattern = pattern
    RegTest = re.Test(s)
    Exit Function
Fail:
    RegTest = False
End Function

' RegExp replace (global, insensible a la casse).
Private Function RegReplace(s As String, pattern As String, repl As String) As String
    On Error GoTo Fail
    Dim re As Object: Set re = CreateObject("VBScript.RegExp")
    re.Global = True: re.IgnoreCase = True
    re.Pattern = pattern
    RegReplace = re.Replace(s, repl)
    Exit Function
Fail:
    RegReplace = s
End Function


' ============================================================
'  GEOLOCALISATION AUTOMATIQUE (par IP, sans GPS)
' ============================================================

' Bouton "Me localiser" : geolocalise par IP et remplit Carte_Position.
Public Sub GeolocaliserAuto()
    On Error GoTo ErrH
    Dim lat As Double, lon As Double, ville As String
    If GeolocaliserIP(lat, lon, ville) Then
        On Error Resume Next
        ThisWorkbook.Names("Carte_Position").RefersToRange.Value = _
            Replace(Format$(lat, "0.######"), ",", ".") & ";" & _
            Replace(Format$(lon, "0.######"), ",", ".")
        On Error GoTo ErrH
        SetStatus "[Carte] " & ChrW(10003) & " Position detectee : " & ville & _
                  " (" & Format$(lat, "0.0000") & ";" & Format$(lon, "0.0000") & ")."
    Else
        SetStatus "[Carte] " & ChrW(9888) & " Geolocalisation IP indisponible. Saisissez 'Ma position' manuellement."
    End If
    Exit Sub
ErrH:
    SetStatus "[Carte] " & ChrW(9888) & " Erreur geolocalisation " & Err.Number & " : " & Err.Description
End Sub

' Geolocalisation approximative par IP (ip-api.com, gratuit, sans cle).
Private Function GeolocaliserIP(ByRef lat As Double, ByRef lon As Double, _
                                ByRef ville As String) As Boolean
    On Error GoTo Fail
    Dim url As String, resp As String
    url = "http://ip-api.com/json/?fields=status,lat,lon,city"

    Dim http As Object: Set http = CreateObject("WinHttp.WinHttpRequest.5.1")
    http.SetTimeouts 5000, 10000, 10000, 10000
    http.Open "GET", url, False
    http.Send
    If http.Status <> 200 Then GoTo Fail
    resp = http.ResponseText
    If InStr(resp, """status"":""success""") = 0 Then GoTo Fail

    Dim reLat As Object: Set reLat = CreateObject("VBScript.RegExp")
    reLat.Pattern = """lat""\s*:\s*(-?\d+\.?\d*)"
    Dim mLat As Object: Set mLat = reLat.Execute(resp)
    Dim reLon As Object: Set reLon = CreateObject("VBScript.RegExp")
    reLon.Pattern = """lon""\s*:\s*(-?\d+\.?\d*)"
    Dim mLon As Object: Set mLon = reLon.Execute(resp)
    If mLat.Count = 0 Or mLon.Count = 0 Then GoTo Fail

    lat = CDbl(Replace(mLat(0).SubMatches(0), ".", DecSep()))
    lon = CDbl(Replace(mLon(0).SubMatches(0), ".", DecSep()))

    Dim reC As Object: Set reC = CreateObject("VBScript.RegExp")
    reC.Pattern = """city""\s*:\s*""([^""]*)"""
    Dim mC As Object: Set mC = reC.Execute(resp)
    If mC.Count > 0 Then ville = mC(0).SubMatches(0)

    GeolocaliserIP = (lat <> 0 Or lon <> 0)
    Exit Function
Fail:
    GeolocaliserIP = False
End Function


Private Function Emo(ByVal cp As Long) As String
    If cp <= &HFFFF& Then
        Emo = ChrW(cp)
    Else
        Dim v As Long: v = cp - &H10000
        Emo = ChrW(&HD800& Or (v \ &H400&)) & ChrW(&HDC00& Or (v And &H3FF&))
    End If
End Function
