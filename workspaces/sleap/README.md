# SLEAP workspace

The [SLEAP](https://sleap.ai) desktop app in a Cirro workspace, streamed to the browser with
noVNC: label frames, proofread predictions, and export labels without installing anything. Built
the same way as Cirro's own QuPath environment.

Image: `ghcr.io/salk-airc/sleap-workspace:1.6.6` (built by
`.github/workflows/workspace-sleap.yml` on pushes to `main`).

## In Cirro

Create a workspace with **Environment → Custom** (needs the *Create Custom Workspace* permission):

| Field | Value |
|---|---|
| Container Image URI | `ghcr.io/salk-airc/sleap-workspace:1.6.6` |
| Local Web Server Port | `8080` |
| User, Command | leave blank |
| Datasets | attach the videos (and any existing labels) |
| Compute | 2–4 vCPU, 8 GiB RAM is plenty for labeling; no GPU |
| Auto-stop | set one (e.g. 8 hours) so a forgotten workspace stops on its own |

**Connect** opens SLEAP full-screen in the browser tab.

- `~/datasets/` holds the attached datasets (read-only).
- Save projects under `~/sleap/`. Only the home folder persists between restarts.
- To train: **File → Export Labels Package** (with images) into `~/sleap/`, then run
  *Train Pose Model (SLEAP)* on that file. A "Train in Cirro" button that does this from inside the
  workspace is the next step; Cirro does not give workspaces API credentials, so it will need a
  one-time sign-in.

## How it works

`start.sh` runs Xvfb (virtual display, 1680×1050), openbox, SLEAP (`sleap-label`, restarted if
closed), x11vnc on localhost, and websockify/noVNC on port 8080, which is the port Cirro proxies.
`index.html` opens noVNC with the websocket path worked out from the page URL, so it also works
behind a path prefix. The HEALTHCHECK polls noVNC. PyTorch is the CPU build: labeling and
predicting a few frames work, and real training belongs in the GPU pipeline.

## Run locally

```bash
docker build -t sleap-workspace workspaces/sleap
docker run --rm -p 8080:8080 -v "$PWD/home:/home/cirro" sleap-workspace
# open http://localhost:8080
```
