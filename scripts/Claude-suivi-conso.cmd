@echo off
REM ============================================================
REM  Claude Code dans le depot suivi-conso-carburant
REM  Lanceur portable : se place a la racine du depot
REM  (..\ depuis scripts\), donc valable pour tout clone.
REM  Icone Claude : portee par le raccourci .lnk (claude.ico).
REM ============================================================
title Claude - suivi-conso-carburant
cd /d "%~dp0.."
call claude %*
