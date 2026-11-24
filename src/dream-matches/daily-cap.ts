/** How many Claude calls are left today (UTC). Kept in memory, so a restart starts the day again. */
export class DailyCap {
  private day = '';
  private taken = 0;

  constructor(
    private readonly limit: number,
    private readonly now: () => Date = () => new Date(),
  ) {}

  /** Takes one call, or returns false when none is left. */
  tryTake(): boolean {
    const today = this.now().toISOString().slice(0, 10);
    if (today !== this.day) {
      this.day = today;
      this.taken = 0;
    }
    if (this.taken >= this.limit) return false;
    this.taken += 1;
    return true;
  }
}
