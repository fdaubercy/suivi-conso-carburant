Attribute VB_Name = "modSyncCfg"
' ============================================================
'  modSyncCfg - Config partagee sync GS (X44 P2)
' ============================================================
'  Constantes de configuration extraites de modSyncGS, rendues Public
'  pour modSyncGS + modSyncEngine. Les homonymes Private ailleurs
'  (modSuppression/modFuelPanel/modHistorique/modSyncParametres) restent locaux.
Option Explicit

Public Const GAS_URL     As String = "https://script.google.com/macros/s/AKfycbwIyCfZVTpDOGBANtFcHECcCdbg4J4t377pKQjIJ0NJYFT9FMjZm5_6XOsyQAas8jeTyA/exec"
Public Const APP_TOKEN   As String = "e85_a7f3c9e21b8d4f60a5c3e8b7d12f6049"
Public Const WS_NAME     As String = "GS_Pleins"
Public Const COL_SYNC_ID  As Integer = 15  ' O
Public Const COL_PHOTO    As Integer = 16  ' P  URL Drive photo ticket (importee depuis GS)
Public Const COL_MODIFIED As Integer = 17  ' Q  timestamp derniere modif locale (col interne, hors GS)
Public Const STATIONS_WS  As String = "Notes"
Public Const STATIONS_TBL As String = "tbl_stationEssence"
