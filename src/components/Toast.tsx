import { useEffect, useState } from 'react';

interface ToastAction {
  label: string;
  onClick: () => void;
}

interface Message {
  text: string;
  action?: ToastAction;
}

let push: ((m: Message) => void) | null = null;

/** Korte melding bovenin; optioneel met een actie zoals "Ongedaan maken". */
export function toast(text: string, action?: ToastAction): void {
  push?.({ text, action });
}

export function ToastHost() {
  const [msg, setMsg] = useState<Message | null>(null);
  useEffect(() => {
    let t: ReturnType<typeof setTimeout>;
    push = (m) => {
      setMsg(m);
      clearTimeout(t);
      t = setTimeout(() => setMsg(null), m.action ? 5000 : 3500);
    };
    return () => { push = null; clearTimeout(t); };
  }, []);
  if (!msg) return null;
  return (
    <div className="toast" role="status" onClick={() => setMsg(null)}>
      <span className="grow">{msg.text}</span>
      {msg.action && (
        <button
          className="btn ghost small"
          onClick={(e) => {
            e.stopPropagation();
            msg.action!.onClick();
            setMsg(null);
          }}
        >
          {msg.action.label}
        </button>
      )}
    </div>
  );
}
