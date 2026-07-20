type SegmentedControlProps<TValue extends string> = {
  label: string;
  options: Array<{
    value: TValue;
    label: string;
  }>;
  value?: TValue | undefined;
  onChange: (value: TValue) => void;
};

export function SegmentedControl<TValue extends string>({
  label,
  options,
  value,
  onChange
}: SegmentedControlProps<TValue>) {
  return (
    <div>
      <span className="field-label">{label}</span>
      <div className="flex flex-wrap gap-1 rounded-control border border-border bg-surface-muted p-1">
        {options.map((option) => (
          <button
            key={option.value}
            className={[
              "min-h-11 rounded-[7px] border px-3 text-[12.5px] font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-bread focus-visible:ring-offset-1",
              value === option.value
                ? "border-[#c8912f] bg-[#fdf8ec] text-[#a86e1f] shadow-none"
                : "border-transparent bg-transparent text-cocoa/75 hover:bg-white hover:text-cocoa"
            ].join(" ")}
            type="button"
            onClick={() => onChange(option.value)}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}
