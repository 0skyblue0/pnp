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
      <div className="flex flex-wrap gap-1 rounded-control border border-latte bg-white p-1">
        {options.map((option) => (
          <button
            key={option.value}
            className={[
              "min-h-9 rounded-[7px] border px-3 text-[12.5px] font-semibold transition",
              value === option.value
                ? "border-bread bg-bread text-white shadow-none"
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
