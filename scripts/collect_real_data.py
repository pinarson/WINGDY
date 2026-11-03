#!/usr/bin/env python3
"""Interactive local collection, never run by CI or capture the entered key."""
import getpass
import os
from pathlib import Path
import shutil
import subprocess
import sys
import warnings

ROOT=Path(__file__).resolve().parents[1]

def main():
    if not sys.stdin.isatty():
        print('Saisie refusée : lancer cette commande dans votre terminal Windows interactif, hors Codex.')
        return 2
    node=shutil.which('node')
    if not node:
        fallback=Path('C:/pinokio/bin/miniconda/node.exe')
        node=str(fallback) if fallback.is_file() else None
    if not node:
        print('Node.js est requis pour tester Open-Meteo.')
        return 2
    env=os.environ.copy()
    try:
        with warnings.catch_warnings():
            warnings.simplefilter('error',getpass.GetPassWarning)
            key=getpass.getpass('Clé API marées (saisie masquée) : ').strip()
        if not key or '\n' in key or '\r' in key:
            print('Clé vide ou invalide ; aucune collecte de marées.')
            return 2
        env['API_MAREE_KEY']=key
        del key
        tide_status=subprocess.run([sys.executable,str(ROOT/'scripts/update_tides.py')],cwd=ROOT,env=env).returncode
    except (EOFError,getpass.GetPassWarning):
        print('Saisie masquée indisponible ; aucune clé acceptée.')
        return 2
    finally:
        env.pop('API_MAREE_KEY',None)
    # Node does not inherit the tide credential, even if the parent had one.
    wind_status=subprocess.run([node,str(ROOT/'scripts/probe-weather.mjs')],cwd=ROOT,env=env).returncode
    if wind_status==0:
        wind_status=subprocess.run([node,str(ROOT/'scripts/update-weather.mjs'),'--from-report','output/weather-diagnostic/report.json'],cwd=ROOT,env=env).returncode
    print('Collecte terminée. Marées : %s ; météo : %s. Aucun build ni déploiement.' % ('OK' if tide_status==0 else 'ÉCHEC','OK' if wind_status==0 else 'ÉCHEC'))
    return 0 if tide_status==wind_status==0 else 1

if __name__=='__main__':
    sys.exit(main())
