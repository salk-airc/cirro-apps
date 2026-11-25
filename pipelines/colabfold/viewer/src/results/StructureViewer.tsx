import { useEffect, useMemo, useRef, useState } from 'react';
import { ImageDownIcon, MoonIcon, SunIcon } from 'lucide-react';
import type { AtomSpec, GLViewer } from '3dmol';
import { getStructure } from '../api';
import { StructureControls, viewActionForKey, type ViewAction } from './StructureControls';
import { paeResidueMarkers, type PaePoint } from './paeSelection';

function confidenceColor(value: number): string {
  if (value >= 90) return '#0053d6';
  if (value >= 70) return '#65cbf3';
  if (value >= 50) return '#ffdb13';
  return '#ff7d45';
}

function backgroundColor(element: HTMLElement): string {
  // Let the browser convert CSS colors to the hex format accepted by 3Dmol.
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 1;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('The browser could not prepare the structure background.');
  context.fillStyle = getComputedStyle(element).backgroundColor;
  context.fillRect(0, 0, 1, 1);
  const [red, green, blue] = context.getImageData(0, 0, 1, 1).data;
  return `#${((red! << 16) | (green! << 8) | blue!).toString(16).padStart(6, '0')}`;
}

// The pLDDT colors (AlphaFold DB palette) are made for a white background; dark blue ribbons
// fade into a dark one. Let people pick, and remember the choice.
type Backdrop = 'white' | 'dark';
const BACKDROP_KEY = 'fold-structure-backdrop';

function savedBackdrop(): Backdrop {
  try {
    return localStorage.getItem(BACKDROP_KEY) === 'dark' ? 'dark' : 'white';
  } catch {
    return 'white';
  }
}

