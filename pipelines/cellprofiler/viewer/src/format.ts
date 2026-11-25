export function formatNumber(value: number | null | undefined, digits = 3): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return '—';
  if (Number.isInteger(value) && Math.abs(value) < 1e9) return value.toLocaleString();
  const abs = Math.abs(value);
  if (abs !== 0 && (abs < 1e-3 || abs >= 1e6)) return value.toExponential(2);
  return Number(value.toPrecision(digits)).toLocaleString(undefined, { maximumFractionDigits: 6 });
}

// CellProfiler names: AreaShape_Area, Intensity_MeanIntensity_DNA -> "AreaShape · Area"
export function prettyColumn(name: string): string {
  return name.split('_').join(' · ');
}
