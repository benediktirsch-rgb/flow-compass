#!/usr/bin/env bash
# install.sh — richtet den Compass-Server auf einem frischen Ubuntu 24.04 ein und hält ihn aktuell.
#
#   Läuft als root auf dem Wolkenserver, aufgerufen von deploy-wolkenserver.ps1 (vom eigenen Rechner per SSH).
#   Idempotent: jeder Lauf bringt Paket, Konfiguration, Daten und Dienst auf den Stand des Ordners $QUELLE.
#
#   Umgebung:  WOLKE_HOST   öffentlicher Name (z. B. wolke.vishnuartists.com oder 1-2-3-4.sslip.io)
#              WOLKE_PFAD   geheimer Pfadanfang, unter dem Caddy die API durchreicht (/<pfad>/api/…)
#   Aufruf:    WOLKE_HOST=… WOLKE_PFAD=… bash install.sh /tmp/compass-deploy
#
#   Was am Ende steht
#     /opt/compass-server/            das Paket aus produkt/server (compass-server.ps1, coach-*.ps1, vorlagen/)
#     /var/lib/compass-server/daten/  persona.md, PROFIL.md, pipeline.md, TASKS.md, coaching/ … (Besitz: compass)
#     /etc/compass-server/            compass-server.json (Konfiguration) + env (Schlüssel, 600, nur root)
#     /etc/systemd/system/compass-server.service   pwsh -File compass-server.ps1, Neustart bei Absturz
#     /etc/caddy/Caddyfile            https://$WOLKE_HOST/$WOLKE_PFAD/* → http://localhost:8787/* (Let's Encrypt)
#     ufw                             nur 22, 80, 443 offen; 8787 bleibt auf localhost
set -euo pipefail
HOST="${WOLKE_HOST:?WOLKE_HOST fehlt}"
PFAD="${WOLKE_PFAD:?WOLKE_PFAD fehlt}"
QUELLE="${1:-/tmp/compass-deploy}"
[ -d "$QUELLE/paket" ] || { echo "Paket fehlt: $QUELLE/paket" >&2; exit 2; }
export DEBIAN_FRONTEND=noninteractive
log() { printf '\n== %s\n' "$*"; }

log "Grundpakete"
apt-get update -q
apt-get install -y -q curl ca-certificates gnupg apt-transport-https ufw locales >/dev/null

log "Zeitzone Europe/Berlin, Sprache de_DE (Datumsangaben des Coachs)"
timedatectl set-timezone Europe/Berlin || true
if ! grep -q '^de_DE.UTF-8 UTF-8' /etc/locale.gen; then
  sed -i 's/^# *de_DE.UTF-8 UTF-8/de_DE.UTF-8 UTF-8/' /etc/locale.gen
  grep -q '^de_DE.UTF-8 UTF-8' /etc/locale.gen || echo 'de_DE.UTF-8 UTF-8' >> /etc/locale.gen
  locale-gen >/dev/null
fi

