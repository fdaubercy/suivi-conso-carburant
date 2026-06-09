"""Full VBA project rebuild — fixes Module1-8 mess, restores document modules."""
import win32com.client as win32
import sys, os, json

BASE = r"C:\Users\fdaub\Documents\Github\suivi-conso-carburant"

def find_wb(xl):
    for book in xl.Workbooks:
        if "Suivi Conso" in book.Name:
            return book
    return None

def get_comp(vbp, name):
    try:
        return vbp.VBComponents(name)
    except:
        return None

def set_doc_code(vbp, name, code):
    comp = get_comp(vbp, name)
    if comp is None:
        print(f"  WARN: {name} not found", flush=True)
        return False
    cm = comp.CodeModule
    if cm.CountOfLines > 0:
        cm.DeleteLines(1, cm.CountOfLines)
    cm.InsertLines(1, code)
    print(f"  OK: {name} restored ({cm.CountOfLines} lines)", flush=True)
    return True

def set_std_code(vbp, name, code, create=False):
    comp = get_comp(vbp, name)
    if comp is None:
        if create:
            comp = vbp.VBComponents.Add(1)  # vbext_ct_StdModule = 1
            comp.Name = name
        else:
            print(f"  WARN: {name} not found", flush=True)
            return False
    cm = comp.CodeModule
    if cm.CountOfLines > 0:
        cm.DeleteLines(1, cm.CountOfLines)
    cm.InsertLines(1, code)
    print(f"  OK: {name} set ({cm.CountOfLines} lines)", flush=True)
    return True

def read_file(path):
    for enc in ("utf-8", "utf-8-sig", "cp1252", "latin-1"):
        try:
            with open(path, "r", encoding=enc) as f:
                return f.read()
        except UnicodeDecodeError:
            continue
    raise ValueError(f"Cannot decode {path}")

def strip_attribute_header(code):
    """Remove Attribute VB_Name and similar header lines."""
    lines = code.splitlines(keepends=True)
    out = []
    for line in lines:
        stripped = line.strip()
        if stripped.startswith("Attribute VB_"):
            continue
        out.append(line)
    return "".join(out)

def main():
    xl = win32.GetActiveObject("Excel.Application")
    wb = find_wb(xl)
    if wb is None:
        print("ERROR: Workbook not found", flush=True)
        sys.exit(1)

    vbp = wb.VBProject
    print(f"Workbook: {wb.Name}", flush=True)

    # ── STEP 1: Rename Module4 → ModuleImportGS, Module8 → modGraphiques ──
    print("\n[1] Renaming modules...", flush=True)
    for comp in list(vbp.VBComponents):
        if comp.Name == "Module4":
            comp.Name = "ModuleImportGS"
            print("  Module4 -> ModuleImportGS", flush=True)
        elif comp.Name == "Module8":
            comp.Name = "modGraphiques"
            print("  Module8 -> modGraphiques", flush=True)

    # ── STEP 2: Remove Module1, Module2, Module3, Module5, Module6, Module7 ──
    print("\n[2] Removing snippet modules...", flush=True)
    for name in ["Module1", "Module2", "Module3", "Module5", "Module6", "Module7"]:
        comp = get_comp(vbp, name)
        if comp is not None:
            vbp.VBComponents.Remove(comp)
            print(f"  Removed {name}", flush=True)
        else:
            print(f"  Skip {name} (not found)", flush=True)

    # ── STEP 3: Create General module ──
    print("\n[3] Creating General module...", flush=True)
    general_code = strip_attribute_header(
        read_file(os.path.join(BASE, "vba-backup-20260607-sidebar", "General.bas"))
    )
    set_std_code(vbp, "General", general_code, create=True)

    # ── STEP 4: Restore document modules ──
    print("\n[4] Restoring document modules...", flush=True)

    # ThisWorkbook
    tw_code = read_file(os.path.join(BASE, "vba", "_ThisWorkbook_tmp.bas"))
    set_doc_code(vbp, "ThisWorkbook", tw_code)

    # Feuil2 — Suivi Carburant (56 lines)
    feuil2_code = read_file(os.path.join(BASE, "temp_feuil2.bas"))
    set_doc_code(vbp, "Feuil2", feuil2_code)

    # Feuil3 — Tableau de bord
    feuil3_code = strip_attribute_header(
        read_file(os.path.join(BASE, "vba", "Graphiques_snippet.bas"))
    )
    set_doc_code(vbp, "Feuil3", feuil3_code)

    # Feuil4 — GS_Pleins
    feuil4_code = strip_attribute_header(
        read_file(os.path.join(BASE, "vba", "GS_Pleins_snippet.bas"))
    )
    set_doc_code(vbp, "Feuil4", feuil4_code)

    # Feuil7 — Réglages
    feuil7_code = strip_attribute_header(
        read_file(os.path.join(BASE, "vba", "Reglages_snippet.bas"))
    )
    set_doc_code(vbp, "Feuil7", feuil7_code)

    # Feuil15 — Carte
    feuil15_code = strip_attribute_header(
        read_file(os.path.join(BASE, "vba", "Carte_snippet.bas"))
    )
    set_doc_code(vbp, "Feuil15", feuil15_code)

    # All other Feuil* that had only Option Explicit
    for name in ["Feuil1", "Feuil5", "Feuil6", "Feuil8", "Feuil9",
                 "Feuil10", "Feuil11", "Feuil13", "Feuil16", "Feuil21"]:
        set_doc_code(vbp, name, "Option Explicit\n")

    # ── STEP 5: Verify ──
    print("\n[5] Final module list...", flush=True)
    names = sorted(c.Name for c in vbp.VBComponents)
    for n in names:
        print(f"  {n}", flush=True)

    print("\nDone — saving workbook...", flush=True)
    wb.Save()
    print("Saved.", flush=True)

if __name__ == "__main__":
    main()
