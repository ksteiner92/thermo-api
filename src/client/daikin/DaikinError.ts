export class DaikinError extends Error {
  public readonly message: string;

  public constructor(message: string) {
    super();
    this.message = message;
  }
}
