#!/usr/bin/env python3
"""
check_vba_compile.py -- X40
Lint statique des modules VBA du repo (vba/*.bas, .cls, .frm a la racine) pour
detecter deux classes de bugs "compile-on-demand" invisibles hors clic reel :

  (a) Const/Dim/Type/Enum au niveau MODULE declares APRES la 1ere procedure
      (Sub/Function/Property) du fichier -> VBA les compile "a la demande" et
      peut lever "Variable non definie" au premier appel reel.
  (b) Call / .OnAction / Application.OnTime / Run(...) vers une procedure
      INEXISTANTE dans l'ensemble des modules du repo (typiquement un module
      supprime/renomme dont les references n'ont pas ete nettoyees).

Exit 0 = aucune violation, Exit 1 = violation(s) detectee(s), Exit 2 = erreur
(dossier vba/ introuvable, etc.).

Usage:
    python scripts/check_vba_compile.py

Aucun argument : scanne toujours vba/*.bas (+ .cls/.frm a la racine de vba/)
du repo courant. Stdlib Python uniquement (pas de dependance externe).
"""
import sys
import re
from pathlib import Path


SNIPPETS_SUFFIX = ('_snippet', '_tmp', 'synchronisegoogleform')

# Declaration de procedure au niveau module (Sub/Function/Property Get|Let|Set)
PROC_DECL = re.compile(
    r'^(Public\s+|Private\s+|Friend\s+)?'
    r'(Sub|Function|Property\s+(Get|Let|Set))\s+(\w+)',
    re.IGNORECASE,
)
# Fin de procedure
PROC_END = re.compile(
    r'^End\s+(Sub|Function|Property)\b',
    re.IGNORECASE,
)
# Declaration Const/Dim/Type/Enum au niveau module
MODULE_DECL = re.compile(
    r'^(Public\s+|Private\s+|Global\s+)?(Const|Dim|Type|Enum)\s+(\w+)',
    re.IGNORECASE,
)
TYPE_END = re.compile(r'^End\s+(Type|Enum)\b', re.IGNORECASE)

# Motifs d'appel de procedure a verifier (check b)
CALL_PATTERNS = [
    re.compile(r'\bCall\s+(\w+)', re.IGNORECASE),
    re.compile(r'\.OnAction\s*=\s*"([^"]+)"', re.IGNORECASE),
    re.compile(r'Application\.OnTime\s+[^,]+,\s*"([^"]+)"', re.IGNORECASE),
    re.compile(r'Application\.Run\s*\(?\s*"([^"]+)"', re.IGNORECASE),
    re.compile(r'(?<!Application\.)\bRun\s*\(\s*"([^"]+)"', re.IGNORECASE),
]


def strip_comment(line: str) -> str:
    """Heuristique simple : supprime tout ce qui suit un ' de commentaire.

    Ne gere pas parfaitement le cas d'une apostrophe a l'interieur d'une
    chaine litterale contenant elle-meme un ' isole (rare en VBA car les
    guillemets doublent la quote a l'interieur d'une chaine, "" et non ').
    Heuristique jugee suffisante pour ce lint : on ignore ce cas limite.
    """
    in_string = False
    for i, ch in enumerate(line):
        if ch == '"':
            in_string = not in_string
        elif ch == "'" and not in_string:
            return line[:i]
    return line


def load_vba_files(vba_dir: Path):
    """Charge vba/*.bas (+ .cls/.frm a la racine), en ignorant les snippets."""
    files = []
    for pattern in ('*.bas', '*.cls', '*.frm'):
        for f in sorted(vba_dir.glob(pattern)):
            key = f.stem.lower()
            if any(key.endswith(s) for s in SNIPPETS_SUFFIX):
                continue
            files.append(f)
    return files


def read_lines(path: Path):
    try:
        code = path.read_text(encoding='utf-8', errors='replace')
    except OSError as e:
        print(f"  [WARN] Impossible de lire {path.name}: {e}")
        return None
    return code.replace('\r\n', '\n').replace('\r', '\n').split('\n')


def collect_known_procedures(files):
    """Construit l'ensemble (en minuscules) de tous les noms de procedures
    declarees dans tous les fichiers vba fournis."""
    known = set()
    per_file_procs = {}
    for f in files:
        lines = read_lines(f)
        if lines is None:
            continue
        names = []
        for raw in lines:
            line = strip_comment(raw).strip()
            m = PROC_DECL.match(line)
            if m:
                name = m.group(4)
                names.append(name)
                known.add(name.lower())
        per_file_procs[f] = names
    return known, per_file_procs


