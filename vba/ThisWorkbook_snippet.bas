Option Explicit

' ============================================================
'  A COLLER dans le module "ThisWorkbook" du classeur Excel
'  (Double-clic sur "ThisWorkbook" dans l'explorateur VBA)
'  v2.5.0.0
'  (Ne PAS importer ce fichier : il remplacerait le module ThisWorkbook.
'   Copier/coller uniquement le contenu de Workbook_Open ci-dessous.)
' ============================================================

Private Sub Workbook_Open()
     ' Appel l'affichage en mode plein écrn et en paramètre un raccourci clavier
     Call ActiverPleinEcran
     Application.OnKey "^{F11}", "BasculerPleinEcran"   ' Ctrl+F11 pour basculer
     
     ' Léger délai pour laisser Excel s'initialiser complètement
     Application.OnTime now + TimeValue("00:00:03"), "ImporterNouveauxPleinsAuto"
     
    ' 1. Restaure le format date francais (au cas ou Power Query l'a ecrase)
    ForceFormatDates

    ' 2. Synchronisation automatique avec Google Sheets
    '    Silencieuse si aucun changement, message si lignes ajoutees/envoyees
    SyncOnOpen
    
     ' Protège contre la saisie manuelle MAIS laisse le VBA écrire (recalc + sync).
     ' A re-poser a chaque ouverture : UserInterfaceOnly n'est pas memorise.
     ThisWorkbook.Sheets("Suivi Carburant").Protect _
         Password:="", _
         UserInterfaceOnly:=True, _
         DrawingObjects:=False, Contents:=True, Scenarios:=False, _
         AllowFormattingColumns:=True
     ThisWorkbook.Sheets("Suivi Carburant").Columns("Z").Hidden = True   ' Zone technique (Z1 import, Z2) masquee
     ThisWorkbook.Sheets("Suivi Carburant").Columns("AA").Hidden = True   ' Zone technique AA masquée

    ' 3. Vue de depart (Accueil / Saisie / derniere vue) selon la feuille Reglages
    '    Tolerant : si modWorkbook n'est pas encore importe, l'ouverture continue.
    On Error Resume Next
    AfficherVueDeDepart
    On Error GoTo 0
End Sub

Private Sub Workbook_BeforeClose(Cancel As Boolean)
    Call DesactiverPleinEcran   ' Restaure l'interface à la fermeture
End Sub

