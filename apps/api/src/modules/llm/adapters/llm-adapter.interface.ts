export type LlmInvokeArgs = {
  systemPrompt: string;
  userPrompt: string;
  outputSchema: object;
  maxTokens?: number;
  temperature?: number;
  cacheKey?: string;
};

export type LlmInvokeResult = {
  parsed: unknown;
  raw: string;
  usage: {
    inputTokens: number;
    outputTokens: number;
  };
  latencyMs: number;
};

export interface LlmAdapter {
  readonly providerName: string;
  readonly modelId: string;
  invoke(args: LlmInvokeArgs): Promise<LlmInvokeResult>;
}
