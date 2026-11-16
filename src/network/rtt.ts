import { RttMetrics } from '../types';

/**
 * Sliding Window Round-Trip-Time (RTT) Metrics Collector
 * Tracks ping samples over a sliding window (default: 60 samples / 60 seconds)
 * and computes steady-state median, p95, min, and max latency.
 */
export class RttCollector {
  private samples: number[] = [];
  private readonly maxSamples: number;

  constructor(maxSamples = 60) {
    this.maxSamples = Math.max(1, maxSamples);
  }

  public record(sampleMs: number): RttMetrics {
    const val = Math.max(1, Math.round(sampleMs));
    this.samples.push(val);
    if (this.samples.length > this.maxSamples) {
      this.samples.shift();
    }
    return this.getMetrics();
  }

  public getMetrics(): RttMetrics {
    if (this.samples.length === 0) {
      return {
        current: 0,
        median: 0,
        p95: 0,
        max: 0,
        min: 0,
        samplesCount: 0
      };
    }

    const current = this.samples[this.samples.length - 1];
    const sorted = [...this.samples].sort((a, b) => a - b);
    const n = sorted.length;

    // Median (50th percentile)
    const median = n % 2 === 0
      ? Math.round((sorted[n / 2 - 1] + sorted[n / 2]) / 2)
      : sorted[Math.floor(n / 2)];

    // 95th percentile
    const p95Index = Math.min(n - 1, Math.floor(n * 0.95));
    const p95 = sorted[p95Index];
    const min = sorted[0];
    const max = sorted[n - 1];

    return {
      current,
      median,
      p95,
      max,
      min,
      samplesCount: n
    };
  }

  public reset() {
    this.samples = [];
  }

  public getRawSamples(): readonly number[] {
    return this.samples;
  }
}
