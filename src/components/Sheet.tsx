import { useEffect, type ReactNode } from 'react';

export function Sheet({ title, onClose, children, actions }: { title: string; onClose: () => void; children: ReactNode; actions?: ReactNode }) {
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, []);
  return (
    <div className="overlay" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <div className="spread" style={{ marginBottom: 10 }}>
          <button className="btn ghost" onClick={onClose}>Sluiten</button>
          <h3>{title}</h3>
          <div style={{ minWidth: 70, textAlign: 'right' }}>{actions}</div>
        </div>
        <div className="body">{children}</div>
      </div>
    </div>
  );
}
