export type StructuredJsonRequest = {
  apiKey: string;
  model: string;
  system: string;
  prompt: string;
  schema: Record<string, unknown>;
  schemaName: string;
};

export interface LlmClient {
  requestStructuredJson<T>(request: StructuredJsonRequest): Promise<T>;
}
