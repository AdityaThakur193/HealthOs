"use client";

interface ChipSelectProps {
  options: { value: string; label: string; emoji?: string }[];
  value: string | string[];
  onChange: (value: string | string[]) => void;
  multi?: boolean;
}

export default function ChipSelect({ options, value, onChange, multi = false }: ChipSelectProps) {
  const selected = Array.isArray(value) ? value : [value];

  const toggle = (v: string) => {
    if (multi) {
      const arr = selected.includes(v) ? selected.filter((s) => s !== v) : [...selected, v];
      onChange(arr);
    } else {
      onChange(v);
    }
  };

  return (
    <div className="flex flex-wrap gap-2">
      {options.map((opt) => {
        const isActive = selected.includes(opt.value);
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => toggle(opt.value)}
            className={`chip ${isActive ? "chip-active" : ""}`}
          >
            {opt.emoji && <span className="mr-1">{opt.emoji}</span>}
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
