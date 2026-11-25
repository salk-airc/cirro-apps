import type { AtomSpec } from '3dmol';

// Matrix rows are alignment references; columns are the scored residues.
export type PaePoint = { x: number; y: number; value: number };

interface ResidueMarker {
  role: 'Aligned' | 'Scored' | 'Same residue';
  label: string;
  color: string;
  position: { x: number; y: number; z: number };
}

export function paeResidueMarkers(
  residues: readonly AtomSpec[], selection: PaePoint | undefined, residueCount: number,
): ResidueMarker[] {
  if (!selection || residues.length !== residueCount) return [];
  const marker = (index: number, role: ResidueMarker['role'], color: string): ResidueMarker | undefined => {
    if (!Number.isInteger(index) || index < 0) return;
    const atom = residues[index];
    if (!atom || !Number.isInteger(atom.resi)
        || ![atom.x, atom.y, atom.z].every((value) => typeof value === 'number' && Number.isFinite(value))) return;
    return {
      role, color,
      label: `${atom.chain || 'Unassigned'}:${atom.resi}${atom.icode?.trim() ?? ''} ${atom.resn ?? ''}`.trim(),
      position: { x: atom.x!, y: atom.y!, z: atom.z! },
    };
  };
  // C-alpha atoms retain PDB order, which the result validator checks against score order.
  // Never treat a matrix index as a PDB residue number: numbering can restart per chain.
  const aligned = marker(selection.y, selection.x === selection.y ? 'Same residue' : 'Aligned', '#b83d9e');
  const scored = marker(selection.x, 'Scored', '#00858b');
  if (!aligned || !scored) return [];
  return selection.x === selection.y ? [aligned] : [aligned, scored];
}
