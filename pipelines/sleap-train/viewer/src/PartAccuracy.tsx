// Accuracy per body part on the validation frames (sleap-nn mPCK per part: share of
// points within the PCK distance thresholds). One series, one hue (training blue),
// sorted worst first so the parts that need more labels are on top. Bars start at the
// baseline with 4px rounded ends, 2px gaps; each bar carries its own value label.
export interface PartScore { name: string; pck: number | null }

export function PartAccuracy({ parts }: { parts: PartScore[] }) {
  const rows = parts.filter((p) => p.pck !== null).sort((a, b) => a.pck! - b.pck!);
  if (rows.length === 0) return null;
  return (
    <figure className="part-acc">
      <figcaption>
        <strong>Accuracy by body part</strong>
        <span className="muted"> · share of validation points placed close to the label (mPCK). Worst first.</span>
      </figcaption>
      <ol>
        {rows.map((p) => (
          <li key={p.name}>
            <span className="pa-name">{p.name}</span>
            <span className="pa-track" aria-hidden="true">
              <span className="pa-bar" style={{ width: `${Math.max(0.5, p.pck! * 100)}%` }} />
            </span>
            <span className="pa-val">{Math.round(p.pck! * 100)}%</span>
          </li>
        ))}
      </ol>
    </figure>
  );
}
