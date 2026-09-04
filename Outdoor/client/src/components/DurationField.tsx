import NumberField from "./NumberField";
export const formatDuration = (value: number | null) => value === null ? "不限时长" : Math.floor(value / 60) + " 小时 " + value % 60 + " 分钟";
export default function DurationField({label, value, onChange, optional = false}: {
  label: string; value: number | null; onChange: (value: number | null) => void; optional?: boolean;
}) {
  const hours = value === null ? null : Math.floor(value / 60);
  const minutes = value === null ? null : value % 60;
  function update(h: number | null, m: number | null) {
    const total = (h || 0) * 60 + (m || 0);
    onChange(optional && total === 0 ? null : total);
  }
  return <div className="ow-duration-field"><span>{label}{optional ? "（可选）" : ""}</span>
    <div className="ow-duration-inputs">
      <NumberField label={label + "小时"} value={hours} min={0} max={24} onChange={h => update(h, minutes)}/><span>小时</span>
      <NumberField label={label + "分钟"} value={minutes} min={0} max={59} onChange={m => update(hours, m)}/><span>分钟</span>
    </div>
    {optional && <button type="button" className="ow-text-button" onClick={() => onChange(null)}>清除时间限制</button>}
  </div>;
}
