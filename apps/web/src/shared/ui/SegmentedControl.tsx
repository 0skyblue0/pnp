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
      <div className="flex flex-wrap gap-2">
        {options.map((option) => (
          <button
            key={option.value}
            className={[
              "min-h-11 rounded-control border px-3 text-sm font-semibold",
              value === option.value
                ? "border-stone-900 bg-stone-900 text-white"
                : "border-stone-300 bg-white text-stone-800 hover:bg-stone-100"
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
