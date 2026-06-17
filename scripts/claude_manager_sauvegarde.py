"""
CLAUDE MANAGER - Script de sauvegarde et restauration pour Claude Desktop
-------------------------------------------------------------------------
DESCRIPTION :
Ce script permet d'automatiser la sauvegarde et la restauration des données 
locales de l'application Claude (paramètres, mémoires, configurations).

FONCTIONNALITÉS :
- Compression automatique au format .zip.
- Vérification automatique de la bibliothèque 'psutil' (installation si absente).
- Détection de l'exécution de l'application Claude avant sauvegarde.
- Vérification de l'espace disque disponible sur la destination.
- Rotation automatique des sauvegardes (conserve uniquement les 5 dernières).
- Mode simulation (--dry-run) pour tester les opérations sans rien modifier.
- Rappel pour la migration vers d'autres machines (sessions et variables).

UTILISATION :
1. Sauvegarde :
   python claude_manager.py sauvegarde [dossier_source] [dossier_destination]
   
2. Restauration :
   python claude_manager.py restauration [fichier.zip] [dossier_destination]

3. Simulation :
   Ajoutez '--dry-run' au début de la commande pour simuler l'action.
"""

import shutil
import os
import argparse
import datetime
import glob
import subprocess
import sys
from pathlib import Path

# --- Installation automatique de psutil ---
def install_requirements():
    try:
        import psutil
    except ImportError:
        print("La bibliothèque 'psutil' est manquante. Installation en cours...")
        try:
            subprocess.check_call([sys.executable, "-m", "pip", "install", "psutil"])
            return True
        except subprocess.CalledProcessError:
            return False
    return True

if not install_requirements():
    print("Erreur : Impossible d'installer 'psutil'.")
    sys.exit(1)

import psutil

def get_disk_free_space(path):
    """Retourne l'espace libre en Go."""
    total, used, free = shutil.disk_usage(path)
    return free // (2**30)

def is_claude_running():
    for proc in psutil.process_iter(['name']):
        if proc.info['name'] and 'Claude' in proc.info['name']:
            return True
    return False

def rotate_backups(backup_dir, limit=5):
    """Conserve uniquement les 'limit' dernières sauvegardes."""
    backups = sorted(glob.glob(os.path.join(backup_dir, "claude_backup_*.zip")), key=os.path.getmtime)
    if len(backups) > limit:
        for old_backup in backups[:-limit]:
            os.remove(old_backup)
            print(f"Ancienne sauvegarde supprimée : {os.path.basename(old_backup)}")

def backup(source_dir, backup_dir, dry_run=False, limit=5):
    source = Path(source_dir)
    dest = Path(backup_dir)
    
    # 1. Vérification espace
    free_gb = get_disk_free_space(dest)
    print(f"Espace disponible sur la destination : {free_gb} Go")
    
    if is_claude_running():
        print("Attention : Claude est ouvert.")
        if dry_run: print("[DRY-RUN] Note : Claude est ouvert, fermeture recommandée.")

    timestamp = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
    zip_name = dest / f"claude_backup_{timestamp}"
    
    if dry_run:
        print(f"[DRY-RUN] Simulation : Création de l'archive {zip_name}.zip depuis {source}")
    else:
        dest.mkdir(parents=True, exist_ok=True)
        archive_path = shutil.make_archive(str(zip_name), 'zip', source)
        print(f"Sauvegarde réussie : {archive_path}")
        rotate_backups(backup_dir, limit)

def restore(zip_file, target_dir, dry_run=False):
    if not os.path.exists(zip_file):
        print("Erreur : Fichier introuvable.")
        return
    
    if dry_run:
        print(f"[DRY-RUN] Simulation : Restauration de {zip_file} vers {target_dir}")
    else:
        target = Path(target_dir)
        target.mkdir(parents=True, exist_ok=True)
        shutil.unpack_archive(zip_file, str(target), 'zip')
        print(f"Restauration réussie dans : {target_dir}")
        print("\n--- RAPPEL IMPORTANT ---")
        print("La restauration est terminée. Notez que pour une migration vers une autre machine :")
        print("1. Vous devrez probablement vous reconnecter à votre compte Claude.")
        print("2. Si vous utilisez des scripts externes ou des variables d'environnement,")
        print("   assurez-vous de les configurer manuellement sur la nouvelle machine.")
        print("------------------------\n")

def main():
    parser = argparse.ArgumentParser(description="Gestionnaire de sauvegardes Claude.")
    parser.add_argument("--dry-run", action="store_true", help="Simuler sans modifier les fichiers")
    subparsers = parser.add_subparsers(dest="action", required=True)

    # Sauvegarde
    p1 = subparsers.add_parser("sauvegarde")
    p1.add_argument("source", help="Dossier Claude")
    p1.add_argument("destination", help="Dossier de stockage")

    # Restauration
    p2 = subparsers.add_parser("restauration")
    p2.add_argument("zip_file", help="Fichier .zip")
    p2.add_argument("destination", help="Dossier cible")

    args = parser.parse_args()

    if args.action == "sauvegarde":
        backup(args.source, args.destination, args.dry_run)
    else:
        restore(args.zip_file, args.destination, args.dry_run)

if __name__ == "__main__":
    main()
