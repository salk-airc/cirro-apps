#!/usr/bin/env bash
# Start the virtual display, the SLEAP app, VNC and noVNC. noVNC (websockify) is the web server
# Cirro proxies; it must stay in the foreground so the container lives as long as it does.
set -euo pipefail

export HOME="${HOME:-/home/cirro}"
mkdir -p "$HOME/sleap" "$HOME/.config"
cd "$HOME"

# A short note on first start: where data is and what persists.
if [ ! -f "$HOME/README-workspace.txt" ]; then
  cat > "$HOME/README-workspace.txt" <<'EOF'
SLEAP workspace (Salk AIRC, cirro-apps/workspaces/sleap)

  ~/datasets/   the datasets attached to this workspace (read-only)
  ~/sleap/      save your SLEAP projects here; everything under your home folder persists

When your labels are ready: File > Export Labels Package (include images), save it under ~/sleap,
then train with the "Train Pose Model (SLEAP)" pipeline in Cirro.
EOF
fi

Xvfb "$DISPLAY" -screen 0 "${SCREEN_SIZE}" -nolisten tcp &
for _ in $(seq 1 50); do xdpyinfo -display "$DISPLAY" >/dev/null 2>&1 && break; sleep 0.1; done

openbox &

# Keep SLEAP open: if the user closes it, bring it back.
(
  while true; do
    sleap-label || true
    sleep 1
  done
) > "$HOME/.sleap-label.log" 2>&1 &

x11vnc -display "$DISPLAY" -forever -shared -nopw -localhost -rfbport 5900 -quiet -noxdamage &

exec websockify --web /usr/share/novnc 0.0.0.0:8080 localhost:5900
