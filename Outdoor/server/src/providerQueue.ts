// Process-wide scheduling: separate API handlers must not each create their own burst.
export class ProviderQueue {
  private tail: Promise<unknown> = Promise.resolve();
  private nextStart = 0;
  private pending = 0;
  constructor(private interval = 1100) {}
  run<T>(action: () => Promise<T>): Promise<T> {
    if (this.pending >= 24) return Promise.reject(new Error("地图请求排队较多，请稍后重试"));
    this.pending++;
    const result = this.tail.then(async () => {
      const delay = Math.max(0, this.nextStart - Date.now());
      if (delay) await new Promise(resolve => setTimeout(resolve, delay));
      this.nextStart = Date.now() + this.interval;
      return action();
    });
    this.tail = result.catch(() => undefined).finally(() => { this.pending--; });
    return result;
  }
}
export const providerQueue = new ProviderQueue();
