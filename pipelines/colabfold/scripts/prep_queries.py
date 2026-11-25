#!/usr/bin/env python3
"""Turn FASTA files into one ColabFold query per prediction.

mode "monomer": every sequence record is its own prediction.
mode "complex": every FASTA file is one prediction; its records are the chains.
A record whose sequence already contains ':' is passed through as a complex either way
(ColabFold's own notation for chains).

Writes queries/<job>.fasta and jobs.tsv (job, name, chains, lengths).
"""
import argparse
import re
import sys
from pathlib import Path

AMINO = set("ACDEFGHIKLMNPQRSTVWYXBZUO")


def read_fasta(path: Path):
    name, seq, records = None, [], []
    for raw in path.read_text().splitlines():
        line = raw.strip()
        if not line:
            continue
        if line.startswith(">"):
            if name is not None:
                records.append((name, "".join(seq)))
            name, seq = line[1:].strip() or path.stem, []
        else:
            seq.append(re.sub(r"\s+", "", line).upper().rstrip("*"))
    if name is not None:
        records.append((name, "".join(seq)))
    return records


def slug(text: str, used: set) -> str:
    first = re.split(r"[\s|]+", text.strip())[0] if text.strip() else "query"
    base = re.sub(r"[^A-Za-z0-9_.-]+", "_", first).strip("_.")[:60] or "query"
    candidate, n = base, 2
    while candidate.lower() in used:
        candidate, n = f"{base}_{n}", n + 1
    used.add(candidate.lower())
    return candidate


def check(name: str, chains: list[str], max_residues: int):
    for chain in chains:
        bad = set(chain) - AMINO
        if not chain:
            sys.exit(f"Sequence '{name}' is empty.")
        if bad:
            sys.exit(f"Sequence '{name}' has characters that are not amino acids: {''.join(sorted(bad))}. "
                     "Nucleotide sequences cannot be folded.")
    total = sum(len(c) for c in chains)
    if total > max_residues:
        sys.exit(f"Prediction '{name}' has {total} residues, above the limit of {max_residues}. "
                 "Raise max_residues or split the input.")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("fastas", nargs="+", type=Path)
    ap.add_argument("--mode", choices=["monomer", "complex"], default="monomer")
    ap.add_argument("--max-residues", type=int, default=2500)
    args = ap.parse_args()

    out = Path("queries")
    out.mkdir()
    used: set = set()
    jobs = []
    for fasta in sorted(args.fastas):
        records = read_fasta(fasta)
        if not records:
            sys.exit(f"{fasta.name} has no FASTA records.")
        if args.mode == "complex" and len(records) > 1:
            chains = [s for _, s in records]
            jobs.append((slug(fasta.stem, used), fasta.stem, chains))
        else:
            for name, seq in records:
                jobs.append((slug(name, used), name, [c for c in seq.split(":") if c]))

    with open("jobs.tsv", "w") as tsv:
        tsv.write("job\tname\tchains\tlengths\n")
        for job, name, chains in jobs:
            check(name, chains, args.max_residues)
            (out / f"{job}.fasta").write_text(f">{job}\n{':'.join(chains)}\n")
            tsv.write(f"{job}\t{name}\t{len(chains)}\t{'+'.join(str(len(c)) for c in chains)}\n")
    print(f"{len(jobs)} predictions from {len(args.fastas)} FASTA file(s)", file=sys.stderr)


if __name__ == "__main__":
    main()
