export class ArrError extends Error {
  readonly code: string;
  readonly details: Record<string, unknown> | undefined;

  constructor(code: string, message: string, details?: Record<string, unknown>) {
    super(message);
    this.name = "ArrError";
    this.code = code;
    this.details = details;
  }
}
