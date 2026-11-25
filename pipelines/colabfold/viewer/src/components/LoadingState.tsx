interface LoadingStateProps {
  label: string;
  rows?: number;
}

export function LoadingState({ label, rows = 3 }: LoadingStateProps) {
  return (
    <div className="loading-state" role="status" aria-live="polite">
      <span className="visually-hidden">{label}</span>
      <div className="loading-shape" aria-hidden="true">
        <span className="loading-title" />
        {Array.from({ length: rows }, (_, index) => (
          <span className="loading-row" key={index} />
        ))}
      </div>
    </div>
  );
}
