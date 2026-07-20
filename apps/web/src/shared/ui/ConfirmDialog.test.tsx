import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ConfirmProvider, useConfirm } from "./ConfirmDialog.js";

function ConfirmTrigger() {
  const confirm = useConfirm();
  return (
    <button type="button" onClick={() => void confirm({ message: "삭제하시겠습니까?", confirmLabel: "삭제" })}>
      삭제 열기
    </button>
  );
}

describe("ConfirmDialog", () => {
  it("traps keyboard focus and restores it to the invoking trigger when closed", async () => {
    render(
      <ConfirmProvider>
        <ConfirmTrigger />
      </ConfirmProvider>
    );

    const trigger = screen.getByRole("button", { name: "삭제 열기" });
    trigger.focus();
    fireEvent.click(trigger);

    const dialog = await screen.findByRole("alertdialog");
    const cancel = screen.getByRole("button", { name: "취소" });
    const confirm = screen.getByRole("button", { name: "삭제" });
    await waitFor(() => expect(confirm).toHaveFocus());

    fireEvent.keyDown(confirm, { key: "Tab" });
    expect(cancel).toHaveFocus();
    fireEvent.keyDown(cancel, { key: "Tab", shiftKey: true });
    expect(confirm).toHaveFocus();

    fireEvent.keyDown(dialog, { key: "Escape" });
    await waitFor(() => expect(trigger).toHaveFocus());
  });
});
