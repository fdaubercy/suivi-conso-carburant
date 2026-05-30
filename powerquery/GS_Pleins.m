// ═════════════════════════════════════════════════════════════════════════
//  Requête Power Query : GS_Pleins                              v4.3.0.4
//  Source de vérité de la requête M (miroir du classeur excel/*.xlsm).
//
//  Lit le CSV de l'onglet Google Sheets « _ImportGS » et alimente les
//  colonnes A→O de la table Excel « GS_Pleins ».
//
//  ┌─ À COLLER DANS EXCEL ───────────────────────────────────────────────┐
//  │ Données → Requêtes & connexions → clic droit sur « GS_Pleins »      │
//  │   → Modifier → Accueil → Éditeur avancé                              │
//  │   → tout effacer, coller ce code, Terminer, puis Actualiser.        │
//  └─────────────────────────────────────────────────────────────────────┘
//
//  ⚠️  COLONNES O et P — NE PAS LIER « Photo ticket »
//  Le schéma Google Sheet (_ImportGS) compte 16 colonnes A→P, dont :
//    • O = sync_id        → lue ici (clé de synchro bidirectionnelle)
//    • P = Photo ticket    (URL Drive)
//  Dans la table EXCEL « GS_Pleins », la colonne P est réservée au marqueur
//  VBA « Modifie_local » (modSyncGS / GS_Pleins_snippet, sync bidir.).
//  La requête lit donc les 16 colonnes du CSV mais N'EN CONSERVE QUE 15
//  (A→O) : « Photo ticket » est volontairement écartée pour ne pas écraser
//  « Modifie_local ». Ne jamais ajouter Column16 à la sélection.
//
//  HISTORIQUE DU FIX (v4.3.0.4) :
//  L'ancienne requête lisait Columns=15 et mappait encore Column7 → "PrixS98"
//  (colonne « Prix S98 jour » SUPPRIMÉE du GAS en v2.3.0.0). Toutes les
//  colonnes à partir de la 7 étaient donc décalées d'un cran (Station essence
//  recevait le véhicule, sync_id atterrissait dans « GPLc station »…).
//  Corrigé ici : PrixS98 retirée, lecture des 16 colonnes, mapping A→O exact.
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

    // Mapping A→O (Column16 « Photo ticket » laissée sans renommage, écartée
    // à l'étape suivante). PLUS de colonne « PrixS98 ».
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
        {"Column15", "sync_id"}
    }),

    // On ne conserve QUE les 15 colonnes A→O (Photo ticket exclue : col P
    // = Modifie_local côté Excel).
    Kept = Table.SelectColumns(Renamed, {
        "Horodatage", "Date", "Type", "Km", "Litres", "PrixL",
        "Station essence", "Vehicule",
        "E85 station", "SP98 station", "SP95 station", "E10 station",
        "Gazole station", "GPLc station", "sync_id"
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
        {"sync_id",         type text}
    }, "en-US")
in
    Typed
