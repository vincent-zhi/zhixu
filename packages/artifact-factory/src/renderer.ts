import type { ExportResult } from "./schemas.js";

export interface ArtifactRenderer<TInput> {
  readonly format: string;
  render(input: TInput): Promise<ExportResult>;
}
