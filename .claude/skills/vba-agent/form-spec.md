# Schéma d'un UserForm — `build-form`

`build-form --file F --spec FORM.json` crée (ou **remplace** s'il existe déjà) un
UserForm et tous ses contrôles, puis injecte le code-behind.

## Structure du JSON

```jsonc
{
  "name": "frmSaisie",            // nom du UserForm (obligatoire)
  "caption": "Saisie du dossier", // titre de la fenêtre
  "width": 420,                   // en points
  "height": 320,
  "properties": {                 // propriétés du form (optionnel)
    "BackColor": 16448250,        // RGB encodé en Long (= RGB(245,248,252))
    "StartUpPosition": 1,         // 1 = centré parent, 2 = centré écran
    "ShowModal": true
  },
  "controls": [
    {
      "kind": "Label",            // type de contrôle (voir liste)
      "name": "lblNom",
      "caption": "Nom :",
      "left": 12, "top": 18, "width": 110, "height": 18,
      "props": { "Font.Bold": true, "Font.Size": 9 }
    },
    {
      "kind": "TextBox",
      "name": "txtNom",
      "left": 130, "top": 16, "width": 260, "height": 20
    },
    {
      "kind": "ComboBox",
      "name": "cboType",
      "left": 130, "top": 46, "width": 260, "height": 20
    },
    {
      "kind": "CommandButton",
      "name": "btnOK",
      "caption": "Valider",
      "left": 310, "top": 280, "width": 80, "height": 26,
      "props": { "BackColor": 3381606, "ForeColor": 16777215 }
    }
  ],
  "code": "Private Sub btnOK_Click()\n    If Me.txtNom.Value = \"\" Then\n        MsgBox \"Nom obligatoire.\", vbExclamation\n        Exit Sub\n    End If\n    Unload Me\nEnd Sub"
}
```

## Champs d'un contrôle

| Clé | Sens |
|---|---|
| `kind` | Type (table ci-dessous) — **obligatoire** |
| `name` | Nom du contrôle |
| `left`, `top`, `width`, `height` | Position/taille en points |
| `caption` | Légende (Label, CommandButton, CheckBox…) |
| `value` | Valeur initiale (TextBox, CheckBox…) |
| `props` | Dict de propriétés supplémentaires, imbriquées avec un point (`Font.Bold`, `Font.Size`, `ForeColor`, `MaxLength`, `MultiLine`…) |

## Types de `kind` supportés

`Label`, `TextBox`, `ComboBox`, `ListBox`, `CheckBox`, `OptionButton`,
`CommandButton`, `Frame`, `Image`, `ToggleButton`, `SpinButton`, `ScrollBar`,
`MultiPage`, `TabStrip`.

## Notes

- Les couleurs sont des entiers Long (`RGB(r,g,b) = r + g*256 + b*65536`).
- Le code-behind est ajouté tel quel : y placer `Private Sub <ctrl>_Click()`,
  `UserForm_Initialize()`, etc.
- Pour afficher le formulaire ensuite, prévoir une macro dans un module standard
  (`frmSaisie.Show`) et l'injecter via `set-module`.
- `build-form` **remplace** un UserForm de même nom (il le supprime puis le
  recrée) : faire un `backup` avant.
