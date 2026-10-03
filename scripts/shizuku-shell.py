#!/data/data/com.termux/files/usr/bin/python
"""Run an authorized Shizuku command with Android runtime variables restored.

Remote shells may omit BOOTCLASSPATH and Android ART paths. Read only these
public runtime values from the existing Termux process; Shizuku still enforces
its normal per-app authorization.
"""
import os,sys,subprocess
from pathlib import Path
keys={'ANDROID_DATA','ANDROID_ROOT','ANDROID_ART_ROOT','ANDROID_RUNTIME_ROOT','ANDROID_I18N_ROOT','ANDROID_TZDATA_ROOT','ANDROID_STORAGE','BOOTCLASSPATH','DEX2OATBOOTCLASSPATH','SYSTEMSERVERCLASSPATH'}
env=dict(os.environ)
for p in Path('/proc').glob('[0-9]*'):
 try:
  if (p/'cmdline').read_bytes().split(b'\0')[0] != b'com.termux':continue
  vals=dict(x.split('=',1) for x in (p/'environ').read_bytes().decode().split('\0') if '=' in x)
  env.update({k:v for k,v in vals.items() if k in keys})
  break
 except (PermissionError,FileNotFoundError,ProcessLookupError):pass
if len(sys.argv) != 2:
 raise SystemExit('Usage: shizuku-shell COMMAND')
r=subprocess.run(['rish','-c',sys.argv[1]],env=env)
sys.exit(r.returncode)
