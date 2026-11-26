# Train Pose Model (SLEAP) main

Source: salk-airc/cirro-apps at `main`

## Inputs

- **labels** — Your labeled frames as a SLEAP labels package (.pkg.slp). In SLEAP, File → Export Labels Package (include the images), so the file holds the frames it was labeled on.
- **val_labels** — Optional separate validation labels (.pkg.slp). Leave empty to hold out 10% of the labeled frames.

## Requirements on your input data

- **labels** — Must contain its images (a .pkg.slp labels package). A plain .slp points at videos on the labeler's computer, which the run cannot reach.
- **compute** — With gpu on, TRAIN uses Cirro's GPU queue; the project's GPU limit must be above 0.
