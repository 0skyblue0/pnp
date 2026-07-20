import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { ConfirmProvider, useConfirm } from "./ConfirmDialog.js";

function ConfirmTrigger({ onResult }: { onResult?: (confirmed: boolean) => void }) {
  const confirm = useConfirm();
  return (
    <button
      type="button"
      onClick={() => {
        void confirm({ message: "삭제하시겠습니까?", confirmLabel: "삭제" }).then(onResult);
      }}
    >
      삭제 열기
    </button>
  );
}

describe("ConfirmDialog", () => {
  afterEach(() => cleanup());

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

  it.each([
    ["취소", false],
    ["삭제", true]
  ] as const)("restores focus and resolves %s after its button is pressed", async (buttonName, expectedResult) => {
    let result: boolean | undefined;
    render(
      <ConfirmProvider>
        <ConfirmTrigger onResult={(confirmed) => (result = confirmed)} />
      </ConfirmProvider>
    );

    const trigger = screen.getByRole("button", { name: "삭제 열기" });
    trigger.focus();
    fireEvent.click(trigger);
    const dialog = await screen.findByRole("alertdialog");

    fireEvent.click(screen.getByRole("button", { name: buttonName }));
    await waitFor(() => expect(dialog).not.toBeInTheDocument());
    await waitFor(() => expect(trigger).toHaveFocus());
    await waitFor(() => expect(result).toBe(expectedResult));
  });
});
