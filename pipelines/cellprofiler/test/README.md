`ExampleHuman/` is CellProfiler's own example (github.com/CellProfiler/examples, BSD-3; images CC0,
Moffat et al. 2006): one image set of human cells in three channels (DNA, PH3, cell body) and a
pipeline that finds nuclei, PH3-positive nuclei, cells and cytoplasm, measures them, and saves an
outline overlay. Expect 289 nuclei and 22 PH3 objects.

To exercise chunking locally, copy the image set under new site names (D01…D05) and run with
`--chunk_size 2`; see the pipeline README.
