#!/usr/bin/env python3
"""
check_vba_drift.py -- X18
Compare les modules VBA de l'Excel (.xlsm) avec les fichiers vba/*.bas du repo.
Exit 0 = pas de derive, Exit 1 = derive detectee, Exit 2 = erreur.

Usage:
    python scripts/check_vba_drift.py [chemin_vers.xlsm]

Prerequis: pip install oletools
"""
import sys
import os
import re
import difflib
from pathlib import Path


SNIPPETS_SUFFIX = ('_snippet', '_tmp', 'synchronisegoogleform')
ATTR_LINE = re.compile(r'^Attribute\s+VB_', re.IGNORECASE)


def normalize(code: str) -> str:
    """Supprime les lignes Attribute VB_* et normalise les fins de ligne."""
    lines = code.replace('\r\n', '\n').replace('\r', '\n').splitlines()
    filtered = [l for l in lines if not ATTR_LINE.match(l)]
    # Trim trailing blank lines
    while filtered and not filtered[-1].strip():
        filtered.pop()
    return '\n'.join(filtered)


def extract_from_xlsm(xlsm_path: str) -> dict:
    """Extrait les sources VBA du .xlsm via oletools."""
    try:
        from oletools.olevba import VBA_Parser
    except ImportError:
        print("ERREUR: oletools absent. Installer : pip install oletools")
        sys.exit(2)

    parser = VBA_Parser(xlsm_path)
    modules = {}
    for _filename, _stream, vba_filename, vba_code in parser.extract_macros():
        name = re.sub(r'\.(bas|cls|frm)$', '', vba_filename, flags=re.IGNORECASE)
        modules[name.lower()] = (name, normalize(vba_code))
    parser.close()
    return modules


def load_bas_files(vba_dir: Path) -> dict:
    """Charge les vba/*.bas en ignorant les snippets."""
    modules = {}
    for bas in sorted(vba_dir.glob('*.bas')):
        key = bas.stem.lower()
        if any(key.endswith(s) for s in SNIPPETS_SUFFIX):
            continue
        try:
            code = bas.read_text(encoding='utf-8', errors='replace')
        except OSError as e:
            print(f"  [WARN] Impossible de lire {bas.name}: {e}")
            continue
        modules[key] = (bas.stem, normalize(code))
    return modules


def main():
    repo_root = Path(__file__).resolve().parent.parent
    xlsm_path = sys.argv[1] if len(sys.argv) > 1 else str(
        repo_root / 'excel' / 'Suivi Conso Carburants.xlsm'
    )

    if not os.path.exists(xlsm_path):
        print(f"ERREUR: fichier introuvable : {xlsm_path}")
        sys.exit(2)

    vba_dir = repo_root / 'vba'
    print(f"check-vba-drift: {xlsm_path}")
    print(f"  vs {vba_dir}")

    xlsm_mods = extract_from_xlsm(xlsm_path)
    bas_mods   = load_bas_files(vba_dir)

    drift = False
    checked = 0

    for key, (bas_name, bas_code) in sorted(bas_mods.items()):
        if key not in xlsm_mods:
            print(f"  [ABSENT]  {bas_name} -- present dans vba/ mais absent du .xlsm")
            continue
        xlsm_name, xlsm_code = xlsm_mods[key]
        checked += 1
        if bas_code == xlsm_code:
            print(f"  [OK]      {bas_name}")
        else:
            print(f"  [DERIVE]  {bas_name}")
            diff = list(difflib.unified_diff(
                xlsm_code.splitlines(),
                bas_code.splitlines(),
                fromfile=f"{xlsm_name} (xlsm)",
                tofile=f"{bas_name} (vba/)",
                lineterm='',
            ))
            for line in diff[:50]:
                print('    ' + line)
            if len(diff) > 50:
                print(f"    ... ({len(diff) - 50} lignes supplementaires)")
            drift = True

    extras = [n for k, (n, _) in xlsm_mods.items() if k not in bas_mods]
    for name in sorted(extras):
        print(f"  [EXTRA]   {name} -- dans .xlsm mais absent de vba/")

    print(f"\n{checked} module(s) verifies sur {len(bas_mods)} fichiers .bas (hors snippets).")
    if drift:
        print("DERIVE DETECTEE -- resynchronisation requise avant le commit.")
        sys.exit(1)
    print("Aucune derive detectee.")
    sys.exit(0)


if __name__ == '__main__':
    main()
