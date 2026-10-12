import { useEffect, useState, type ReactNode } from 'react';

/** Paneel dat van onderen inschuift. Sluiten speelt eerst de animatie af. */
export function Sheet({ title, onClose, children, actions }: { title: string; onClose: () => void; children: ReactNode; actions?: ReactNode }) {
  const [closing, setClosing] = useState(false);
  const close = () => {
    if (closing) return;
    setClosing(true);
    setTimeout(onClose, 180);
  };
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && close();
    addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prev;
      removeEventListener('keydown', onKey);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <div className={`overlay ${closing ? 'closing' : ''}`} onClick={close}>
      <div className="sheet" role="dialog" aria-label={title} onClick={(e) => e.stopPropagation()}>
        <div className="sheet-grip" />
        <div className="sheet-head">
          <button className="btn ghost" onClick={close}>Sluiten</button>
          <h3 className="truncate">{title}</h3>
          <div className="sheet-actions">{actions}</div>
        </div>
        <div className="body">{children}</div>
      </div>
    </div>
  );
}
