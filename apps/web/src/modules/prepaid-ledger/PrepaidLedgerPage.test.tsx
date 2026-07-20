import { render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";

import { ConfirmProvider } from "../../shared/ui/ConfirmDialog";
import { PrepaidLedgerPage } from "./PrepaidLedgerPage";

it("labels the ledger, transaction history, and selected customer detail", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({ ok: true, json: async () => ({ data: { items: [] }, error: null }) })
  );
  render(
    <ConfirmProvider>
      <PrepaidLedgerPage />
    </ConfirmProvider>
  );

  expect(await screen.findByRole("heading", { name: "선결제 장부" })).toBeInTheDocument();
  expect(screen.getByText("거래 내역")).toBeInTheDocument();
  expect(screen.getByRole("complementary", { name: "선택한 손님 상세" })).toBeInTheDocument();
});

afterEach(() => vi.unstubAllGlobals());
