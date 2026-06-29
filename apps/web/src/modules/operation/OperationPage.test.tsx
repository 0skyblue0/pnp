import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { OperationPage } from "./OperationPage.js";

vi.mock("../../shared/time/storeTime.js", () => ({
  currentStoreDateTime: () => "2026-06-03T12:34",
  todayInStoreTime: () => "2026-06-03"
}));

type FetchCall = {
  url: string;
  method: string;
  body: unknown;
};

const fetchCalls: FetchCall[] = [];

function envelope(data: unknown) {
  return new Response(JSON.stringify({ data, error: null }), {
    headers: { "Content-Type": "application/json" }
  });
}

function setupFetch() {
  fetchCalls.length = 0;
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url =
        typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
      const method = init?.method ?? "GET";
      const body = typeof init?.body === "string" ? (JSON.parse(init.body) as unknown) : null;
      fetchCalls.push({ url, method, body });

      if (url === "/api/v1/auth/csrf") {
        return envelope({ csrfToken: "test-csrf" });
      }

      if (url === "/api/v1/product?active=true") {
        return envelope({
          items: [
            { id: 1, name: "바게트", isActive: true },
            { id: 2, name: "크루아상", isActive: true }
          ],
          total: 2,
          page: 1,
          size: 2
        });
      }

      if (url === "/api/v1/stockout?from=2026-06-03&to=2026-06-03") {
        return envelope({
          items: [
            {
              id: "10",
              productId: 1,
              productName: "바게트",
              date: "2026-06-03",
              sequence: 1,
              stockoutAt: "2026-06-03T03:00:00.000Z",
              inquiryAfterStockout: null,
              discardQty: 2
            },
            {
              id: "11",
              productId: 1,
              productName: "바게트",
              date: "2026-06-03",
              sequence: 2,
              stockoutAt: "2026-06-03T04:00:00.000Z",
              inquiryAfterStockout: null,
              discardQty: 1
            }
          ],
          total: 2,
          page: 1,
          size: 2
        });
      }

      if (url === "/api/v1/daily-log/2026-06-03") {
        return envelope({
          id: "1",
          date: "2026-06-03",
          tastingLogs: [
            {
              id: "20",
              productId: 1,
              productName: "바게트",
              recommended: false,
              convertedToSale: null,
              note: null
            },
            {
              id: "21",
              productId: 2,
              productName: "크루아상",
              recommended: false,
              convertedToSale: null,
              note: null
            }
          ]
        });
      }

      if (url === "/api/v1/production-lot?date=2026-06-03") {
        return envelope({
          items: [
            {
              id: "30",
              productId: 1,
              productName: "바게트",
              producedAt: "2026-06-03T01:00:00.000Z",
              lotType: null,
              producedQty: 4
            }
          ],
          total: 1,
          page: 1,
          size: 1
        });
      }

      if (method === "POST" && url === "/api/v1/discard") {
        return envelope({
          id: "11",
          productId: 1,
          productName: "바게트",
          date: "2026-06-03",
          sequence: 2,
          stockoutAt: "2026-06-03T04:00:00.000Z",
          inquiryAfterStockout: null,
          discardQty: 6
        });
      }

      if (method === "POST" && url === "/api/v1/daily-log/2026-06-03/tasting") {
        return envelope({
          id: "1",
          date: "2026-06-03",
          tastingLogs: []
        });
      }

      if (method === "POST" && url === "/api/v1/production-lot") {
        return envelope({
          id: "31",
          productId: 1,
          productName: "바게트",
          producedAt: "2026-06-03T03:34:00.000Z",
          lotType: null,
          producedQty: 7
        });
      }

      if (method === "POST" && url === "/api/v1/stockout") {
        return envelope({
          id: "12",
          productId: 1,
          productName: "바게트",
          date: "2026-06-03",
          sequence: 3,
          stockoutAt: "2026-06-03T03:34:00.000Z",
          inquiryAfterStockout: "NONE",
          discardQty: 0
        });
      }

      return envelope({ items: [], total: 0, page: 1, size: 0 });
    })
  );
}

