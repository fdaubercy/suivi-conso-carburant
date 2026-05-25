' ============================================================
'  A COLLER dans le module "ThisWorkbook" du classeur Excel
'  (Double-clic sur "ThisWorkbook" dans l'explorateur VBA)
'  v2.4.0.0
' ============================================================

Private Sub Workbook_Open()
    ' 1. Restaure le format date francais (au cas ou Power Query l'a ecrase)
    ForceFormatDates

    ' 2. Synchronisation automatique avec Google Sheets
    '    Silencieuse si aucun changement, message si lignes ajoutees/envoyees
    SyncOnOpen
End Sub
