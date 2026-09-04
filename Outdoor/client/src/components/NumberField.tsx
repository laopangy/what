import { useEffect, useRef, useState } from "react";
export default function NumberField({value, onChange, label, min = 0, max, placeholder = "填写数值"}: {
  value: number | null; onChange: (value: number | null) => void; label: string; min?: number; max?: number; placeholder?: string;
}) {
  const [text, setText] = useState(value === null ? "" : String(value));
  const emitted = useRef<number | null | undefined>(undefined);
  useEffect(() => {
    if (Object.is(value, emitted.current) || (emitted.current === null && value === 0)) return;
    setText(value === null ? "" : String(value));
  }, [value]);
  return <input type="text" inputMode="decimal" aria-label={label} value={text} placeholder={placeholder}
    onFocus={event => event.currentTarget.select()}
    onChange={event => {
      const raw = event.target.value;
      if (!/^\d*(\.\d*)?$/.test(raw)) return;
      const normalized = raw.replace(/^0+(?=\d)/, "");
      setText(normalized);
      const next = normalized === "" || normalized === "." ? null : Number(normalized);
      emitted.current = next; onChange(next);
    }}
    onBlur={() => { if (text !== "" && text !== ".") setText(String(Number(text))); }}
    aria-invalid={value !== null && (value < min || (max !== undefined && value > max)) || undefined}
  />;
}