function lastPostTo(path: string) {
  for (let index = fetchCalls.length - 1; index >= 0; index -= 1) {
    const call = fetchCalls[index];
    if (call?.method === "POST" && call.url === path) {
      return call;
    }
  }

  return undefined;
}

function renderOperationPage() {
  return render(
    <MemoryRouter>
      <OperationPage />
    </MemoryRouter>
  );
}

describe("OperationPage", () => {
  beforeEach(() => {
    setupFetch();
    vi.spyOn(window, "confirm").mockReturnValue(true);
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("renders concierge as the default tab with discard and tasting counts", async () => {
    renderOperationPage();

    expect(screen.getByRole("tab", { name: "컨시어즈" })).toHaveAttribute(
      "aria-selected",
      "true"
    );
    expect(screen.getByRole("tab", { name: "베이커" })).toHaveAttribute(
      "aria-selected",
      "false"
    );

    const productName = await screen.findByText("바게트");
    const productCard = productName.closest("article");
    if (!productCard) {
      throw new Error("Expected product card");
    }

    expect(productName).toBeInTheDocument();
    expect(screen.getByText("현재")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "혼잡 기록" })).toHaveAttribute(
      "href",
      "/daily-log/today"
    );
    expect(within(productCard).getByText("품절")).toBeInTheDocument();
    expect(within(productCard).getByText("🗑 3")).toBeInTheDocument();
    expect(within(productCard).getByText("🥄 1")).toBeInTheDocument();
  });

  it("posts the selected discard quantity to the discard API", async () => {
    renderOperationPage();

    await screen.findByText("바게트");
    fireEvent.change(screen.getByLabelText("바게트 폐기 수량"), {
      target: { value: "3" }
    });
    fireEvent.click(screen.getByRole("button", { name: "바게트 폐기 기록" }));

    await waitFor(() => {
      expect(window.confirm).toHaveBeenCalledWith("바게트 폐기 3개를 저장할까요?");
      expect(lastPostTo("/api/v1/discard")?.body).toEqual({
        productId: 1,
        date: "2026-06-03",
        discardQty: 3
      });
    });
  });

  it("posts tasting records as non-recommended quick tastings", async () => {
    renderOperationPage();

    await screen.findByText("바게트");
    fireEvent.click(screen.getByRole("button", { name: "바게트 시식 기록" }));

    await waitFor(() => {
      expect(window.confirm).toHaveBeenCalledWith("바게트 시식 1회를 저장할까요?");
      expect(lastPostTo("/api/v1/daily-log/2026-06-03/tasting")?.body).toEqual({
        productId: 1,
        recommended: false
      });
    });
  });

  it("posts the selected baker quantity as a production lot", async () => {
    renderOperationPage();

    fireEvent.click(await screen.findByRole("tab", { name: "베이커" }));
    expect(screen.getByRole("tab", { name: "베이커" })).toHaveAttribute(
      "aria-selected",
      "true"
    );
    expect(screen.queryByRole("link", { name: "혼잡 기록" })).not.toBeInTheDocument();
    expect(screen.getByText("📥 4")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("바게트 입고 수량"), {
      target: { value: "7" }
    });
    const productionButton = screen.getByRole("button", { name: "바게트 입고 기록" });
    expect(productionButton).toHaveClass("w-11");
    fireEvent.click(productionButton);

    await waitFor(() => {
      expect(window.confirm).toHaveBeenCalledWith("바게트 입고 7개를 저장할까요?");
      expect(lastPostTo("/api/v1/production-lot")?.body).toEqual({
        productId: 1,
        producedQty: 7,
        producedAt: "2026-06-03T12:34",
        lotType: null
      });
    });
  });

  it("does not post a stockout record when confirmation is canceled", async () => {
    vi.mocked(window.confirm).mockReturnValue(false);
    renderOperationPage();

    await screen.findByText("바게트");
    fireEvent.click(screen.getByRole("button", { name: "바게트 품절 기록" }));

    expect(window.confirm).toHaveBeenCalledWith("바게트 품절 기록을 저장할까요?");
    expect(lastPostTo("/api/v1/stockout")).toBeUndefined();
  });
});
