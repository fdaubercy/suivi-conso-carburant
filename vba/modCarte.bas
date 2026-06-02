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
End Type
Private g_st() As StAvg
Private g_n    As Long

' Position utilisateur (resolue depuis la cellule Carte_Position avant rendu)
Private g_userHas As Boolean
Private g_userLat As Double
Private g_userLon As Double


' ════════════════════════════════════════════════════════════
'  CONSTRUCTION DE LA FEUILLE
' ════════════════════════════════════════════════════════════
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

    ' Boutons
    Dim L As Single: L = ws.Cells(3, 8).Left
    Dim T As Single: T = ws.Cells(3, 8).Top
    AddButton ws, "btnCarte1", L, T, "Ouvrir la carte (navigateur)", "OuvrirCarteNavigateur", RGB(217, 119, 6)
    AddButton ws, "btnCarte2", L, T + 30, "Geocoder + Actualiser", "RafraichirCarte", RGB(46, 117, 182)
    AddButton ws, "btnCarte3", L, T + 60, "Accueil", "NavAccueil", RGB(75, 85, 99)

    RafraichirCarte

    ws.Range("B1").Select
    GoTo Done
ErrH:
    SetStatus "[Carte] " & ChrW(9888) & " Erreur " & Err.Number & " : " & Err.Description
Done:
    Application.ScreenUpdating = True
End Sub


' ════════════════════════════════════════════════════════════
'  RAFRAICHISSEMENT (prix moyens + geocodage + tableau)
' ════════════════════════════════════════════════════════════
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


' Vide le cache _StationCoords puis re-geocode tout (apres correction de logique
' ou pour forcer une resolution propre des homonymes).
Public Sub ReinitialiserCoords()
    Dim ws As Worksheet: Set ws = CoordsSheet()
    Dim last As Long: last = ws.Cells(ws.Rows.Count, 1).End(xlUp).Row
    If last >= 2 Then ws.Range("A2:D" & last).ClearContents
    SetStatus "[Carte] Cache coordonnees vide -> re-geocodage..."
    RafraichirCarte
End Sub


' ════════════════════════════════════════════════════════════
'  OUVERTURE DE LA CARTE OSM DANS LE NAVIGATEUR
' ════════════════════════════════════════════════════════════
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


' ════════════════════════════════════════════════════════════
'  DIAGNOSTIC (a lancer si le geocodage ne ramene rien)
' ════════════════════════════════════════════════════════════
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


' ════════════════════════════════════════════════════════════
'  DONNEES : prix moyens + coordonnees
' ════════════════════════════════════════════════════════════

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


' ════════════════════════════════════════════════════════════
'  TABLEAU PRIX MOYENS
' ════════════════════════════════════════════════════════════
Private Sub RenderTable(ws As Worksheet)
    ws.Range("B5:F100000").Clear

    ws.Cells(5, 2).Value = "Stations " & CurrentFuelShort() & " habituelles"
    ws.Cells(5, 2).Font.Bold = True: ws.Cells(5, 2).Font.Color = RGB(27, 58, 92)

    Dim hdr As Variant: hdr = Array("Station", "Prix moyen", "Pleins", "Coord.", "")
    Dim c As Long
    For c = 0 To 3
        With ws.Cells(6, 2 + c)
            .Value = hdr(c)
            .Font.Bold = True: .Font.Color = vbWhite
            .Interior.Color = RGB(217, 119, 6)
            .HorizontalAlignment = xlCenter
        End With
    Next c

    If g_n = 0 Then
        ws.Cells(7, 2).Value = "Aucun plein " & CurrentFuelShort() & " enregistre."
        Exit Sub
    End If

    Dim minAvg As Double: minAvg = g_st(1).avg     ' g_st trie par prix
    Dim i As Long, rr As Long
    For i = 1 To g_n
        rr = 6 + i
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


