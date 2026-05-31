// ═════════════════════════════════════════════════════════════════════════
//  Requête Power Query : GS_Pleins                              v4.3.0.7
//  Source de vérité de la requête M (miroir du classeur excel/*.xlsm).
//
//  Lit le CSV de l'onglet Google Sheets « _ImportGS » et alimente les
//  colonnes A→P de la table Excel « GS_Pleins » (16 colonnes = miroir exact
//  du schéma GAS courant, Photo ticket comprise).
//
//  ┌─ À COLLER DANS EXCEL ───────────────────────────────────────────────┐
//  │ Données → Requêtes & connexions → clic droit sur « GS_Pleins »      │
//  │   → Modifier → Accueil → Éditeur avancé                              │
//  │   → tout effacer, coller ce code, Terminer, puis Actualiser.        │
//  └─────────────────────────────────────────────────────────────────────┘
//
//  ┌─ DISPOSITION DES COLONNES (v4.3.0.5) ───────────────────────────────┐
//  │  A→N  données (Horodatage … GPLc station)        ← Power Query      │
//  │  O    sync_id                                     ← Power Query+VBA  │
//  │  P    Photo ticket  (URL Drive)                   ← Power Query      │
//  │  Q    Modifie_local (dirty-flag synchro bidir.)   ← VBA SEUL         │
//  └─────────────────────────────────────────────────────────────────────┘
//  ⚠️ La requête lie désormais 16 colonnes (A→P). Le marqueur VBA
//  « Modifie_local » a été DÉPLACÉ en col Q (17) — voir modSyncGS.bas /
//  GS_Pleins_snippet.bas (COL_MODIFIED = 17, COL_PHOTO = 16). Ne PAS lier
//  une 17ᵉ colonne ici : la col Q reste gérée par le VBA.
//
//  HISTORIQUE :
//  • v4.3.0.4 : retrait de l'ancienne colonne « PrixS98 » (supprimée du GAS
//    en v2.3.0.0) qui décalait tout le mapping à partir de la col 7.
//  • v4.3.0.5 : ajout de la colonne « Photo ticket » (col P du Sheet),
//    importée dans la col P du classeur ; Modifie_local déplacé en col Q.
//  • v4.3.0.6 : tri chronologique ascendant par Date (parsing culture en-US,
//    car le CSV gviz est en M/d/yyyy et non trié).
//  • v4.3.0.7 : Date convertie en VRAIE DATE (au lieu de texte) -> affichage
//    JJ/MM/AAAA dans Tableau2 ; tri direct sur la date (colonne _tri retirée).
//
//  Endpoint gviz (cible l'onglet par son NOM, comme vba/ModuleImportGS.bas).
// ═════════════════════════════════════════════════════════════════════════
let
    SHEET_ID = "1uN170kt_n45sBRwqs2krTYfhapU3dMKjTguD-qSUqCE",

    // gviz cible l'onglet par son nom (robuste, même si l'onglet est masqué).
    URL = "https://docs.google.com/spreadsheets/d/" & SHEET_ID
          & "/gviz/tq?tqx=out:csv&sheet=_ImportGS",

    // Le schéma GAS courant fait 16 colonnes (A→P).
    Source = Csv.Document(
        Web.Contents(URL),
        [Delimiter=",", Columns=16, Encoding=65001, QuoteStyle=QuoteStyle.Csv]
    ),

    SkipHeader = Table.Skip(Source, 1),

    // Mapping A→P exact. PLUS de colonne « PrixS98 ».
    Renamed = Table.RenameColumns(SkipHeader, {
        {"Column1",  "Horodatage"},
        {"Column2",  "Date"},
        {"Column3",  "Type"},
        {"Column4",  "Km"},
        {"Column5",  "Litres"},
        {"Column6",  "PrixL"},
        {"Column7",  "Station essence"},
        {"Column8",  "Vehicule"},
        {"Column9",  "E85 station"},
        {"Column10", "SP98 station"},
        {"Column11", "SP95 station"},
        {"Column12", "E10 station"},
        {"Column13", "Gazole station"},
        {"Column14", "GPLc station"},
        {"Column15", "sync_id"},
        {"Column16", "Photo ticket"}
    }),

    // 16 colonnes A→P (la col Q « Modifie_local » reste hors requête).
    Kept = Table.SelectColumns(Renamed, {
        "Horodatage", "Date", "Type", "Km", "Litres", "PrixL",
        "Station essence", "Vehicule",
        "E85 station", "SP98 station", "SP95 station", "E10 station",
        "Gazole station", "GPLc station", "sync_id", "Photo ticket"
    }),

    Typed = Table.TransformColumnTypes(Kept, {
        {"Horodatage",      type text},
        {"Date",            type text},
        {"Type",            type text},
        {"Km",              type number},
        {"Litres",          type number},
        {"PrixL",           type number},
        {"Station essence", type text},
        {"Vehicule",        type text},
        {"E85 station",     type number},
        {"SP98 station",    type number},
        {"SP95 station",    type number},
        {"E10 station",     type number},
        {"Gazole station",  type number},
        {"GPLc station",    type number},
        {"sync_id",         type text},
        {"Photo ticket",    type text}
    }, "en-US"),

    // Date : le CSV gviz renvoie un TEXTE au format US « M/d/yyyy h:mm:ss ».
    // On le convertit en VRAIE DATE (sans heure, culture en-US) pour que :
    //   • la vue Tableau2 (« Suivi Carburant »), qui tire GS_Pleins[Date] par
    //     INDEX, affiche bien JJ/MM/AAAA (le format dd/mm/yyyy ne s'applique
    //     qu'à une date, jamais à du texte) ;
    //   • le tri chronologique soit numérique (un tri texte serait faux,
    //     ex. « 10/1/2025 » < « 5/22/2026 »).
    DateParsed = Table.TransformColumns(Typed, {
        {"Date", each try Date.From(DateTime.From(_, "en-US")) otherwise null, type date}
    }),

    // Tri chronologique ASCENDANT (v4.3.0.6) sur la vraie date.
    Sorted = Table.Sort(DateParsed, {{"Date", Order.Ascending}})
in
    Sorted
