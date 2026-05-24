' ============================================================
'  A COLLER dans le module "ThisWorkbook" du classeur Excel
'  (Double-clic sur "ThisWorkbook" dans l'explorateur VBA)
' ============================================================

Private Sub Workbook_Open()
    ' Synchronisation automatique au demarrage
    ' Silencieuse si aucun changement, message si +/- de lignes
    SyncOnOpen
End Sub
