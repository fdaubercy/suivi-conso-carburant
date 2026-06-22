# Règles VBA — Suivi Conso Carburants

> Extrait de `CLAUDE.md` (découpe du 2026-06-21). **À lire AVANT tout travail VBA / COM sur le classeur Excel.**
> Voir aussi les leçons VBA/COM accumulées dans `tasks/lessons.md` (encodage, `Attribute VB_Name`, déploiement `set-module`, ByRef, etc.).

- `Private Const`, `Dim`, `Type`, `Enum` au niveau module → **toujours dans la section de déclarations en tête de fichier**, avant la première `Sub`/`Function` (sinon erreur de compilation).
- Après chaque import de `.bas` → exécuter **Débogage → Compiler VBAProject** avant tout `Alt+F8`.
- Capacité requise : pouvoir modifier le VBA de fichiers Excel locaux même ouverts (skill `vba-agent` via COM/pywin32).
