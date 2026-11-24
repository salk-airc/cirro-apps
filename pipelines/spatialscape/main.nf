#!/usr/bin/env nextflow
/*
 * spatialscape-cirro: turn 10x Xenium output folders into a spatialscape browser
 * (https://github.com/MicTott/spatialscape), a static website of the sections side by side.
 *
 * Only the small per-cell files of each Xenium run are read (matrix, cells, outlines, clusters);
 * the multi-GB morphology images are never staged.
 */
nextflow.enable.dsl = 2

params.samplesheet   = null      // CSV: sample, xenium_dir, condition, age
params.outdir        = null      // set by Cirro
params.dataset_name  = 'Spatial browser'
params.description   = ''
params.default_gene  = ''
params.spatialscape_version = '1.0.0'

// single-quote a value for the shell, safe for apostrophes in names
def q(v) { "'" + v.toString().replace("'", "'\\''") + "'" }

def optionalFile(String dir, String rel) {
    def f = file("${dir}/${rel}")
    return f.exists() ? f : file("${projectDir}/assets/NO_FILE_${rel.tokenize('/').last()}")
}

process TO_H5AD {
    tag "${sample}"
    container 'python:3.12-slim'
    cpus 2
    memory '8 GB'

    input:
    tuple val(sample), val(condition), val(age), path(matrix), path(cells), path(boundaries), path(clusters), path(umap)
    path script

    output:
    tuple val(sample), val(condition), val(age), path("${sample}", type: 'dir')

    script:
    def cond = condition ? "--condition ${q(condition)}" : ''
    def ag   = age ? "--age ${q(age)}" : ''
    """
    pip install --quiet --no-cache-dir --root-user-action=ignore --disable-pip-version-check 'spatialscape==${params.spatialscape_version}'
    mkdir -p xen/analysis/clustering/gene_expression_graphclust xen/analysis/umap/gene_expression_2_components '${sample}'
    ln -s "\$PWD/${matrix}" xen/cell_feature_matrix.h5
    ln -s "\$PWD/${cells}"  xen/cells.parquet
    [[ "${clusters}" == NO_FILE* ]] || ln -s "\$PWD/${clusters}" xen/analysis/clustering/gene_expression_graphclust/clusters.csv
    [[ "${umap}" == NO_FILE* ]]     || ln -s "\$PWD/${umap}"     xen/analysis/umap/gene_expression_2_components/projection.csv
    [[ "${boundaries}" == NO_FILE* ]] || cp "${boundaries}" '${sample}/cell_boundaries.parquet'
    python3 ${script} xen '${sample}/adata.h5ad' ${cond} ${ag}
    """
}

process BUILD_SITE {
    container 'python:3.12-slim'
    cpus 4
    memory '16 GB'
    publishDir params.outdir, mode: 'copy'

    input:
    path samples_tsv
    path inputs, stageAs: 'in/*'
    path script

    output:
    path 'site/**'
    path 'dataset.yaml'

    script:
    def desc = params.description ? "--description ${q(params.description)}" : ''
    def gene = params.default_gene ? "--default-gene ${q(params.default_gene)}" : ''
    """
    pip install --quiet --no-cache-dir --root-user-action=ignore --disable-pip-version-check 'spatialscape==${params.spatialscape_version}' pyyaml
    python3 ${script} ${samples_tsv} --id spatial --name ${q(params.dataset_name)} ${desc} ${gene} > dataset.yaml
    spatialscape build dataset.yaml
    spatialscape site build bundles -o site
    spatialscape validate site/spatial
    """
}

workflow {
    if (!params.samplesheet) error "Set --samplesheet (CSV with sample, xenium_dir columns)"
    if (!params.outdir)      error "Set --outdir"

    rows = Channel.fromPath(params.samplesheet)
        .splitCsv(header: true)
        .map { r ->
            def d = r.xenium_dir.toString().replaceAll('/+$', '')
            tuple(r.sample, r.condition ?: '', r.age ?: '',
                  file("${d}/cell_feature_matrix.h5", checkIfExists: true),
                  file("${d}/cells.parquet", checkIfExists: true),
                  optionalFile(d, 'cell_boundaries.parquet'),
                  optionalFile(d, 'analysis/clustering/gene_expression_graphclust/clusters.csv'),
                  optionalFile(d, 'analysis/umap/gene_expression_2_components/projection.csv'))
        }

    // scripts are passed in as files so the pipeline works from a monorepo subfolder on any executor
    converted = TO_H5AD(rows, file("${projectDir}/scripts/xenium_to_h5ad.py", checkIfExists: true))

    // one row per section for the yaml; paths point at the staged copies under in/<sample>/
    tsv = converted
        .map { s, c, a, dir -> "${s}\tin/${s}/adata.h5ad\t${dir.resolve('cell_boundaries.parquet').exists() ? "in/${s}/cell_boundaries.parquet" : ''}\t${c}\t${a}" }
        .collectFile(name: 'samples.tsv', newLine: true, seed: "sample\th5ad\tpolygons\tcondition\tage", sort: true)

    files = converted.map { s, c, a, dir -> dir }.collect()

    BUILD_SITE(tsv, files, file("${projectDir}/scripts/make_dataset_yaml.py", checkIfExists: true))
}
