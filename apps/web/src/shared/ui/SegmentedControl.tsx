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
      <div className="flex flex-wrap gap-2 rounded-panel bg-latte/35 p-1.5 ring-1 ring-cocoa/10">
        {options.map((option) => (
          <button
            key={option.value}
            className={[
              "min-h-11 rounded-control border px-3 text-sm font-bold transition",
              value === option.value
                ? "border-cocoa bg-gradient-to-r from-cocoa to-bread text-white shadow-control"
                : "border-transparent bg-transparent text-cocoa/75 hover:bg-white/90 hover:text-cocoa hover:shadow-sm"
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
