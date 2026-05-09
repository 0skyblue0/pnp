import type { LlmAdapter, LlmInvokeArgs, LlmInvokeResult } from "./llm-adapter.interface.js";

export class DisabledLlmAdapter implements LlmAdapter {
  public readonly providerName = "disabled";
  public readonly modelId = "disabled";

  public async invoke(_args: LlmInvokeArgs): Promise<LlmInvokeResult> {
    throw new Error("LLM_DISABLED");
  }
}
