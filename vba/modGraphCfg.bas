Attribute VB_Name = "modGraphCfg"
' ============================================================
'  modGraphCfg - Config partagee dashboard (X44 P3)
' ============================================================
'  Constantes (feuilles, cellules, couleurs, CO2, dims) extraites de
'  modGraphiques, Public pour modGraphData/modGraphRender/modGraphiques.
Option Explicit

Public Const WS_GRAPH  As String = "Tableau de bord"
Public Const FILTER_ALL As String = "(tous)"
Public Const PH_TABLE  As String = "PrixHistory"   ' X30/X35 : table Power Query _PrixHistory
Public Const WS_CARB  As String = "Suivi Carburant"
Public Const WS_DATA  As String = "_GraphData"
Public Const T2_NAME  As String = "Tableau2"
Public Const GS_SHEET As String = "GS_Pleins"
Public Const CO2_ESSENCE_PER_L As Double = 2.21    ' kg CO2/L SP95-E10
Public Const CO2_E85_PER_L     As Double = 1.105   ' E85 ? -50 %
Public Const DEFAULT_CO2_OBJ   As Double = 200     ' kg CO2/an
Public Const DEFAULT_SURCONSO  As Double = 0.2     ' +20 %
Public Const CELL_BUDGET     As String = "B2"
Public Const CELL_CO2OBJ     As String = "B3"
Public Const CELL_ANNEE      As String = "B4"   ' X24 : annee bilan (vide = recente)
Public Const CELL_GRAPH_AUTO As String = "B7"   ' X20 : "Oui"/"Non" ? recreer auto (defaut Oui si vide)
Public Const CELL_HORODATAGE As String = "B8"   ' X21 : horodatage derniere generation
Public Const C_E85    As Long = 7708189   ' vert        #1D9E75 (--green)
Public Const C_GAZOLE As Long = 8417899   ' gris ardoise #6B7280 (--text-muted)
Public Const C_SP98   As Long = 11957550  ' bleu        #2E75B6 (--blue-mid)
Public Const C_COUT   As Long = 6044187   ' bleu fonce  #1B3A5C (--blue-dark)
Public Const C_OBJ    As Long = 42480     ' ambre       #F0A500 (--amber)
Public Const C_CONSO  As Long = 11957550  ' bleu        #2E75B6
Public Const C_RED    As Long = 4869090   ' rouge       #E24B4A (--red)
Public Const C_HEADER As Long = 6044187   ' bleu fonce  #1B3A5C
Public Const C_KPI    As Long = 6044187
Public Const C_CARD   As Long = 16250098  ' fond carte  #F2F5F8 (clair)
Public Const TOP_BASE As Double = 150     ' decalage vertical des graphiques (bandeau + params)
Public Const CHART_W  As Double = 460
Public Const CHART_H  As Double = 250
Public Const CELL_PERDEB As String = "B9"
Public Const CELL_PERFIN As String = "B10"

' -- Etat module partage (X44 P3) : bornes de periode (serial date ; 0 = non borne).
'    Ecrit par modGraphiques.CreerGraphiquesWeb, lu par modGraphData (agregats).
Public mPerDeb As Double
Public mPerFin As Double