' ════════════════════════════════════════════════════════════
'  GENERATION HTML DE LA CARTE (Leaflet via CDN)
'  Carte interactive OSM (pan/zoom) + marqueurs prix. Necessite Internet.
' ════════════════════════════════════════════════════════════
Private Function GenererHtmlCarte(titre As String) As String
    ' Points geolocalises -> tableau JS [lat, lon, "nom", "prix"]
    Dim pts As String, i As Long, n As Long
    For i = 1 To g_n
        If g_st(i).hasCoord Then
            If pts <> "" Then pts = pts & ","
            pts = pts & "[" & JsNum(g_st(i).lat) & "," & JsNum(g_st(i).lon) & ",""" & _
                  EscJs(g_st(i).name) & """,""" & PrixStr(g_st(i).avg) & """]"
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

    GenererHtmlCarte = "<!doctype html><html><head><meta charset='utf-8'>" & _
        "<meta name='viewport' content='width=device-width,initial-scale=1'>" & _
        "<title>Carte " & EscHtml(titre) & "</title>" & _
        "<link rel='stylesheet' href='https://unpkg.com/leaflet@1.9.4/dist/leaflet.css'>" & _
        "<script src='https://unpkg.com/leaflet@1.9.4/dist/leaflet.js'></script>" & _
        "<style>html,body{margin:0;height:100%}#map{height:100%}" & _
        ".ttl{position:absolute;z-index:1000;top:8px;left:54px;background:#1B3A5C;color:#fff;" & _
        "padding:6px 12px;border-radius:8px;font:700 14px Segoe UI,Arial}" & _
        ".pr{background:#1B3A5C;color:#fff;border:0;border-radius:8px;font-weight:700;padding:2px 6px}" & _
        ".pr:before{display:none}" & _
        ".me{width:18px;height:18px;background:#2A7FFF;border:3px solid #fff;border-radius:50%;" & _
        "box-shadow:0 0 0 rgba(42,127,255,.5);animation:mepulse 2s infinite}" & _
        "@keyframes mepulse{0%{box-shadow:0 0 0 0 rgba(42,127,255,.5)}" & _
        "70%{box-shadow:0 0 0 16px rgba(42,127,255,0)}100%{box-shadow:0 0 0 0 rgba(42,127,255,0)}}" & _
        "</style></head>" & _
        "<body><div class='ttl'>" & Emo(&H26FD&) & " Stations " & EscHtml(titre) & " - prix moyens</div>" & _
        "<div id='map'></div><script>" & _
        "var pts=[" & pts & "];" & _
        "var map=L.map('map');" & _
        "L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png'," & _
        "{maxZoom:19,attribution:'&copy; OpenStreetMap'}).addTo(map);" & _
        "var meIcon=L.divIcon({className:'me',iconSize:[18,18],iconAnchor:[9,9]});" & _
        "var b=[];pts.forEach(function(p){" & _
        "var mk=L.marker([p[0],p[1]]).addTo(map);" & _
        "mk.bindTooltip(p[3]+' EUR/L',{permanent:true,direction:'top',className:'pr',offset:[0,-6]});" & _
        "mk.bindPopup('<b>'+p[2]+'</b><br>'+p[3]+' EUR/L<br>'+" & _
        "'<a href=""https://www.google.com/maps/dir/?api=1&destination='+p[0]+','+p[1]+'"" target=""_blank"">Google Maps</a> &middot; '+" & _
        "'<a href=""https://waze.com/ul?ll='+p[0]+','+p[1]+'&navigate=yes"" target=""_blank"">Waze</a>');" & _
        "b.push([p[0],p[1]]);});" & _
        "if(b.length===1){map.setView(b[0],13);}else{map.fitBounds(b,{padding:[60,60]});}" & _
        ujs & _
        "</script></body></html>"
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


' ════════════════════════════════════════════════════════════
'  GEOCODAGE (API gouv. v2.1)
' ════════════════════════════════════════════════════════════

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
    If s = "" Then Exit Function

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


' ════════════════════════════════════════════════════════════
'  CACHE COORDONNEES (_StationCoords)
' ════════════════════════════════════════════════════════════
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


' ════════════════════════════════════════════════════════════
'  HELPERS
' ════════════════════════════════════════════════════════════

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

Private Function Emo(ByVal cp As Long) As String
    If cp <= &HFFFF& Then
        Emo = ChrW(cp)
    Else
        Dim v As Long: v = cp - &H10000
        Emo = ChrW(&HD800& Or (v \ &H400&)) & ChrW(&HDC00& Or (v And &H3FF&))
    End If
End Function
