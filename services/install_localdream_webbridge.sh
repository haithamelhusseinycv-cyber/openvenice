#!/data/data/com.termux/files/usr/bin/sh
set -eu
bridge_prefix=/data/data/com.termux/files/usr
bridge_home=/data/data/com.termux/files/home
bridge_source="$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)/localdream_webbridge.py"
bridge_service="$bridge_prefix/var/service/localdream-webbridge"
bridge_logs="$bridge_prefix/var/log/localdream-webbridge"
mkdir -p "$bridge_service/log" "$bridge_logs" "$bridge_home/.termux/boot"
printf 's131072\nn5\n' > "$bridge_logs/config"
printf '#!%s/bin/sh\nexec %s/bin/python -u "%s"\n' "$bridge_prefix" "$bridge_prefix" "$bridge_source" > "$bridge_service/run"
printf '#!%s/bin/sh\nexec %s/bin/svlogd -tt "%s"\n' "$bridge_prefix" "$bridge_prefix" "$bridge_logs" > "$bridge_service/log/run"
printf '#!%s/bin/sh\n%s/bin/sv up "%s"\n' "$bridge_prefix" "$bridge_prefix" "$bridge_service" > "$bridge_home/.termux/boot/04-localdream-webbridge"
chmod 700 "$bridge_service/run" "$bridge_service/log/run" "$bridge_home/.termux/boot/04-localdream-webbridge"
"$bridge_prefix/bin/sv" up "$bridge_service"