export function StructureViewer({ jobId, rank, residueCount, selection }: {
  jobId: string; rank: number; residueCount: number; selection?: PaePoint;
}) {
  const container = useRef<HTMLDivElement>(null);
  const viewer = useRef<GLViewer | undefined>(undefined);
  const [error, setError] = useState<string>();
  const [loading, setLoading] = useState(true);
  const [residues, setResidues] = useState<AtomSpec[]>([]);
  const [backdrop, setBackdrop] = useState<Backdrop>(savedBackdrop);
  const markers = useMemo(() => paeResidueMarkers(residues, selection, residueCount), [residues, selection, residueCount]);

  useEffect(() => {
    const element = container.current;
    if (!element) return;
    const updateBackground = () => {
      viewer.current
        ?.setBackgroundColor(backgroundColor(element), 1)
        .render();
    };
    const observer = new MutationObserver(updateBackground);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme'],
    });
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    try { localStorage.setItem(BACKDROP_KEY, backdrop); } catch { /* storage blocked */ }
    const element = container.current;
    if (element) viewer.current?.setBackgroundColor(backgroundColor(element), 1).render();
  }, [backdrop]);

  useEffect(() => {
    const controller = new AbortController();
    const element = container.current;
    if (!element) return () => controller.abort();
    setLoading(true);
    setError(undefined);
    setResidues([]);
    void Promise.all([import('3dmol'), getStructure(jobId, rank, controller.signal)])
      .then(([mol, pdb]) => {
        if (controller.signal.aborted) return;
        element.replaceChildren();
        const nextViewer = mol.createViewer(element, {
          backgroundColor: backgroundColor(element),
          antialias: true,
        });
        nextViewer.addModel(pdb, 'pdb');
        nextViewer.setStyle({}, {
          cartoon: {
            colorfunc: (atom: { b?: number }) => confidenceColor(atom.b ?? 0),
          },
        });
        nextViewer.zoomTo();
        nextViewer.render();
        viewer.current = nextViewer;
        setResidues(nextViewer.selectedAtoms({ atom: 'CA' }));
        setLoading(false);
      })
      .catch((requestError) => {
        if (!controller.signal.aborted) {
          setError(requestError instanceof Error ? requestError.message : 'The structure could not be displayed.');
          setLoading(false);
        }
      });
    return () => {
      controller.abort();
      viewer.current?.clear();
      viewer.current = undefined;
      element.replaceChildren();
    };
  }, [jobId, rank]);

  useEffect(() => {
    const active = viewer.current;
    if (!active || loading) return;
    const shapes = markers.map((marker) => active.addSphere({
      center: marker.position, radius: 1.1, color: marker.color,
    }));
    const labels = markers.map((marker) => active.addLabel(marker.label.split(' ')[0]!, {
      position: marker.position, font: getComputedStyle(container.current!).fontFamily,
      fontSize: 13, fontColor: '#f5f9f7', backgroundColor: '#1e2428',
      borderColor: marker.color, borderThickness: 1.5, inFront: true,
      alignment: marker.role === 'Aligned' ? 'bottomRight' : 'topLeft',
    }));
    active.render();
    return () => {
      for (const shape of shapes) active.removeShape(shape);
      for (const label of labels) active.removeLabel(label);
      active.render();
    };
  }, [loading, markers]);

  const saveImage = () => {
    const activeViewer = viewer.current;
    const element = container.current;
    if (!activeViewer || !element) return;
    const width = Math.max(1, Math.round(element.getBoundingClientRect().width));
    const height = Math.max(1, Math.round(element.getBoundingClientRect().height));
    activeViewer.setWidth(2400).setHeight(1800).render();
    const uri = activeViewer.pngURI();
    activeViewer.setWidth(width).setHeight(height).render();
    if (!uri) return;
    const link = document.createElement('a');
    link.href = uri;
    link.download = `${jobId}-rank-${rank}.png`;
    link.click();
  };

  const changeView = (action: ViewAction) => {
    const active = viewer.current;
    if (!active || loading || error) return;
    switch (action) {
      case 'left': active.rotate(-15, 'y'); break;
      case 'right': active.rotate(15, 'y'); break;
      case 'up': active.rotate(-15, 'x'); break;
      case 'down': active.rotate(15, 'x'); break;
      case 'in': active.zoom(1.2); break;
      case 'out': active.zoom(1 / 1.2); break;
      case 'reset': active.setView([0, 0, 0, 0, 0, 0, 0, 1]); active.zoomTo(); break;
    }
    active.render();
  };

  return (
    <section className="structure-panel" aria-labelledby="structure-heading">
      <div className="panel-heading">
        <div>
          <h2 id="structure-heading">Structure</h2>
          <p>Blue is higher pLDDT; orange is lower.</p>
        </div>
        <div className="panel-actions">
          <button className="quiet-button icon-button" type="button"
            onClick={() => setBackdrop(backdrop === 'white' ? 'dark' : 'white')}
            aria-label={`Background: ${backdrop === 'white' ? 'white' : 'dark'}. Switch to ${backdrop === 'white' ? 'dark' : 'white'}.`}
            title={backdrop === 'white' ? 'White background. Click for dark.' : 'Dark background. Click for white.'}>
            {backdrop === 'white' ? <SunIcon aria-hidden="true" /> : <MoonIcon aria-hidden="true" />}
          </button>
          <button className="quiet-button icon-button" type="button" disabled={loading || Boolean(error)} onClick={saveImage}
            aria-label="Save structure as PNG" title="Save PNG">
            <ImageDownIcon aria-hidden="true" />
          </button>
        </div>
      </div>
      <div
        ref={container}
        data-backdrop={backdrop}
        className="structure-canvas"
        role="group"
        tabIndex={loading || error ? -1 : 0}
        aria-label={`Rank ${rank} protein structure colored by pLDDT`}
        aria-describedby="structure-keyboard-help"
        onKeyDown={(event) => {
          const action = viewActionForKey(event.key);
          if (action) { event.preventDefault(); changeView(action); }
        }}
      />
      <StructureControls disabled={loading || Boolean(error)} onAction={changeView} />
      <p id="structure-keyboard-help" className="viewer-keyboard-help">Arrow keys rotate. + and − zoom. Home resets the view.</p>
      <div className="plddt-legend" aria-label="pLDDT color key">
        <span><i className="very-high" />90–100</span>
        <span><i className="high" />70–89</span>
        <span><i className="low" />50–69</span>
        <span><i className="very-low" />Below 50</span>
      </div>
      {selection && markers.length > 0 && (
        <div className="structure-selection" aria-live="polite">
          <div className="plddt-legend">
            {markers.map((marker) => <span key={marker.role}>
              <i style={{ background: marker.color }} />{marker.role} {marker.label}
            </span>)}
          </div>
          <p>{markers.length === 1
            ? `Both axes select the same residue. The diagonal does not assess placement between different residues.`
            : `Expected error at ${markers[1]!.label} when aligned on ${markers[0]!.label}: ${selection.value.toFixed(1)} Å.`}</p>
          <p>Markers locate the selected residues; ribbon colors still show pLDDT.</p>
        </div>
      )}
      {selection && !loading && !error && markers.length === 0 && (
        <p className="jobs-error" role="alert">The selected PAE residues could not be matched to this structure.</p>
      )}
      {loading && <p className="viewer-status" role="status">Loading structure…</p>}
      {error && <p className="jobs-error" role="alert">{error}</p>}
    </section>
  );
}