def check_module_decl_order(f: Path, lines):
    """Check (a): Const/Dim/Type/Enum au niveau module apres la 1ere procedure."""
    violations = []
    first_proc_line = None
    in_proc_depth = 0     # >0 si on est a l'interieur d'une Sub/Function/Property
    in_type_block = False  # a l'interieur d'un bloc Type...End Type / Enum...End Enum

    for idx, raw in enumerate(lines, start=1):
        line = strip_comment(raw).strip()
        if not line:
            continue

        # Suivi des blocs Type/Enum (uniquement pertinent hors procedure)
        if in_proc_depth == 0:
            if TYPE_END.match(line):
                in_type_block = False
                continue
            if in_type_block:
                # ligne de champ interne a Type...End Type : ignorer
                continue

        # Suivi de profondeur de procedure
        if PROC_END.match(line):
            if in_proc_depth > 0:
                in_proc_depth -= 1
            continue

        proc_match = PROC_DECL.match(line)
        if proc_match:
            if first_proc_line is None:
                first_proc_line = idx
            in_proc_depth += 1
            continue

        if in_proc_depth > 0:
            # Declaration locale a l'interieur d'une procedure : legitime.
            continue

        # Ici : niveau module, hors procedure.
        decl_match = MODULE_DECL.match(line)
        if decl_match:
            keyword = decl_match.group(2)
            if keyword.lower() in ('type', 'enum'):
                in_type_block = True
            if first_proc_line is not None and idx > first_proc_line:
                violations.append((
                    idx,
                    raw.strip(),
                    f"declaration '{keyword}' au niveau module APRES la 1ere "
                    f"procedure (ligne {first_proc_line}) -- risque "
                    f"'Variable non definie' en compile-on-demand",
                ))

    return violations


def extract_call_name(raw_name: str) -> str:
    """Extrait le nom de procedure final d'une reference qualifiee :
      - qualification classeur  : 'Classeur.xlsm'!MaProcedure -> MaProcedure
      - qualification module    : modSidebar.NavSidebar_0      -> NavSidebar_0
    VBA accepte les deux formes dans .OnAction/OnTime/Run ; on ne verifie que
    le nom terminal (un nom de procedure nu ne contient jamais '.' ni '!')."""
    name = raw_name
    if '!' in name:
        name = name.rsplit('!', 1)[-1]
    if '.' in name:
        name = name.rsplit('.', 1)[-1]
    return name


def check_calls_exist(f: Path, lines, known_procs: set):
    """Check (b): Call/OnAction/OnTime/Run vers une procedure inexistante."""
    violations = []
    for idx, raw in enumerate(lines, start=1):
        line = strip_comment(raw)
        if not line.strip():
            continue
        for pattern in CALL_PATTERNS:
            for m in pattern.finditer(line):
                # Cible construite dynamiquement (ex. "modSidebar.NavSidebar_" & k) :
                # le suffixe reel est calcule a l'execution -> invérifiable en
                # statique, on l'ignore (les handlers NavSidebar_0..N existent bien).
                if line[m.end():].lstrip().startswith('&'):
                    continue
                target_raw = m.group(1)
                target = extract_call_name(target_raw)
                if not target:
                    continue
                if target.lower() not in known_procs:
                    violations.append((
                        idx,
                        raw.strip(),
                        f"reference vers la procedure '{target}' introuvable "
                        f"dans vba/*.bas|.cls|.frm (module supprime/renomme ?)",
                    ))
    return violations


def main():
    repo_root = Path(__file__).resolve().parent.parent
    vba_dir = repo_root / 'vba'

    if not vba_dir.is_dir():
        print(f"ERREUR: dossier introuvable : {vba_dir}")
        sys.exit(2)

    print(f"check-vba-compile: {vba_dir}")

    files = load_vba_files(vba_dir)
    if not files:
        print("  [WARN] Aucun fichier .bas/.cls/.frm trouve a la racine de vba/.")
        sys.exit(2)

    known_procs, _ = collect_known_procedures(files)

    total_violations = 0

    for f in files:
        lines = read_lines(f)
        if lines is None:
            continue

        order_violations = check_module_decl_order(f, lines)
        call_violations = check_calls_exist(f, lines, known_procs)
        file_violations = order_violations + call_violations

        if not file_violations:
            print(f"  [OK]      {f.name}")
            continue

        print(f"  [VIOLATION] {f.name} -- {len(file_violations)} probleme(s)")
        for line_no, excerpt, explanation in sorted(file_violations):
            print(f"    L{line_no}: {excerpt}")
            print(f"      -> {explanation}")
        total_violations += len(file_violations)

    print(f"\n{len(files)} fichier(s) scanne(s) dans vba/ (hors snippets et backups).")
    print(f"{len(known_procs)} procedure(s) connue(s) au total.")

    if total_violations:
        print(f"\n{total_violations} VIOLATION(S) DETECTEE(S) -- a corriger avant le commit.")
        sys.exit(1)

    print("\nAucune violation detectee.")
    sys.exit(0)


if __name__ == '__main__':
    main()
