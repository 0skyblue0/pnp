export type InventoryCalculationInput = {
  produced: number;
  reservedToday: number;
  soldWalkin: number;
};

export type InventoryCalculationResult = {
  produced: number;
  reservedToday: number;
  soldWalkin: number;
  availableWalkin: number;
  warning: "RESERVATION_HEAVY" | null;
};

export function calculateAvailableWalkin(
  input: InventoryCalculationInput
): InventoryCalculationResult {
  const rawAvailable = input.produced - input.reservedToday - input.soldWalkin;
  const availableWalkin = Math.max(0, rawAvailable);

  return {
    produced: input.produced,
    reservedToday: input.reservedToday,
    soldWalkin: input.soldWalkin,
    availableWalkin,
    warning: rawAvailable < 0 ? "RESERVATION_HEAVY" : null
  };
}
