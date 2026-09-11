export class ResolutionError extends Error {
  constructor(message: string, readonly status = 422) {
    super(message);
  }
}
