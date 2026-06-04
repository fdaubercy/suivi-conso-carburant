// ═════════════════════════════════════════════════════════════════════════
//  Requête Power Query : PrixHistory                            v4.18.0.0
//  Source de vérité des PRIX MARCHÉ (miroir du classeur excel/*.xlsm).
//
//  Lit le CSV de l'onglet Google Sheets « _PrixHistory » (relevé quotidien
//  ~7h alimenté par RefreshPrix.gs → refreshPrixCarburants) et alimente la
//  table Excel « PrixHistory » (4 colonnes).
//
//  W61 (v4.18.0.0) : _PrixHistory suit désormais 6 carburants (ajout SP95,
//  E10, GPLc). AUCUNE modification de cette requête n'est requise — elle
//  recopie les 4 colonnes telles quelles ; il suffit d'« Actualiser tout »
//  (Données → Actualiser tout) pour voir les nouveaux carburants côté Excel.
//
//  ┌─ À COLLER DANS EXCEL (une seule fois) ──────────────────────────────┐
//  │ Données → Obtenir des données → À partir d'autres sources →         │
//  │   Requête vide → Éditeur avancé → coller ce code → Terminer.        │
//  │ Renommer la requête « PrixHistory ».                                 │
//  │ Accueil → Fermer et charger dans… → Tableau, nouvelle feuille       │
//  │   (la feuille peut être masquée ; le nom du TABLEAU doit rester      │
//  │    « PrixHistory » — c'est lui que le VBA recherche).               │
//  └─────────────────────────────────────────────────────────────────────┘
//
//  ┌─ STRUCTURE _PrixHistory (RefreshPrix.gs → getOrCreatePrixHistorySheet) ┐
//  │  A  Station   (« Enseigne - Ville » ou « Secteur - Ville »)          │
//  │  B  Date      (texte ISO yyyy-MM-dd écrit par Utilities.formatDate)  │
//  │  C  Type      (E85/GAZOLE/SP98/SP95/E10/GPLc)                        │
//  │  D  Prix €/L  (nombre)                                               │
//  └─────────────────────────────────────────────────────────────────────┘
//
//  Consommée par (côté Excel) :
//   • modGraphiques.BuildAggregates  → graphique gPrice (évolution du prix)
//   • modPrixStation.MAJ_PrixParStation → feuille « Prix pr station »
//
//  Endpoint gviz (cible l'onglet par son NOM, comme powerquery/GS_Pleins.m).
// ═════════════════════════════════════════════════════════════════════════
let
    SHEET_ID = "1uN170kt_n45sBRwqs2krTYfhapU3dMKjTguD-qSUqCE",

    // gviz cible l'onglet par son nom (robuste, même si l'onglet est masqué).
    URL = "https://docs.google.com/spreadsheets/d/" & SHEET_ID
          & "/gviz/tq?tqx=out:csv&sheet=_PrixHistory",

    Source = Csv.Document(
        Web.Contents(URL),
        [Delimiter=",", Columns=4, Encoding=65001, QuoteStyle=QuoteStyle.Csv]
    ),

    SkipHeader = Table.Skip(Source, 1),

    Renamed = Table.RenameColumns(SkipHeader, {
        {"Column1", "Station"},
        {"Column2", "Date"},
        {"Column3", "Type"},
        {"Column4", "Prix"}
    }),

    Typed = Table.TransformColumnTypes(Renamed, {
        {"Station", type text},
        {"Type",    type text},
        {"Prix",    type number}
    }, "en-US"),

    // Date : RefreshPrix.gs écrit un TEXTE ISO « yyyy-MM-dd ».
    // On le convertit en VRAIE DATE (les 10 premiers caractères) pour le tri
    // chronologique et l'affichage JJ/MM/AAAA côté graphique.
    DateParsed = Table.TransformColumns(Typed, {
        {"Date", each try Date.FromText(Text.Start(Text.From(_), 10)) otherwise null, type date}
    }),

    // Lignes valides uniquement (date + prix > 0).
    Cleaned = Table.SelectRows(DateParsed, each [Date] <> null and [Prix] <> null and [Prix] > 0),

    // Tri chronologique ASCENDANT puis par carburant.
    Sorted = Table.Sort(Cleaned, {{"Date", Order.Ascending}, {"Type", Order.Ascending}})
in
    Sorted
