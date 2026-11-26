#!/usr/bin/env nextflow
/*
 * ddalab: Delay Differential Analysis (DDALAB, github.com/sdraeger/DDALAB) on physiological
 * recordings, with a viewer that draws each variant as a channel × time heatmap
 * (dataset → Visualize → Web Viewer).
 *
 * DDA    → `ddalab run` per recording; writes DDALAB's result document (<stem>.dda.json).
 * REPORT → index.json, a compact copy of each result for the viewer, a CSV per variant, viewer.
 *
 * Containers are python:3.12-bookworm (Nextflow on AWS Batch needs `ps`) with the ddalab wheel
 * from PyPI installed at run time; the wheel holds both the engine and the CLI.
 */
nextflow.enable.dsl = 2

params.recordings     = null          // recording file(s), comma-separated
params.outdir         = null          // set by Cirro
params.st             = true          // variants: single timeseries
params.ct             = false         // cross timeseries (needs ct_pairs)
params.cd             = false         // cross dynamical (needs cd_pairs)
params.de             = false         // dynamical ergodicity
params.sy             = false         // synchronization
params.wl             = 200           // window length, samples
params.ws             = 100           // window step, samples
params.delays         = '7 10'        // tau values, samples
params.channels       = ''            // 0-based channel indices; empty = every channel
params.ct_pairs       = ''            // "0,1 0,2"
params.cd_pairs       = ''            // "0,1 1,0" (directed)
params.reference      = 'none'        // none, average or bipolar
params.start          = 0             // seconds
params.end            = 0             // seconds; 0 = to the end
params.sr             = 0             // Hz, for text files only; 0 = from the file
params.title          = 'DDA results'
params.ddalab_version = '2.9.0'

def flag(v) { v.toString().toLowerCase() in ['true', '1', 'yes'] }

def q(v) { "'" + v.toString().replace("'", "'\\''") + "'" }

def words(v) { v ? v.toString().tokenize(' ,;\t') : [] }

def pairs(v) { v ? v.toString().tokenize(' ;\t') : [] }

def isRecording(String name) {
    name ==~ /(?i).*\.(edf|bdf|vhdr|set|fif|nwb|csv|tsv|txt|ascii|dat)$/
}

def stem(String name) { name.replaceFirst(/\.[^.]+$/, '') }

def ddaArgs() {
    def variants = ['st', 'ct', 'cd', 'de', 'sy'].findAll { flag(params[it]) }*.toUpperCase()
    def a = ["--variants ${variants.join(' ')}", "--wl ${params.wl as int}", "--ws ${params.ws as int}",
             "--delays ${words(params.delays).join(' ')}"]
    if (words(params.channels)) a << "--channels ${words(params.channels).join(' ')}"
    if ('CT' in variants) a << "--ct-pairs ${pairs(params.ct_pairs).join(' ')}"
    if ('CD' in variants) a << "--cd-pairs ${pairs(params.cd_pairs).join(' ')}"
    if (params.reference != 'none') a << "--reference ${params.reference}"
    if ((params.start as double) > 0) a << "--start ${params.start}"
    if ((params.end as double) > 0) a << "--end ${params.end}"
    if ((params.sr as double) > 0) a << "--sr ${params.sr}"
    a.join(' ')
}

process DDA {
    tag "${name}"
    container 'python:3.12-bookworm'
    cpus 4
    memory { 8.GB * task.attempt }
    time '24h'
    publishDir "${params.outdir}/results", mode: 'copy'
    errorStrategy { task.exitStatus in [137, 143] && task.attempt < 3 ? 'retry' : 'terminate' }
    maxRetries 2

    input:
    tuple val(name), path(files, stageAs: 'in/*')

    output:
    path "${stem(name)}.dda.json"

    script:
    """
    pip install --quiet --root-user-action=ignore --disable-pip-version-check ${q("ddalab==${params.ddalab_version}")}
    ddalab run --file ${q("in/${name}")} ${ddaArgs()} --quiet --compact -o ${q("${stem(name)}.dda.json")}
    """
}

process REPORT {
    container 'python:3.12-bookworm'
    cpus 1
    memory '4 GB'
    publishDir params.outdir, mode: 'copy'

    input:
    path results, stageAs: 'results/*'
    path script
    path viewer, stageAs: 'viewer'

    output:
    path 'index.html'
    path 'assets/**'
    path 'index.json'
    path 'view/*.json'
    path 'tables/*.csv'

    script:
    """
    python3 ${script} results/*.dda.json --title ${q(params.title)}
    cp -RL viewer/. .
    """
}

workflow {
    if (!params.recordings) error "Set --recordings to one or more recording files."
    def variants = ['st', 'ct', 'cd', 'de', 'sy'].findAll { flag(params[it]) }
    if (!variants) error "Turn on at least one variant (st, ct, cd, de, sy)."
    if ('ct' in variants && !pairs(params.ct_pairs)) error "CT needs channel pairs in ct_pairs, such as \"0,1 0,2\"."
    if ('cd' in variants && !pairs(params.cd_pairs)) error "CD needs directed channel pairs in cd_pairs, such as \"0,1 1,0\"."
    (pairs(params.ct_pairs) + pairs(params.cd_pairs)).each {
        if (!(it ==~ /\d+,\d+/)) error "Channel pair \"${it}\" must be two channel indices joined by a comma, such as 0,1."
    }
    (words(params.channels) + words(params.delays)).each {
        if (!(it ==~ /\d+/)) error "\"${it}\" in channels or delays is not a whole number."
    }
    if (!(params.reference in ['none', 'average', 'bipolar'])) error "reference must be none, average or bipolar."

    def picked = params.recordings.toString().tokenize(',')*.trim().collect { file(it) }
    def bad = picked.findAll { !isRecording(it.name) }
    if (bad) error "Not a recording DDALAB reads: ${bad*.name.join(', ')}. Pick .edf, .bdf, .vhdr, .set, .fif, .nwb or a text table."
    def stems = picked.collect { stem(it.name) }
    def twice = stems.findAll { s -> stems.count(s) > 1 }.unique()
    if (twice) error "Two recordings share the name ${twice.join(', ')}. Names must be unique across the picked files."

    // BrainVision (.vhdr with .eeg and .vmrk) and EEGLAB (.set with .fdt) keep their data beside
    // the header: stage those files from the same folder. resolveSibling, not "${f.parent}/...":
    // an S3 path turns into "/bucket/key" in a string, which Nextflow then reads as a local path.
    def sidecars = [vhdr: ['eeg', 'vmrk'], set: ['fdt']]
    def recordings = Channel.fromList(picked).map { f ->
        def ext = f.extension.toLowerCase()
        def extra = (sidecars[ext] ?: []).collect { f.resolveSibling("${stem(f.name)}.${it}") }.findAll { it.exists() }
        tuple(f.name, [f] + extra)
    }

    DDA(recordings)
    REPORT(DDA.out.collect(), file("${projectDir}/scripts/report.py"), file("${projectDir}/viewer/dist"))
}
