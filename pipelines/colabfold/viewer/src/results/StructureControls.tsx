// Corner joystick for the 3D structure (cirro-apps; replaces Fold's row of buttons).
// Drag the knob to spin continuously (speed grows with how far it is pushed), tap an
// arrow to turn 15°, tap the knob to reset. Zoom sits beside it.
import { useEffect, useRef, useState } from 'react';
import { ChevronDownIcon, ChevronLeftIcon, ChevronRightIcon, ChevronUpIcon, MinusIcon, PlusIcon } from 'lucide-react';

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

const TRAVEL = 26;        // px the knob can move from center
const MAX_SPEED = 180;    // degrees per second at full deflection
const TAP_SLOP = 4;       // px of movement still counted as a tap

export function StructureControls({ disabled, onAction, onSpin }: {
  disabled: boolean;
  onAction: (action: ViewAction) => void;
  onSpin: (degreesY: number, degreesX: number) => void;
}) {
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const drag = useRef<{ startX: number; startY: number; moved: boolean } | undefined>(undefined);
  const live = useRef({ x: 0, y: 0 });
  const spin = useRef(onSpin);
  spin.current = onSpin;

  // While the knob is off center, spin every frame in proportion to the deflection.
  useEffect(() => {
    if (offset.x === 0 && offset.y === 0) return;
    let frame = 0;
    let last = performance.now();
    const tick = (now: number) => {
      const seconds = Math.min(0.05, (now - last) / 1000);
      last = now;
      const { x, y } = live.current;
      spin.current((x / TRAVEL) * MAX_SPEED * seconds, (y / TRAVEL) * MAX_SPEED * seconds);
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [offset.x === 0 && offset.y === 0]);

  const move = (clientX: number, clientY: number) => {
    const d = drag.current;
    if (!d) return;
    let x = clientX - d.startX;
    let y = clientY - d.startY;
    const length = Math.hypot(x, y);
    if (length > TAP_SLOP) d.moved = true;
    if (length > TRAVEL) { x = (x / length) * TRAVEL; y = (y / length) * TRAVEL; }
    live.current = { x, y };
    setOffset({ x, y });
  };

  const release = () => {
    const d = drag.current;
    drag.current = undefined;
    live.current = { x: 0, y: 0 };
    setOffset({ x: 0, y: 0 });
    if (d && !d.moved) onAction('reset');
  };

  const arrow = (action: ViewAction, label: string, className: string, Icon: typeof ChevronUpIcon) => (
    <button type="button" className={`joystick-arrow ${className}`} disabled={disabled}
      aria-label={label} title={label} onClick={() => onAction(action)}>
      <Icon aria-hidden="true" />
    </button>
  );

  return (
    <div className="structure-controls" role="group" aria-label="Structure view controls">
      <div className="joystick" data-active={offset.x !== 0 || offset.y !== 0 ? 'true' : undefined}>
        {arrow('up', 'Rotate up', 'joystick-up', ChevronUpIcon)}
        {arrow('left', 'Rotate left', 'joystick-left', ChevronLeftIcon)}
        {arrow('right', 'Rotate right', 'joystick-right', ChevronRightIcon)}
        {arrow('down', 'Rotate down', 'joystick-down', ChevronDownIcon)}
        <button
          type="button"
          className="joystick-knob"
          disabled={disabled}
          aria-label="Reset view. Drag to spin the structure."
          title="Drag to spin · tap to reset view"
          style={{ transform: `translate(calc(-50% + ${offset.x}px), calc(-50% + ${offset.y}px))` }}
          onPointerDown={(event) => {
            if (event.button !== 0) return;
            event.currentTarget.setPointerCapture(event.pointerId);
            drag.current = { startX: event.clientX, startY: event.clientY, moved: false };
          }}
          onPointerMove={(event) => move(event.clientX, event.clientY)}
          onPointerUp={release}
          onPointerCancel={release}
          onKeyDown={(event) => {
            if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onAction('reset'); }
          }}
        />
      </div>
      <div className="zoom-pill">
        <button type="button" disabled={disabled} aria-label="Zoom in" title="Zoom in" onClick={() => onAction('in')}>
          <PlusIcon aria-hidden="true" />
        </button>
        <button type="button" disabled={disabled} aria-label="Zoom out" title="Zoom out" onClick={() => onAction('out')}>
          <MinusIcon aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
