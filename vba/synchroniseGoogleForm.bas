Attribute VB_Name = "synchroniseGoogleForm"
' ============================================================
'  SUIVI E85 - Synchronisation de la liste des stations
'  Pousse les stations de l'onglet "Notes" (col D) vers la
'  feuille "Stations" du Google Sheet via action=syncStations.
'
'  Appelee par ModuleImportGS apres un import (fin de
'  ImporterNouveauxPleins).
'
'  v4.3.0.4 - S6 : ajout du token APP_TOKEN dans le payload.
'  Sans token, le backend (Code.gs tokenOk_) renvoie
'  {"success":false,"error":"unauthorized","code":401} des que la
'  propriete de script APP_TOKEN est posee cote GAS (cas confirme
'  le 2026-05-31) -> MsgBox "Reponse inattendue".
'
'  ⚠️ APP_TOKEN doit etre IDENTIQUE a :
'     - js/config.js (export const APP_TOKEN)
'     - vba/modSyncGS.bas (Private Const APP_TOKEN)
'     - GAS -> Parametres du projet -> Proprietes du script -> APP_TOKEN
' ============================================================
Option Explicit

Sub SyncStationsVersGoogleSheets()
    ' --- Configuration ---
    Const GAS_URL   As String = "https://script.google.com/macros/s/AKfycbwIyCfZVTpDOGBANtFcHECcCdbg4J4t377pKQjIJ0NJYFT9FMjZm5_6XOsyQAas8jeTyA/exec"
    Const APP_TOKEN As String = "e85_a7f3c9e21b8d4f60a5c3e8b7d12f6049"

    Dim wsNotes As Worksheet
    Set wsNotes = ThisWorkbook.Sheets("Notes")

    ' --- Recuperer les stations non vides de la colonne D (a partir de D2) ---
    Dim stations() As String
    Dim nb As Integer
    nb = 0
    Dim i As Integer
    i = 2
    Do While wsNotes.Cells(i, 4).Value <> ""
        ReDim Preserve stations(nb)
        stations(nb) = wsNotes.Cells(i, 4).Value
        nb = nb + 1
        i = i + 1
    Loop

    If nb = 0 Then
        MsgBox "Aucune station trouvee dans l'onglet Notes (colonne D).", vbExclamation
        Exit Sub
    End If

    ' --- Construire le JSON (token + action + stations) ---
    Dim json As String
    json = "{""action"":""syncStations"",""token"":""" & APP_TOKEN & """,""stations"":["
    Dim k As Integer
    For k = 0 To nb - 1
        json = json & """" & Replace(stations(k), """", "\""") & """"
        If k < nb - 1 Then json = json & ","
    Next k
    json = json & "]}"

    ' --- Envoyer vers Google Apps Script ---
    Dim xhr As Object
    Set xhr = CreateObject("WinHttp.WinHttpRequest.5.1")

    xhr.Open "POST", GAS_URL, False
    xhr.setRequestHeader "Content-Type", "application/json; charset=utf-8"
    xhr.Send json

    If xhr.status = 200 Then
        Dim resp As String
        resp = xhr.ResponseText
        If InStr(resp, """success"":true") > 0 Then
            SetStatus nb & " station(s) synchronisee(s) vers Google Sheets " & ChrW(10003)
        Else
            MsgBox "Reponse inattendue : " & Left(resp, 200), vbExclamation
        End If
    Else
        MsgBox "Erreur HTTP " & xhr.status & "  " & xhr.StatusText, vbCritical
    End If
End Sub
