import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { PageHeader } from "./PageHeader.js";
import { Button } from "./Button.js";

describe("PageHeader", () => {
  afterEach(cleanup);

  it("renders a title, description, and supplied action", () => {
    render(
      <PageHeader
        title="매출 분석"
        description="연간 흐름"
        actions={<button>목표 설정</button>}
      />
    );

    expect(screen.getByRole("heading", { name: "매출 분석" })).toBeInTheDocument();
    expect(screen.getByText("연간 흐름")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "목표 설정" })).toBeInTheDocument();
  });

  it("enforces a 44px target for a supplied native action control", () => {
    render(
      <PageHeader
        title="매출 분석"
        actions={
          <span>
            <button>목표 설정</button>
          </span>
        }
      />
    );

    expect(screen.getByRole("button", { name: "목표 설정" }).closest(".app-page-actions")).toHaveClass(
      "[&_button]:min-h-11"
    );
  });

  it("uses the reference primary action treatment without removing the 44px target", () => {
    render(<Button>저장</Button>);

    const action = screen.getByRole("button", { name: "저장" });
    expect(action).toHaveClass("ref-primary-action");
    expect(action).toHaveClass("min-h-11");
  });
});
