#!/usr/bin/env nextflow
/*
 * cellprofiler: run a lab's CellProfiler pipeline (.cppipe) on folders of microscope images,
 * split into chunks that run in parallel, and open the merged measurements in a viewer
 * (dataset → Visualize → Web Viewer).
 *
 * PLAN   → CellProfiler matches file NAMES into image sets (empty placeholder files: no
 *          image is downloaded) and writes one file list per chunk.
 * RUN    → one task per chunk, staging only that chunk's images.
 * REPORT → merged CSVs, image-set numbers made run-wide, histograms, thumbnails, viewer.
 */
nextflow.enable.dsl = 2

params.images        = null          // folder(s) of images, comma-separated
params.pipeline      = null          // the lab's .cppipe
params.outdir        = null          // set by Cirro
params.chunk_size    = 50            // image sets per task
params.title         = 'CellProfiler results'
params.cellprofiler_container = 'quay.io/biocontainers/cellprofiler:4.2.8.1--pyhdfd78af_0'  // Bioconda build: no entrypoint, has ps

def isImage(String name) {
    name ==~ /(?i).*\.(tif|tiff|png|jpg|jpeg|bmp|gif|c01|dib|flex|nd2|czi|lif|zvi|lsm|oib|oif|ims|stk)$/
}

def q(v) { "'" + v.toString().replace("'", "'\\''") + "'" }

process PLAN {
    container params.cellprofiler_container
    cpus 1
    memory '4 GB'

    input:
    path names
    path cppipe
    path script

    output:
    path 'chunks/*.txt', emit: chunks
    path 'summary.json', emit: summary

    script:
    """
    mkdir ph
    while IFS= read -r name; do [ -n "\$name" ] && : > "ph/\$name"; done < ${names}
    find "\$PWD/ph" -type f | sort | sed 's#^#file://#' > files.txt
    python3 ${script} ${cppipe} files.txt --chunk-size ${params.chunk_size}
    """
}

process RUN {
    tag "${id}"
    container params.cellprofiler_container
    cpus 1
    memory { 6.GB * task.attempt }
    errorStrategy { task.exitStatus in [137, 143] && task.attempt < 3 ? 'retry' : 'terminate' }
    maxRetries 2

    input:
    tuple val(id), path(images, stageAs: 'in/*')
    path cppipe

    output:
    path "out_${id}", type: 'dir'

    script:
    """
    set -o pipefail
    find "\$PWD/in" -type f -o -type l | sort | sed 's#^#file://#' > files.txt
    cellprofiler -c -r -p ${cppipe} --file-list files.txt -o out_${id} 2>&1 | tee run.log
    grep -q 'Error' run.log && grep -E 'Error|Traceback' run.log | head -20 >&2 || true
    ls out_${id}/*.csv > /dev/null 2>&1 || { echo "CellProfiler wrote no CSV for ${id}" >&2; exit 1; }
    cp run.log out_${id}/cellprofiler_${id}.log
    """
}

process REPORT {
    container 'python:3.12-bookworm'
    cpus 2
    memory '8 GB'
    publishDir params.outdir, mode: 'copy'

    input:
    path outs, stageAs: 'chunk/*'
    path summary
    path cppipe
    path script
    path viewer, stageAs: 'viewer'

    output:
    path 'index.html'
    path 'assets/**'
    path 'data.json'
    path 'tables/**'
    path 'outputs/**', optional: true
    path 'thumbs/**', optional: true
    path 'logs/**'
    path 'pipeline/**'

    script:
    """
    pip install --quiet --no-cache-dir --root-user-action=ignore --disable-pip-version-check 'pillow==11.3.0' 'numpy==2.3.4'
    for d in chunk/*; do cp -RL "\$d" "\$(basename \$d)"; done
    mkdir -p logs pipeline && mv out_*/cellprofiler_*.log logs/ 2>/dev/null || true
    cp ${cppipe} ${summary} pipeline/
    python3 ${script} out_* --title ${q(params.title)} --pipeline-name ${q(cppipe.name)} \\
        --run "CellProfiler=${params.cellprofiler_container.tokenize(':')[-1].tokenize('-')[0]}" --run "Image sets per task=${params.chunk_size}"
    cp -RL viewer/. .
    rm -rf out_*
    """
}

workflow {
    if (!params.images)   error "Set --images to a folder of images."
    if (!params.pipeline) error "Set --pipeline to a CellProfiler .cppipe file."
    def cppipe = file(params.pipeline)
    if (!cppipe.name.toLowerCase().endsWith('.cppipe'))
        error "--pipeline must be a .cppipe file (File > Export > Pipeline in CellProfiler), not ${cppipe.name}."

    def images = Channel
        .fromList(params.images.toString().tokenize(',')*.trim())
        .flatMap { dir -> file("${dir}/**", type: 'file') }
        .filter { isImage(it.name) }

    def byName = images
        .map { [it.name, it] }
        .collect(flat: false)
        .map { pairs ->
            def seen = [:]
            pairs.each { name, f ->
                if (seen.containsKey(name)) error "Two images share the file name ${name} (${seen[name]} and ${f}). File names must be unique across the picked folders."
                seen[name] = f
            }
            seen
        }

    def names = images.map { it.name }.collectFile(name: 'names.txt', newLine: true, sort: true)

    PLAN(names, cppipe, file("${projectDir}/scripts/plan_chunks.py"))

    def chunkFiles = PLAN.out.chunks
        .flatten()
        .combine(byName)
        .map { list, lookup -> tuple(list.baseName, list.readLines().findAll { it }.collect { lookup[it] }) }

    RUN(chunkFiles, cppipe)
    REPORT(RUN.out.collect(), PLAN.out.summary, cppipe,
           file("${projectDir}/scripts/report.py"), file("${projectDir}/viewer/dist"))
}
