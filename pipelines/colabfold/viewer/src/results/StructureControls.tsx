export type ViewAction = 'left' | 'right' | 'up' | 'down' | 'in' | 'out' | 'reset';

export function viewActionForKey(key: string): ViewAction | undefined {
  switch (key) {
    case 'ArrowLeft': return 'left';
    case 'ArrowRight': return 'right';
    case 'ArrowUp': return 'up';
    case 'ArrowDown': return 'down';
    case '+': case '=': return 'in';
    case '-': return 'out';
    case 'Home': return 'reset';
    default: return undefined;
  }
}

export function StructureControls({ disabled, onAction }: { disabled: boolean; onAction: (action: ViewAction) => void }) {
  return <div className="structure-controls" role="group" aria-label="Structure view controls">
    {([
      ['left', 'Rotate left', '←'], ['right', 'Rotate right', '→'],
      ['up', 'Rotate up', '↑'], ['down', 'Rotate down', '↓'],
      ['in', 'Zoom in', '+'], ['out', 'Zoom out', '−'], ['reset', 'Reset view', 'Reset view'],
    ] as const).map(([action, label, text]) => (
      <button key={action} type="button" className="quiet-button" disabled={disabled}
        aria-label={label} title={label} onClick={() => onAction(action)}>{text}</button>
    ))}
  </div>;
}