log "PowerShell 7"
if ! command -v pwsh >/dev/null 2>&1; then
  ARCH=$(dpkg --print-architecture)
  if [ "$ARCH" = "amd64" ]; then
    . /etc/os-release
    curl -fsSL "https://packages.microsoft.com/config/ubuntu/${VERSION_ID}/packages-microsoft-prod.deb" -o /tmp/packages-microsoft-prod.deb
    dpkg -i /tmp/packages-microsoft-prod.deb >/dev/null
    apt-get update -q
    apt-get install -y -q powershell >/dev/null
  else
    # arm64 (Hetzner CAX): Microsoft liefert kein apt-Paket, aber ein Tar-Archiv je Release.
    apt-get install -y -q libicu74 libssl3t64 libgssapi-krb5-2 libstdc++6 zlib1g >/dev/null 2>&1 \
      || apt-get install -y -q libicu74 libssl3 libgssapi-krb5-2 libstdc++6 zlib1g >/dev/null
    URL=$(curl -fsSL https://api.github.com/repos/PowerShell/PowerShell/releases/latest | grep -o 'https://[^"]*linux-arm64\.tar\.gz' | head -1)
    [ -n "$URL" ] || { echo "PowerShell-Archiv für arm64 nicht gefunden" >&2; exit 2; }
    mkdir -p /opt/microsoft/powershell/7
    curl -fsSL "$URL" | tar -xz -C /opt/microsoft/powershell/7
    chmod +x /opt/microsoft/powershell/7/pwsh
    ln -sf /opt/microsoft/powershell/7/pwsh /usr/bin/pwsh
  fi
fi
pwsh -NoProfile -Command '"pwsh " + $PSVersionTable.PSVersion'

log "Caddy (Reverse-Proxy mit automatischem Zertifikat)"
if ! command -v caddy >/dev/null 2>&1; then
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' > /etc/apt/sources.list.d/caddy-stable.list
  apt-get update -q
  apt-get install -y -q caddy >/dev/null
fi
caddy version
# Zugriffs-Log: ohne den Ordner stirbt Caddy beim Laden der Konfiguration (so am 14.09.2026 beim ersten Lauf).
install -d -o caddy -g caddy -m 755 /var/log/caddy

# PowerShell schreibt auf Linux jede Skriptblock-Erzeugung als Warnung ins Journal — auf Fehler beschraenken.
PSHOME_DIR=$(pwsh -NoProfile -Command '$PSHOME' 2>/dev/null || true)
if [ -n "$PSHOME_DIR" ] && [ -d "$PSHOME_DIR" ] && [ ! -f "$PSHOME_DIR/powershell.config.json" ]; then
  printf '{ "LogLevel": "Error" }\n' > "$PSHOME_DIR/powershell.config.json"
fi

log "Firewall: 22, 80, 443"
ufw allow OpenSSH >/dev/null
ufw allow 80/tcp >/dev/null
ufw allow 443/tcp >/dev/null
ufw --force enable >/dev/null
ufw status | head -8

log "Dienstbenutzer und Ordner"
id -u compass >/dev/null 2>&1 || useradd -r -m -d /home/compass -s /bin/bash compass
install -d -o compass -g compass -m 750 /opt/compass-server /opt/compass-server/vorlagen
install -d -o compass -g compass -m 750 /var/lib/compass-server /var/lib/compass-server/daten /var/lib/compass-server/daten/coaching
install -d -o root -g compass -m 750 /etc/compass-server

log "Paket nach /opt/compass-server"
cp "$QUELLE"/paket/*.ps1 "$QUELLE"/paket/README.md /opt/compass-server/
cp "$QUELLE"/paket/vorlagen/* /opt/compass-server/vorlagen/
[ -f "$QUELLE/paket/VERSION.txt" ] && cp "$QUELLE/paket/VERSION.txt" /opt/compass-server/
chown -R compass:compass /opt/compass-server

log "Konfiguration, Schlüssel, Daten"
if [ -f "$QUELLE/compass-server.json" ]; then
  install -o root -g compass -m 640 "$QUELLE/compass-server.json" /etc/compass-server/compass-server.json
fi
[ -f /etc/compass-server/compass-server.json ] || { echo "compass-server.json fehlt" >&2; exit 2; }
if [ -f "$QUELLE/env" ]; then
  install -o root -g root -m 600 "$QUELLE/env" /etc/compass-server/env
elif [ ! -f /etc/compass-server/env ]; then
  install -o root -g root -m 600 /dev/null /etc/compass-server/env
fi
if [ -d "$QUELLE/daten" ]; then
  for f in "$QUELLE"/daten/*.md; do
    [ -e "$f" ] || continue
    n=$(basename "$f")
    # TASKS.md schreibt der Coach auf dem Server selbst — nur beim ersten Mal übernehmen.
    if [ "$n" = "TASKS.md" ] && [ -f /var/lib/compass-server/daten/TASKS.md ]; then continue; fi
    install -o compass -g compass -m 640 "$f" "/var/lib/compass-server/daten/$n"
  done
fi
ls -la /var/lib/compass-server/daten | sed -n '1,20p'

log "Claude Code für den Dienstbenutzer (Abo-Weg)"
if [ ! -x /home/compass/.local/bin/claude ]; then
  su - compass -c 'curl -fsSL https://claude.ai/install.sh | bash' || echo "WARNUNG: Claude Code nicht installiert — der Server läuft, der Coach meldet NO_CLI."
fi
[ -x /home/compass/.local/bin/claude ] && su - compass -c '~/.local/bin/claude --version' || true

log "Dienst compass-server"
install -o root -g root -m 644 "$QUELLE/compass-server.service" /etc/systemd/system/compass-server.service
systemctl daemon-reload
systemctl enable compass-server >/dev/null 2>&1 || true
systemctl restart compass-server

log "Caddy: https://$HOST/$PFAD/ → localhost:8787"
sed -e "s|{{HOST}}|$HOST|g" -e "s|{{PFAD}}|$PFAD|g" "$QUELLE/Caddyfile.tmpl" > /etc/caddy/Caddyfile
caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile >/dev/null
systemctl enable caddy >/dev/null 2>&1 || true
systemctl reload caddy 2>/dev/null || systemctl restart caddy

log "Probe"
sleep 3
systemctl --no-pager --lines=6 status compass-server || true
echo
curl -s -m 20 http://localhost:8787/api/john/status | head -c 400; echo
echo
echo "Fertig. Von außen: https://$HOST/$PFAD/api/john/status (Zertifikat kommt beim ersten Aufruf, bis zu einer Minute)."
