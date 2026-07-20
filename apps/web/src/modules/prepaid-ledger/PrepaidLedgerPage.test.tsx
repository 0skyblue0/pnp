import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";

import { ConfirmProvider } from "../../shared/ui/ConfirmDialog";
import { PrepaidLedgerPage } from "./PrepaidLedgerPage";

it("renders prepaid as a searchable reference-style ledger with a selected-detail region", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        data: {
          items: [{
            id: "ledger-1",
            customerName: "김반죽",
            contactPhone: "010-1234-5678",
            memo: "생일 케이크",
            ledgerType: "GENERAL",
            sharedLimit: null,
            balance: 30000,
            lastUsedAt: null,
            transactions: [],
            participants: []
          }]
        },
        error: null
      })
    })
  );
  render(
    <ConfirmProvider>
      <PrepaidLedgerPage />
    </ConfirmProvider>
  );

  expect(await screen.findByRole("searchbox", { name: "고객 검색" })).toBeInTheDocument();
  expect(screen.getByRole("region", { name: "거래 내역" })).toBeInTheDocument();
  const customer = await screen.findByRole("button", { name: "김반죽님" });
  fireEvent.click(customer);
  expect(screen.getByRole("complementary", { name: "선택한 고객 상세" })).toHaveTextContent("김반죽님");
  expect(screen.getByRole("button", { name: "신규 등록" })).toHaveClass("min-h-11");
});

afterEach(() => vi.unstubAllGlobals());
