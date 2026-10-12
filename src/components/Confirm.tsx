import { useEffect, useState } from 'react';

interface Request {
  title: string;
  message?: string;
  confirmLabel: string;
  danger?: boolean;
  resolve: (ok: boolean) => void;
}

let open: ((r: Request) => void) | null = null;

/** Eigen bevestigingsvenster in plaats van de grijze iOS-popup. */
export function confirmDialog(opts: { title: string; message?: string; confirmLabel: string; danger?: boolean }): Promise<boolean> {
  return new Promise((resolve) => {
    if (!open) return resolve(window.confirm(opts.title));
    open({ ...opts, resolve });
  });
}

export function ConfirmHost() {
  const [req, setReq] = useState<Request | null>(null);
  useEffect(() => {
    open = setReq;
    return () => { open = null; };
  }, []);
  if (!req) return null;
  const answer = (ok: boolean) => {
    req.resolve(ok);
    setReq(null);
  };
  return (
    <div className="overlay center" onClick={() => answer(false)}>
      <div className="dialog" role="alertdialog" aria-label={req.title} onClick={(e) => e.stopPropagation()}>
        <h3>{req.title}</h3>
        {req.message && <p className="muted small">{req.message}</p>}
        <div className="row" style={{ marginTop: 16 }}>
          <button className="btn grow" onClick={() => answer(false)}>Annuleren</button>
          <button className={`btn grow ${req.danger ? 'danger-fill' : 'primary'}`} onClick={() => answer(true)}>{req.confirmLabel}</button>
        </div>
      </div>
    </div>
  );
}
