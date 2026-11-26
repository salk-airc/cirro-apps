#!/usr/bin/env nextflow
/*
 * sleap-train: train a SLEAP pose model with sleap-nn (https://github.com/talmolab/sleap-nn)
 * from a lab's labeled frames, and publish model folders that "Track Animal Poses (SLEAP)"
 * (pipelines/sleap) takes as its model input. The viewer shows the training curves.
 *
 * TRAIN  → one task per model part (top-down = centroid + centered instance, in parallel),
 *          on a GPU when params.gpu, from sleap-nn's own sample configs (configs/, v0.3.5).
 * REPORT → models/<part>/ (best.ckpt, training_config.yaml, training_log.csv, ...),
 *          summary.json and the viewer.
 *
 * Nextflow 25.10 (Cirro): no script-function calls inside process directives.
 */
nextflow.enable.dsl = 2

params.labels        = null          // labels package (.pkg.slp, exported from SLEAP with images)
params.val_labels    = null          // optional separate validation labels; else 10% held out
params.outdir        = null          // set by Cirro
params.model_type    = 'single_instance'   // single_instance | topdown | bottomup
params.model_size    = 'medium'      // medium | large receptive field
params.max_epochs    = 200
params.batch_size    = 4
params.input_scale   = 0             // 0 = the preset's own scale
params.gpu           = true
params.title         = 'SLEAP model training'
params.sleap_nn_version = '0.3.5'

def q(v) { "'" + v.toString().replace("'", "'\\''") + "'" }

def isTrue(v) { v.toString().toLowerCase() in ['true', '1', 'yes'] }

def partsFor(String type, String size) {
    switch (type) {
        case 'single_instance': return [['single_instance', "single_instance_unet_${size}_rf"]]
        case 'topdown':         return [['centroid', 'centroid_unet'], ['centered_instance', "topdown_centered_instance_unet_${size}_rf"]]
        case 'bottomup':        return [['bottomup', "bottomup_unet_${size}_rf"]]
        default: error "model_type must be single_instance, topdown or bottomup, not ${type}"
    }
}

process TRAIN {
    tag "${part}"
    label(params.gpu.toString().toLowerCase() in ['true', '1', 'yes'] ? 'process_gpu' : 'process_cpu')
    container 'python:3.12-bookworm'
    cpus 8
    memory '30 GB'
    time '48h'

    input:
    tuple val(part), path(config)
    path labels, stageAs: 'labels/*'
    path val_labels, stageAs: 'val/*'

    output:
    path "models/${part}", type: 'dir'

    script:
    def gpu = isTrue(params.gpu)
    def val = val_labels.name.startsWith('NO_FILE') ? 'null' : "[${val_labels}]"
    def scale = (params.input_scale as double) > 0 ? "data_config.preprocessing.scale=${params.input_scale}" : ''
    """
    export UV_HTTP_TIMEOUT=300
    apt-get update -qq && apt-get install -y -qq --no-install-recommends libegl1 libgl1 > /dev/null
    pip install --quiet --root-user-action=ignore --disable-pip-version-check 'uv==0.9.26'
    export UV_TOOL_BIN_DIR=/usr/local/bin
    uv tool install --quiet 'sleap-nn==${params.sleap_nn_version}' --torch-backend ${gpu ? 'cu126' : 'cpu'}
    if [ "${gpu}" = true ]; then nvidia-smi --query-gpu=name,memory.total --format=csv,noheader || true; fi
    sleap-nn train --config ${config} \\
        "data_config.train_labels_path=[${labels}]" "data_config.val_labels_path=${val}" ${scale} \\
        trainer_config.max_epochs=${params.max_epochs} \\
        trainer_config.train_data_loader.batch_size=${params.batch_size} \\
        trainer_config.val_data_loader.batch_size=${params.batch_size} \\
        trainer_config.trainer_accelerator=${gpu ? 'gpu' : 'cpu'} \\
        trainer_config.ckpt_dir=models trainer_config.run_name=${part} \\
        trainer_config.visualize_preds_during_training=false trainer_config.enable_progress_bar=false
    test -s models/${part}/best.ckpt
    """
}

process REPORT {
    container 'python:3.12-bookworm'
    cpus 1
    memory '2 GB'
    publishDir params.outdir, mode: 'copy'

    input:
    path trained, stageAs: 'in/*'
    path summary_script
    path viewer, stageAs: 'viewer'

    output:
    path 'index.html'
    path 'assets/**'
    path 'summary.json'
    path 'models/**'

    script:
    """
    pip install --quiet --root-user-action=ignore --disable-pip-version-check 'pyyaml==6.0.3'
    mkdir models
    for d in in/*; do cp -RL "\$d" models/; done
    python3 ${summary_script} models --title ${q(params.title)} --model-type ${params.model_type} \\
        --run "sleap-nn=${params.sleap_nn_version}" --run "Preset size=${params.model_size}" \\
        --run "Max epochs=${params.max_epochs}" --run "Batch size=${params.batch_size}" \\
        --run "Device=${isTrue(params.gpu) ? 'GPU' : 'CPU'}"
    cp -RL viewer/. .
    """
}

workflow {
    if (!params.labels) error "Set --labels to a SLEAP labels package (.pkg.slp exported with images)."
    def labels = file(params.labels)
    if (!labels.exists()) error "Labels file not found: ${params.labels}"
    if (!labels.name.toLowerCase().endsWith('.slp'))
        error "--labels must be a SLEAP .slp/.pkg.slp file, not ${labels.name}."
    def val = params.val_labels ? file(params.val_labels) : file("${projectDir}/assets/NO_FILE_val")

    def parts = Channel.fromList(partsFor(params.model_type.toString(), params.model_size.toString()))
        .map { part, preset -> tuple(part, file("${projectDir}/configs/${preset}.yaml")) }

    TRAIN(parts, labels, val)
    REPORT(TRAIN.out.collect(), file("${projectDir}/scripts/summarize_training.py"), file("${projectDir}/viewer/dist"))
}
