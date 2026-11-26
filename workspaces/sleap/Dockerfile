# SLEAP labeling workspace for Cirro: the SLEAP desktop app on a virtual display, streamed to
# the browser with noVNC (the same pattern as Cirro's QuPath environment).
#
# Cirro workspace contract (docs.cirro.bio/features/workspaces/overview, "Image requirements"):
#   - web server on all interfaces at the "Local Web Server Port" (8080 here), proxied by Cirro
#   - Docker HEALTHCHECK healthy within 120 s
#   - /home/cirro is the persistent volume (mounted over the image path at launch), owned by UID 1000
#   - datasets read-only at /mnt/datasets and $HOME/datasets
FROM python:3.12-bookworm

ARG SLEAP_VERSION=1.6.6
ARG TORCH_INDEX=https://download.pytorch.org/whl/cpu

ENV DEBIAN_FRONTEND=noninteractive \
    UV_TOOL_DIR=/opt/uv-tools \
    UV_TOOL_BIN_DIR=/usr/local/bin \
    UV_PYTHON_INSTALL_DIR=/opt/uv-python \
    UV_HTTP_TIMEOUT=300 \
    DISPLAY=:1 \
    SCREEN_SIZE=1680x1050x24 \
    QT_QPA_PLATFORM=xcb \
    QT_X11_NO_MITSHM=1

# Virtual display, VNC, noVNC, a window manager, and the X/Qt libraries PySide6 needs.
RUN apt-get update && apt-get install -y --no-install-recommends \
        xvfb x11vnc x11-utils openbox novnc python3-websockify tini procps curl ffmpeg \
        fonts-dejavu-core xterm \
        libgl1 libegl1 libglib2.0-0 libdbus-1-3 libfontconfig1 libxkbcommon0 libxkbcommon-x11-0 \
        libxcb-cursor0 libxcb-icccm4 libxcb-image0 libxcb-keysyms1 libxcb-randr0 \
        libxcb-render-util0 libxcb-shape0 libxcb-xinerama0 libxcb-xkb1 libxcb-xfixes0 \
        libxrender1 libxi6 libxtst6 libsm6 libice6 \
    && rm -rf /var/lib/apt/lists/*

# SLEAP with the CPU build of PyTorch (labeling and predicting on a few frames; real training
# goes to the "Train Pose Model (SLEAP)" pipeline on a GPU).
RUN pip install --no-cache-dir --root-user-action=ignore 'uv==0.9.26' \
    && uv tool install "sleap[nn]==${SLEAP_VERSION}" --python 3.12 \
        --index "${TORCH_INDEX}" --index https://pypi.org/simple \
    && test -x /usr/local/bin/sleap-label

# The cirro user (UID 1000) whose home is the persistent volume.
RUN useradd --create-home --uid 1000 --shell /bin/bash cirro

COPY start.sh /opt/sleap-workspace/start.sh
COPY index.html /usr/share/novnc/index.html
COPY openbox-rc.xml /etc/xdg/openbox/rc.xml
RUN chmod +x /opt/sleap-workspace/start.sh

USER cirro
WORKDIR /home/cirro
EXPOSE 8080
HEALTHCHECK --interval=10s --timeout=5s --start-period=20s --retries=6 \
    CMD curl -fsS http://localhost:8080/vnc.html > /dev/null || exit 1
ENTRYPOINT ["/usr/bin/tini", "--"]
CMD ["/opt/sleap-workspace/start.sh"]
