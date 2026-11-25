#!/usr/bin/env nextflow
/*
 * sleap: pose estimation and tracking on videos with a lab's trained SLEAP model
 * (sleap-nn, https://github.com/talmolab/sleap-nn), with a viewer that plays each video
 * with the poses drawn on it (dataset → Visualize → Web Viewer).
 *
 * PREDICT → sleap-nn predict (+ tracking) per video, on a GPU when params.gpu (CPU otherwise).
 * EXPORT  → per video: .slp copy, SLEAP analysis HDF5, CSV, a browser-playable preview,
 *           and the compact pose file the viewer draws from.
 * REPORT  → index.json + the viewer.
 *
 * Containers are python:3.12-bookworm with sleap-nn installed by uv at run time (Nextflow
 * on AWS Batch needs `ps`; sleap-nn needs libEGL). Bake an image before wide use.
 */
nextflow.enable.dsl = 2

params.videos         = null          // video file(s), comma-separated
params.models         = null          // trained model folder(s), comma-separated (top-down: centroid + centered_instance)
params.outdir         = null          // set by Cirro
params.tracking       = true
params.max_instances  = 0             // 0 = no limit
params.tracker        = 'classic'
params.batch_size     = 4
params.gpu            = true
params.title          = 'SLEAP pose tracking'
params.sleap_nn_version = '0.3.5'
params.sleap_io_version = '0.9.6'

def flag(v) { v.toString().toLowerCase() in ['true', '1', 'yes'] }

def q(v) { "'" + v.toString().replace("'", "'\\''") + "'" }

def isVideo(String name) {
    name ==~ /(?i).*\.(mp4|avi|mov|mkv|mpg|mpeg|m4v|wmv|h264|webm)$/
}

process PREDICT {
    tag "${name}"
    label(flag(params.gpu) ? 'process_gpu' : 'process_cpu')
    container 'python:3.12-bookworm'
    cpus 8
    memory '30 GB'
    time '24h'

    input:
    tuple val(name), path(video, stageAs: 'video/*')
    path models, stageAs: 'models/model_?'

    output:
    tuple val(name), path(video), path("${name}.predictions.slp")

    script:
    def modelArgs = (models instanceof List ? models : [models]).collect { "-m ${it}" }.join(' ')
    def backend = flag(params.gpu) ? 'cu126' : 'cpu'
    def device = flag(params.gpu) ? 'cuda' : 'cpu'
    def tracking = flag(params.tracking) ? "-t --tracker ${params.tracker}" : ''
    def maxInstances = params.max_instances as int > 0 ? "-n ${params.max_instances}" : ''
    """
    apt-get update -qq && apt-get install -y -qq --no-install-recommends libegl1 libgl1 > /dev/null
    pip install --quiet --root-user-action=ignore --disable-pip-version-check 'uv==0.9.26'
    export UV_TOOL_BIN_DIR=/usr/local/bin
    uv tool install --quiet 'sleap-nn==${params.sleap_nn_version}' --torch-backend ${backend}
    if [ "${device}" = cuda ]; then nvidia-smi --query-gpu=name,memory.total --format=csv,noheader || true; fi
    sleap-nn predict --data_path ${video} ${modelArgs} -o ${name}.predictions.slp \\
        --device ${device} --batch_size ${params.batch_size} ${tracking} ${maxInstances}
    test -s ${name}.predictions.slp
    """
}

process EXPORT {
    tag "${name}"
    container 'python:3.12-bookworm'
    cpus 2
    memory '8 GB'

    input:
    tuple val(name), path(video), path(predictions)
    path export_script
    path preview_script

    output:
    path "videos/${name}", type: 'dir'

    script:
    """
    apt-get update -qq && apt-get install -y -qq --no-install-recommends ffmpeg > /dev/null
    pip install --quiet --root-user-action=ignore --disable-pip-version-check 'sleap-io==${params.sleap_io_version}'
    mkdir -p videos/${name}
    read fps width < <(bash ${preview_script} ${video} videos/${name}/preview.mp4)
    python3 ${export_script} ${predictions} --name ${q(name)} --out videos/${name} --fps "\$fps" --preview-width "\$width"
    """
}

process REPORT {
    container 'python:3.12-bookworm'
    cpus 1
    memory '2 GB'
    publishDir params.outdir, mode: 'copy'

    input:
    path exported, stageAs: 'in/*'
    path index_script
    path viewer, stageAs: 'viewer'
    val model_names

    output:
    path 'index.html'
    path 'assets/**'
    path 'index.json'
    path 'videos/**'

    script:
    def modelArgs = model_names.collect { "--model ${q(it)}" }.join(' ')
    """
    mkdir videos
    for d in in/*; do cp -RL "\$d" videos/; done
    python3 ${index_script} videos --title ${q(params.title)} ${modelArgs} \\
        --run "sleap-nn=${params.sleap_nn_version}" --run "Tracking=${flag(params.tracking) ? params.tracker : 'off'}" \\
        --run "Device=${flag(params.gpu) ? 'GPU' : 'CPU'}"
    cp -RL viewer/. .
    """
}

workflow {
    if (!params.videos) error "Set --videos to one or more video files."
    if (!params.models) error "Set --models to a trained SLEAP model folder (two for top-down: centroid and centered instance)."

    def models = params.models.toString().tokenize(',')*.trim().collect { file(it, type: 'dir') }
    models.each { m ->
        if (!m.exists()) error "Model folder not found: ${m}"
    }

    def videos = Channel
        .fromList(params.videos.toString().tokenize(',')*.trim())
        .map { file(it) }
        .filter { isVideo(it.name) }
        .map { f -> tuple(f.baseName.replaceAll(/[^A-Za-z0-9_.-]+/, '_'), f) }

    videos.map { it[0] }.collect().map { names ->
        def dupes = names.countBy { it }.findAll { it.value > 1 }.keySet()
        if (dupes) error "Videos must have different names; repeated: ${dupes.join(', ')}"
        if (!names) error "No video files (.mp4, .avi, .mov, ...) were picked."
    }

    PREDICT(videos, models)
    EXPORT(PREDICT.out, file("${projectDir}/scripts/export_poses.py"), file("${projectDir}/scripts/preview_video.sh"))
    REPORT(EXPORT.out.collect(), file("${projectDir}/scripts/build_index.py"),
           file("${projectDir}/viewer/dist"), models.collect { it.name })
}
