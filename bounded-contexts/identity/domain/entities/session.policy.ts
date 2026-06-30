export class SessionPolicy {
  static readonly totalMinutes = 60;

  static expiresAt() {
    return new Date(Date.now() + this.totalMinutes * 60 * 1000);
  }
}
