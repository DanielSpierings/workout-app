import { useEffect, useState } from 'react';

/** Getalveld dat ook een komma accepteert en tijdens het typen niets wegpoetst. */
export function NumInput({ value, onChange, placeholder, decimal = true, ...rest }: {
  value: number | null | undefined;
  onChange: (v: number | null) => void;
  placeholder?: string;
  decimal?: boolean;
  'aria-label'?: string;
  className?: string;
}) {
  const show = (v: number | null | undefined) => (v == null ? '' : String(v).replace('.', ','));
  const [text, setText] = useState(show(value));
  useEffect(() => {
    const parsed = text === '' ? null : Number(text.replace(',', '.'));
    if (parsed !== value) setText(show(value));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);
  return (
    <input
      {...rest}
      type="text"
      inputMode={decimal ? 'decimal' : 'numeric'}
      enterKeyHint="next"
      value={text}
      placeholder={placeholder}
      onFocus={(e) => e.target.select()}
      onChange={(e) => {
        const t = e.target.value.replace(decimal ? /[^0-9.,]/g : /[^0-9]/g, '');
        setText(t);
        if (t === '') return onChange(null);
        const n = Number(t.replace(',', '.'));
        if (Number.isFinite(n)) onChange(n);
      }}
    />
  );
}
