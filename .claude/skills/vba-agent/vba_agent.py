#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
vba_agent.py — Pilote le VBE d'Excel (Windows) pour lire et modifier le code VBA
d'un classeur, y compris quand l'utilisateur l'a déjà ouvert.

S'attache en priorité à l'instance Excel EN COURS (le fichier ouvert par
l'utilisateur), ne l'ouvre lui-même qu'en dernier recours.

Toutes les sorties sont en JSON sur stdout :
  succès -> {"ok": true, ...}
  échec  -> {"ok": false, "error": "...", "hint": "..."}

PRÉREQUIS (poste Windows, une seule fois) :
  - Excel installé
  - pip install pywin32
  - Excel > Options > Centre de gestion de la confidentialité > Paramètres des
    macros > cocher « Faire confiance à l'accès au modèle d'objet du projet VBA »

Sous-commandes :
  list                            Liste les classeurs ouverts dans Excel
  inspect   --file F [--component NAME] [--names-only]
  backup    --file F --out DIR    Exporte tous les composants (.bas/.cls/.frm)
  set-module --file F --name N --type std|class --code-file C [--create]
  set-doc   --file F --name N --code-file C        (ThisWorkbook, Feuil1, ...)
  import    --file F --path COMP.(bas|cls|frm)
  remove    --file F --name N
  build-form --file F --spec FORM.json
  run       --file F --macro NAME
  save      --file F

--file accepte un nom de fichier (basename) ou un chemin complet ; la
correspondance se fait sur le nom et sur le chemin complet du classeur ouvert.
"""

import sys
import os
import json
import argparse

# Types de composants VBA (vbext_ComponentType)
CT_STD = 1          # vbext_ct_StdModule
CT_CLASS = 2        # vbext_ct_ClassModule
CT_MSFORM = 3       # vbext_ct_MSForm
CT_ACTIVEX = 11     # vbext_ct_ActiveXDesigner
CT_DOCUMENT = 100   # vbext_ct_Document (ThisWorkbook, feuilles) — non supprimable

CT_NAME = {
    CT_STD: "module",
    CT_CLASS: "class",
    CT_MSFORM: "form",
    CT_ACTIVEX: "designer",
    CT_DOCUMENT: "document",
}


def out(obj):
    print(json.dumps(obj, ensure_ascii=False, indent=2))


def fail(msg, hint=None, code=1):
    o = {"ok": False, "error": msg}
    if hint:
        o["hint"] = hint
    out(o)
    sys.exit(code)


def get_excel():
    """Retourne l'application Excel en cours d'exécution, sinon None."""
    import win32com.client
    try:
        return win32com.client.GetActiveObject("Excel.Application")
    except Exception:
        return None


def open_excel_with(path):
    """Ouvre une nouvelle instance et le classeur (dernier recours)."""
    import win32com.client
    app = win32com.client.Dispatch("Excel.Application")
    app.Visible = True
    wb = app.Workbooks.Open(os.path.abspath(path))
    return app, wb


def find_workbook(app, file_arg):
    """Trouve le classeur ouvert correspondant à file_arg (nom ou chemin)."""
    if app is None:
        return None
    target_name = os.path.basename(file_arg).lower()
    target_full = os.path.abspath(file_arg).lower() if os.path.sep in file_arg else None
    for wb in app.Workbooks:
        try:
            if wb.Name.lower() == target_name:
                return wb
            if target_full and wb.FullName.lower() == target_full:
                return wb
        except Exception:
            continue
    return None


def resolve_workbook(file_arg, allow_open=False):
    """
    Stratégie : s'attacher à l'instance ouverte et y trouver le classeur.
    Si introuvable et allow_open=True, ouvrir le fichier dans une nouvelle instance.
    """
    app = get_excel()
    wb = find_workbook(app, file_arg)
    if wb is not None:
        return app, wb, False
    if allow_open and os.path.exists(file_arg):
        app, wb = open_excel_with(file_arg)
        return app, wb, True
    if app is None:
        fail("Aucune instance Excel en cours.",
             "Ouvre le classeur dans Excel, ou relance avec --open pour qu'il "
             "soit ouvert automatiquement.")
    fail("Classeur introuvable parmi les fichiers Excel ouverts : %s" % file_arg,
         "Vérifie le nom exact (sous-commande 'list'), ou utilise --open.")


def get_vbproject(wb):
    """Accède au projet VBA en gérant l'erreur de confiance."""
    try:
        proj = wb.VBProject
        # accès qui déclenche réellement l'erreur de confiance si non activée
        _ = proj.VBComponents.Count
        return proj
    except Exception as e:
        msg = str(e)
        fail("Accès au projet VBA refusé (%s)." % msg,
             "Active : Excel > Options > Centre de gestion de la confidentialité "
             "> Paramètres des macros > « Faire confiance à l'accès au modèle "
             "d'objet du projet VBA », puis relance.")


def find_component(proj, name):
    for comp in proj.VBComponents:
        if comp.Name.lower() == name.lower():
            return comp
    return None


def module_source(comp):
    try:
        cm = comp.CodeModule
        n = cm.CountOfLines
        return cm.Lines(1, n) if n > 0 else ""
    except Exception:
        return ""


def read_code(args):
    if getattr(args, "code_file", None):
        with open(args.code_file, "r", encoding="utf-8-sig") as f:
            return f.read()
    fail("Aucun code fourni.", "Passe --code-file CHEMIN.")


# ----------------------------------------------------------------------------
# Sous-commandes
# ----------------------------------------------------------------------------

def cmd_list(args):
    app = get_excel()
    if app is None:
        out({"ok": True, "running": False, "workbooks": []})
        return
    wbs = []
    for wb in app.Workbooks:
        try:
            wbs.append({"name": wb.Name, "fullName": wb.FullName,
                        "saved": bool(wb.Saved)})
        except Exception:
            pass
    out({"ok": True, "running": True, "workbooks": wbs})


def cmd_inspect(args):
    app, wb, opened = resolve_workbook(args.file, allow_open=args.open)
    proj = get_vbproject(wb)
    comps = []
    for comp in proj.VBComponents:
        if args.component and comp.Name.lower() != args.component.lower():
            continue
        ctype = comp.Type
        entry = {
            "name": comp.Name,
            "type": CT_NAME.get(ctype, str(ctype)),
            "typeId": ctype,
            "lines": comp.CodeModule.CountOfLines,
        }
        if not args.names_only:
            entry["source"] = module_source(comp)
        comps.append(entry)
    out({"ok": True, "workbook": wb.Name, "fullName": wb.FullName,
         "openedByAgent": opened, "components": comps})


def cmd_backup(args):
    app, wb, opened = resolve_workbook(args.file, allow_open=args.open)
    proj = get_vbproject(wb)
    os.makedirs(args.out, exist_ok=True)
    ext = {CT_STD: ".bas", CT_CLASS: ".cls", CT_MSFORM: ".frm",
           CT_ACTIVEX: ".cls", CT_DOCUMENT: ".cls"}
    exported = []
    for comp in proj.VBComponents:
        try:
            path = os.path.join(args.out, comp.Name + ext.get(comp.Type, ".bas"))
            comp.Export(path)
            exported.append(path)
        except Exception as e:
            exported.append({"name": comp.Name, "error": str(e)})
    out({"ok": True, "workbook": wb.Name, "out": os.path.abspath(args.out),
         "exported": exported})


def cmd_set_module(args):
    app, wb, opened = resolve_workbook(args.file, allow_open=args.open)
    proj = get_vbproject(wb)
    code = read_code(args)
    comp = find_component(proj, args.name)
    created = False
    if comp is None:
        if not args.create:
            fail("Composant inexistant : %s" % args.name,
                 "Ajoute --create pour le créer.")
        ctype = CT_CLASS if args.type == "class" else CT_STD
        comp = proj.VBComponents.Add(ctype)
        comp.Name = args.name
        created = True
    else:
        if comp.Type == CT_DOCUMENT:
            fail("« %s » est un module de document (ThisWorkbook/feuille)." % args.name,
                 "Utilise la sous-commande 'set-doc' (on ne peut pas le recréer).")
    cm = comp.CodeModule
    if cm.CountOfLines > 0:
        cm.DeleteLines(1, cm.CountOfLines)
    cm.AddFromString(code)
    out({"ok": True, "workbook": wb.Name, "component": comp.Name,
         "created": created, "type": CT_NAME.get(comp.Type),
         "lines": cm.CountOfLines, "note": "Pense à 'save' pour persister."})


def cmd_set_doc(args):
    app, wb, opened = resolve_workbook(args.file, allow_open=args.open)
    proj = get_vbproject(wb)
    code = read_code(args)
    comp = find_component(proj, args.name)
    if comp is None:
        fail("Module de document introuvable : %s" % args.name,
             "Noms typiques : ThisWorkbook, Feuil1, Sheet1...")
    cm = comp.CodeModule
    if cm.CountOfLines > 0:
        cm.DeleteLines(1, cm.CountOfLines)
    cm.AddFromString(code)
    out({"ok": True, "workbook": wb.Name, "component": comp.Name,
         "lines": cm.CountOfLines, "note": "Pense à 'save' pour persister."})


def cmd_import(args):
    app, wb, opened = resolve_workbook(args.file, allow_open=args.open)
    proj = get_vbproject(wb)
    if not os.path.exists(args.path):
        fail("Fichier composant introuvable : %s" % args.path)
    comp = proj.VBComponents.Import(os.path.abspath(args.path))
    out({"ok": True, "workbook": wb.Name, "imported": comp.Name,
         "type": CT_NAME.get(comp.Type), "note": "Pense à 'save'."})


def cmd_remove(args):
    app, wb, opened = resolve_workbook(args.file, allow_open=args.open)
    proj = get_vbproject(wb)
    comp = find_component(proj, args.name)
    if comp is None:
        fail("Composant introuvable : %s" % args.name)
    if comp.Type == CT_DOCUMENT:
        fail("Impossible de supprimer un module de document (%s)." % args.name,
             "Vide son code avec 'set-doc' et un fichier vide à la place.")
    proj.VBComponents.Remove(comp)
    out({"ok": True, "workbook": wb.Name, "removed": args.name,
         "note": "Pense à 'save'."})


def cmd_build_form(args):
    """
    Crée (ou remplace) un UserForm à partir d'un fichier JSON :
    {
      "name": "frmSaisie",
      "caption": "Saisie dossier",
      "width": 420, "height": 320,
      "properties": { "BackColor": 16448250, "StartUpPosition": 1 },
      "controls": [
        {"kind": "Label",         "name": "lblNom", "caption": "Nom :",
         "left": 12, "top": 18, "width": 110, "height": 18,
         "props": {"Font.Bold": true}},
        {"kind": "TextBox",       "name": "txtNom",
         "left": 130, "top": 16, "width": 240, "height": 20},
        {"kind": "ComboBox",      "name": "cboType",
         "left": 130, "top": 46, "width": 240, "height": 20},
        {"kind": "CommandButton", "name": "btnOK", "caption": "Valider",
         "left": 290, "top": 270, "width": 80, "height": 26}
      ],
      "code": "Private Sub btnOK_Click()\n  Unload Me\nEnd Sub"
    }
    "kind" -> ProgID : Label, TextBox, ComboBox, ListBox, CheckBox,
    OptionButton, CommandButton, Frame, Image, ToggleButton, SpinButton,
    ScrollBar, MultiPage, TabStrip.
    """
    progid = {
        "Label": "Forms.Label.1", "TextBox": "Forms.TextBox.1",
        "ComboBox": "Forms.ComboBox.1", "ListBox": "Forms.ListBox.1",
        "CheckBox": "Forms.CheckBox.1", "OptionButton": "Forms.OptionButton.1",
        "CommandButton": "Forms.CommandButton.1", "Frame": "Forms.Frame.1",
        "Image": "Forms.Image.1", "ToggleButton": "Forms.ToggleButton.1",
        "SpinButton": "Forms.SpinButton.1", "ScrollBar": "Forms.ScrollBar.1",
        "MultiPage": "Forms.MultiPage.1", "TabStrip": "Forms.TabStrip.1",
    }
    with open(args.spec, "r", encoding="utf-8-sig") as f:
        spec = json.load(f)

    app, wb, opened = resolve_workbook(args.file, allow_open=args.open)
    proj = get_vbproject(wb)

    name = spec["name"]
    existing = find_component(proj, name)
    replaced = False
    if existing is not None:
        if existing.Type != CT_MSFORM:
            fail("« %s » existe déjà et n'est pas un UserForm." % name)
        proj.VBComponents.Remove(existing)
        replaced = True

    uf = proj.VBComponents.Add(CT_MSFORM)
    uf.Name = name
    if "caption" in spec:
        _set_form_prop(uf, "Caption", spec["caption"])
    if "width" in spec:
        _set_form_prop(uf, "Width", spec["width"])
    if "height" in spec:
        _set_form_prop(uf, "Height", spec["height"])
    for k, v in (spec.get("properties") or {}).items():
        _set_form_prop(uf, k, v)

    designer = uf.Designer
    added = []
    for c in spec.get("controls", []):
        pid = progid.get(c["kind"])
        if not pid:
            fail("Type de contrôle inconnu : %s" % c.get("kind"))
        ctl = designer.Controls.Add(pid, c.get("name", ""), True)
        for prop in ("left", "top", "width", "height"):
            if prop in c:
                setattr(ctl, prop.capitalize(), c[prop])
        if "caption" in c:
            try:
                ctl.Caption = c["caption"]
            except Exception:
                pass
        if "value" in c:
            try:
                ctl.Value = c["value"]
            except Exception:
                pass
        for pk, pv in (c.get("props") or {}).items():
            _set_nested(ctl, pk, pv)
        added.append(c.get("name", ""))

    if spec.get("code"):
        uf.CodeModule.AddFromString(spec["code"])

    out({"ok": True, "workbook": wb.Name, "form": name, "replaced": replaced,
         "controls": added, "note": "Pense à 'save'."})


def _set_nested(obj, dotted, value):
    """Affecte une propriété éventuellement imbriquée (ex. 'Font.Bold')."""
    parts = dotted.split(".")
    target = obj
    for p in parts[:-1]:
        target = getattr(target, p)
    try:
        setattr(target, parts[-1], value)
    except Exception:
        pass


def cmd_run(args):
    app, wb, opened = resolve_workbook(args.file, allow_open=args.open)
    try:
        app.Run(args.macro)
    except Exception as e:
        fail("Échec d'exécution de la macro %s : %s" % (args.macro, e))
    out({"ok": True, "workbook": wb.Name, "ran": args.macro})


def cmd_save(args):
    app, wb, opened = resolve_workbook(args.file, allow_open=args.open)
    try:
        wb.Save()
    except Exception as e:
        fail("Échec de l'enregistrement : %s" % e,
             "Le classeur doit être en .xlsm/.xlsb (macro-enabled) pour "
             "conserver le VBA.")
    out({"ok": True, "workbook": wb.Name, "saved": True})


# Affectation d'une propriété de UserForm via la collection Properties (COM).
# En VBA on écrit `uf.Properties("Caption") = x` ; en Python/COM il faut
# passer par l'objet Property et son membre .Value.
def _set_form_prop(component, key, value):
    try:
        component.Properties(key).Value = value
    except Exception:
        try:
            setattr(component, key, value)
        except Exception:
            pass


def build_parser():
    p = argparse.ArgumentParser(description="Pilote VBA Excel via COM (pywin32).")
    p.add_argument("--open", action="store_true",
                   help="Ouvrir le fichier si non déjà ouvert dans Excel.")
    sub = p.add_subparsers(dest="cmd", required=True)

    sp = sub.add_parser("list"); sp.set_defaults(func=cmd_list)

    sp = sub.add_parser("inspect")
    sp.add_argument("--file", required=True)
    sp.add_argument("--component")
    sp.add_argument("--names-only", action="store_true")
    sp.set_defaults(func=cmd_inspect)

    sp = sub.add_parser("backup")
    sp.add_argument("--file", required=True)
    sp.add_argument("--out", required=True)
    sp.set_defaults(func=cmd_backup)

    sp = sub.add_parser("set-module")
    sp.add_argument("--file", required=True)
    sp.add_argument("--name", required=True)
    sp.add_argument("--type", choices=["std", "class"], default="std")
    sp.add_argument("--code-file", required=True)
    sp.add_argument("--create", action="store_true")
    sp.set_defaults(func=cmd_set_module)

    sp = sub.add_parser("set-doc")
    sp.add_argument("--file", required=True)
    sp.add_argument("--name", required=True)
    sp.add_argument("--code-file", required=True)
    sp.set_defaults(func=cmd_set_doc)

    sp = sub.add_parser("import")
    sp.add_argument("--file", required=True)
    sp.add_argument("--path", required=True)
    sp.set_defaults(func=cmd_import)

    sp = sub.add_parser("remove")
    sp.add_argument("--file", required=True)
    sp.add_argument("--name", required=True)
    sp.set_defaults(func=cmd_remove)

    sp = sub.add_parser("build-form")
    sp.add_argument("--file", required=True)
    sp.add_argument("--spec", required=True)
    sp.set_defaults(func=cmd_build_form)

    sp = sub.add_parser("run")
    sp.add_argument("--file", required=True)
    sp.add_argument("--macro", required=True)
    sp.set_defaults(func=cmd_run)

    sp = sub.add_parser("save")
    sp.add_argument("--file", required=True)
    sp.set_defaults(func=cmd_save)

    return p


def main():
    args = build_parser().parse_args()
    try:
        import pythoncom
        pythoncom.CoInitialize()
    except Exception:
        pass
    try:
        args.func(args)
    except SystemExit:
        raise
    except Exception as e:
        fail("Erreur inattendue : %s" % e)


if __name__ == "__main__":
    main()
