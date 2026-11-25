# Measure Cells (CellProfiler) main

Source: salk-airc/cirro-apps at `main`

## Inputs

- **images** — Folder(s) of microscope images. Every image file inside (any depth) is offered to the pipeline; its own Images and NamesAndTypes rules decide what is used.
- **pipeline** — Your CellProfiler pipeline (.cppipe, from File > Export > Pipeline). It must use Images/NamesAndTypes (not LoadData) and have an ExportToSpreadsheet module.

## Requirements on your input data

- **pipeline** — Exported .cppipe (not .cpproj). Images come in through Images/Metadata/NamesAndTypes; LoadData is refused. ExportToSpreadsheet must be enabled. Checked by PLAN before any image is downloaded.
- **images** — File names must be unique across the picked folders (a chunk stages files flat).
