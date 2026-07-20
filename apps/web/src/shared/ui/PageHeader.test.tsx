import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { PageHeader } from "./PageHeader.js";

describe("PageHeader", () => {
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
});
