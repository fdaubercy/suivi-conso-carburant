Attribute VB_Name = "modTests"
' ============================================================
'  modTests - Tests unitaires des fonctions pures VBA (X45)
' ============================================================
'  Verrouille les regressions de calcul (bug date 6 sept/9 juin de
'  v5.12.0.0, cout plein, cle carburant, conso L/100 km). Aucune
'  couverture VBA cote Vitest (JS seul) : ce module s'execute EN LOCAL
'  dans Excel (VBA ne tourne pas en CI headless).
'
'  Lancer : Alt+F8 -> RunAllTests  (resultat en barre d'etat + fenetre
'  Execution/Debug). Le module est versionne dans vba/ ; le job CI
'  check_vba_drift garantit sa presence et sa coherence avec le classeur.
'
'  Fonctions couvertes (rendues Public pour permettre le test) :
'    modDashboardKPI.FuelKeyK / FuelInSel / ConsoL100
'    modPrixStation.FuelKeyP
'    ModuleImportGS.ParseGoogleDate
'    modHistorique.CoutPlein
' ============================================================
Option Explicit

Private mPass As Long
Private mFail As Long
Private mLog As String

' Point d'entree : execute tous les tests, renvoie et affiche le bilan.
Public Function RunAllTests() As String
    mPass = 0: mFail = 0: mLog = ""

    Test_FuelKeyK
    Test_FuelInSel
    Test_FuelKeyP
    Test_ParseGoogleDate
    Test_CoutPlein
    Test_ConsoL100

    Dim total As Long: total = mPass + mFail
    Dim summary As String
    summary = "modTests : " & mPass & "/" & total & " OK"
    If mFail > 0 Then summary = summary & "  --  " & mFail & " ECHEC(S)"

    Debug.Print String(52, "=")
    Debug.Print mLog;
    Debug.Print summary
    On Error Resume Next
    Application.StatusBar = summary
    On Error GoTo 0
    RunAllTests = summary
End Function

' ---------- mini-framework d'assertions ----------
Private Sub Pass(ByVal nm As String)
    mPass = mPass + 1
    mLog = mLog & "  [OK]   " & nm & vbLf
End Sub

Private Sub Fail(ByVal nm As String, ByVal got As String, ByVal exp As String)
    mFail = mFail + 1
    mLog = mLog & "  [KO]   " & nm & " : obtenu=[" & got & "] attendu=[" & exp & "]" & vbLf
End Sub

Private Sub ChkS(ByVal nm As String, ByVal got As String, ByVal exp As String)
    If got = exp Then Pass nm Else Fail nm, got, exp
End Sub

Private Sub ChkB(ByVal nm As String, ByVal got As Boolean, ByVal exp As Boolean)
    If got = exp Then Pass nm Else Fail nm, CStr(got), CStr(exp)
End Sub

Private Sub ChkD(ByVal nm As String, ByVal got As Double, ByVal exp As Double)
    If Abs(got - exp) < 0.0001 Then Pass nm Else Fail nm, Format$(got, "0.####"), Format$(exp, "0.####")
End Sub

Private Sub ChkDate(ByVal nm As String, ByVal got As Date, ByVal exp As Date)
    If got = exp Then Pass nm Else Fail nm, Format$(got, "yyyy-mm-dd"), Format$(exp, "yyyy-mm-dd")
End Sub

' ---------- tests ----------
Private Sub Test_FuelKeyK()
    ChkS "FuelKeyK E85", modDashboardKPI.FuelKeyK("Superethanol E85"), "E85"
    ChkS "FuelKeyK ethanol", modDashboardKPI.FuelKeyK("ethanol"), "E85"
    ChkS "FuelKeyK gazole", modDashboardKPI.FuelKeyK("Gazole"), "GAZOLE"
    ChkS "FuelKeyK diesel", modDashboardKPI.FuelKeyK("Diesel B7"), "GAZOLE"
    ChkS "FuelKeyK SP98", modDashboardKPI.FuelKeyK("SP98"), "SP98"
    ChkS "FuelKeyK SP95", modDashboardKPI.FuelKeyK("SP95"), "SP95"
    ChkS "FuelKeyK E10 -> SP95", modDashboardKPI.FuelKeyK("E10"), "SP95"
    ChkS "FuelKeyK GPL", modDashboardKPI.FuelKeyK("GPL"), "GPL"
End Sub

Private Sub Test_FuelInSel()
    ChkB "FuelInSel (tous)", modDashboardKPI.FuelInSel("E85", "(tous)"), True
    ChkB "FuelInSel vide", modDashboardKPI.FuelInSel("E85", ""), True
    ChkB "FuelInSel simple ok", modDashboardKPI.FuelInSel("E85", "E85"), True
    ChkB "FuelInSel simple non", modDashboardKPI.FuelInSel("SP98", "E85"), False
    ChkB "FuelInSel liste ok", modDashboardKPI.FuelInSel("SP95", "E85, SP95"), True
    ChkB "FuelInSel liste non", modDashboardKPI.FuelInSel("GAZOLE", "E85, SP95"), False
End Sub

Private Sub Test_FuelKeyP()
    ChkS "FuelKeyP E85", modPrixStation.FuelKeyP("E85"), "E85"
    ChkS "FuelKeyP gazole", modPrixStation.FuelKeyP("Gazole"), "GAZOLE"
    ChkS "FuelKeyP SP98", modPrixStation.FuelKeyP("SP98"), "SP98"
    ChkS "FuelKeyP E10 avant SP95", modPrixStation.FuelKeyP("SP95-E10"), "E10"
    ChkS "FuelKeyP SP95", modPrixStation.FuelKeyP("SP95"), "SP95"
    ChkS "FuelKeyP GPLc", modPrixStation.FuelKeyP("GPL"), "GPLc"
End Sub

Private Sub Test_ParseGoogleDate()
    ChkDate "PGD ISO", ModuleImportGS.ParseGoogleDate("2026-05-24"), DateSerial(2026, 5, 24)
    ChkDate "PGD ISO+heure", ModuleImportGS.ParseGoogleDate("2026-05-24T00:00:00"), DateSerial(2026, 5, 24)
    ChkDate "PGD US m/j/a", ModuleImportGS.ParseGoogleDate("5/22/2026"), DateSerial(2026, 5, 22)
    ChkDate "PGD FR j/m/a (jour>12)", ModuleImportGS.ParseGoogleDate("24/05/2026"), DateSerial(2026, 5, 24)
    ChkDate "PGD vide -> 1900", ModuleImportGS.ParseGoogleDate(""), DateSerial(1900, 1, 1)
End Sub

Private Sub Test_CoutPlein()
    ChkD "CoutPlein litres*prix", CDbl(modHistorique.CoutPlein(40, 0.85)), 34#
    ChkD "CoutPlein cout saisi prioritaire", CDbl(modHistorique.CoutPlein(40, 0.85, 30)), 30#
    ChkD "CoutPlein cout<=0 -> l*p", CDbl(modHistorique.CoutPlein(40, 0.85, 0)), 34#
    ChkS "CoutPlein non numerique -> vide", CStr(modHistorique.CoutPlein("x", "y")), ""
End Sub

Private Sub Test_ConsoL100()
    ChkD "ConsoL100 40L/500km", modDashboardKPI.ConsoL100(40, 500), 8#
    ChkD "ConsoL100 45L/600km", modDashboardKPI.ConsoL100(45, 600), 7.5
    ChkD "ConsoL100 dist=0 -> 0", modDashboardKPI.ConsoL100(40, 0), 0#
End Sub
