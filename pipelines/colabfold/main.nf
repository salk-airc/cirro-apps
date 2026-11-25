#!/usr/bin/env nextflow
/*
 * colabfold: protein structure prediction (AlphaFold2 through ColabFold) with an
 * interactive results viewer that opens in Cirro (dataset → Visualize → Web Viewer).
 *
 * MSA → ColabFold's public MMseqs2 server (CPU task; sequences leave Salk).
 * PREDICT → AlphaFold2 on one GPU, reading the MSAs, with no network use.
 * REPORT → results.json plus the static viewer (viewer/dist, adapted from salk-airc/fold).
 *
 * Every task uses python:3.12-bookworm and pip-installs ColabFold: Nextflow on AWS Batch
 * needs `ps` inside the container, which the official ColabFold image lacks.
 */
nextflow.enable.dsl = 2

params.input          = null        // FASTA file(s): a file, a folder, or comma-separated paths
params.outdir         = null        // set by Cirro
params.mode           = 'monomer'   // monomer: each sequence alone; complex: each FASTA file is one complex
params.num_models     = 5           // 1-5 AlphaFold2 models per prediction
params.num_recycles   = 3
params.msa_mode       = 'mmseqs2_uniref_env'
params.pair_mode      = 'unpaired_paired'
params.max_residues   = 2500
params.title          = 'Structure predictions'
params.colabfold_version = '1.6.2'
params.jax_version       = '0.10.2'

def q(v) { "'" + v.toString().replace("'", "'\\''") + "'" }

def pipInstall(String jaxExtra) {
    "pip install --quiet --no-cache-dir --root-user-action=ignore --disable-pip-version-check " +
    "'colabfold[alphafold]==${params.colabfold_version}' 'jax${jaxExtra}==${params.jax_version}'"
}

process PREP {
    container 'python:3.12-bookworm'
    cpus 1
    memory '2 GB'

    input:
    path fastas, stageAs: 'in/*'
    path script

    output:
    path 'queries', type: 'dir', emit: queries
    path 'jobs.tsv', emit: jobs

    script:
    """
    python3 ${script} in/* --mode ${params.mode} --max-residues ${params.max_residues}
    """
}

process MSA {
    container 'python:3.12-bookworm'
    cpus 2
    memory '8 GB'
    errorStrategy { task.attempt <= 3 ? 'retry' : 'terminate' }   // the public server rate-limits
    maxRetries 3

    input:
    path queries

    output:
    path 'msas', type: 'dir'

    script:
    """
    ${pipInstall('')}
    colabfold_batch ${queries} msas --msa-only \\
        --msa-mode ${params.msa_mode} --pair-mode ${params.pair_mode}
    ls msas/*.a3m > /dev/null
    """
}

process PREDICT {
    label 'process_gpu'
    container 'python:3.12-bookworm'
    accelerator 1
    cpus 8
    memory '30 GB'
    time '24h'

    input:
    path msas
    path jobs_tsv

    output:
    path 'predictions', type: 'dir', emit: predictions
    path 'run.tsv', emit: run

    script:
    """
    ${pipInstall('[cuda12]')}
    python3 - <<'PY'
import jax
gpus = jax.devices('gpu')
print('GPUs:', gpus)
PY
    # Weights are the same for every protein (~1.9 GB per set): fetch only the sets this run needs,
    # monomer (alphafold2_ptm) for single chains, multimer_v3 for complexes.
    mkdir -p params
    python3 - <<'PY'
import csv
from pathlib import Path
from colabfold.download import download_alphafold_params
chains = [int(r['chains']) for r in csv.DictReader(open('${jobs_tsv}'), delimiter='\\t')]
needed = (['alphafold2_ptm'] if any(c == 1 for c in chains) else []) + \\
         (['alphafold2_multimer_v3'] if any(c > 1 for c in chains) else [])
for model in needed:
    print('Downloading', model)
    download_alphafold_params(model, Path('params'))
PY
    mkdir -p a3m && cp ${msas}/*.a3m a3m/
    colabfold_batch a3m predictions --data params \\
        --model-type auto --num-models ${params.num_models} --num-recycle ${params.num_recycles} \\
        --rank auto --num-relax 0 --host-url http://127.0.0.1:9
    printf 'ColabFold\\t%s\\nJAX\\t%s\\nGPU\\t%s\\n' \\
        "${params.colabfold_version}" "${params.jax_version}" \\
        "\$(nvidia-smi --query-gpu=name --format=csv,noheader 2>/dev/null | head -1 || echo unknown)" > run.tsv
    """
}

process REPORT {
    container 'python:3.12-bookworm'
    cpus 1
    memory '4 GB'
    publishDir params.outdir, mode: 'copy'

    input:
    path predictions
    path msas
    path jobs_tsv
    path run_tsv
    path script
    path viewer, stageAs: 'viewer'

    output:
    path 'index.html'
    path 'assets/**'
    path 'results.json'
    path 'jobs/**'
    path 'log.txt', optional: true
    path 'raw/**'

    script:
    """
    run_args=\$(awk -F'\\t' '{printf "--run %s=%s ", \$1, \$2}' ${run_tsv})
    python3 ${script} ${predictions} ${jobs_tsv} --title ${q(params.title)} \\
        --run "Models per prediction=${params.num_models}" --run "Recycles=${params.num_recycles}" \\
        --run "MSA=ColabFold MMseqs2 server (${params.msa_mode})" \$run_args
    cp -RL viewer/. .
    mkdir -p raw && cp -RL ${predictions} raw/predictions && cp -RL ${msas} raw/msas && cp ${jobs_tsv} raw/
    """
}

workflow {
    if (!params.input) error "Set --input to a FASTA file or a folder of FASTA files."
    def fastas = Channel
        .fromList(params.input.toString().tokenize(','))
        .flatMap { p ->
            def f = file(p.trim())
            f.isDirectory()
                ? f.listFiles().findAll { it.name =~ /(?i)\.(fa|fasta|faa|fas)$/ }
                : [f]
        }
        .collect()

    PREP(fastas, file("${projectDir}/scripts/prep_queries.py"))
    MSA(PREP.out.queries)
    PREDICT(MSA.out, PREP.out.jobs)
    REPORT(PREDICT.out.predictions, MSA.out, PREP.out.jobs, PREDICT.out.run,
           file("${projectDir}/scripts/summarize.py"), file("${projectDir}/viewer/dist"))
}
