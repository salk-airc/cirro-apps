Test inputs (copied from salk-airc/fold `fixtures/`, RCSB PDB FASTA, CC0):

- `1ubq.fasta`: human ubiquitin, one chain (76 aa). Expect mean pLDDT ≈ 95.
- `barnase-barstar.fasta`: the 1BRS complex, two chains (89 + 110 aa). Run with `mode=complex`; expect ipTM ≈ 0.9.

Fold's Kaggle P100 reference results for both are in salk-airc/fold `demo/`.
