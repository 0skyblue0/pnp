import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { App } from "./App.js";
import { AppProviders } from "./providers/AppProviders.js";

describe("App", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(
            JSON.stringify({
              data: { items: [], total: 0, page: 1, size: 0 },
              error: null
            }),
            {
              headers: { "Content-Type": "application/json" }
            }
          )
      )
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("renders the operations home as the first experience", () => {
    render(
      <AppProviders>
        <App />
      </AppProviders>
    );

    expect(screen.getByRole("heading", { name: "오늘의 가용 재고" })).toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: /반응 입력/ }).length).toBeGreaterThan(0);
  });
});
