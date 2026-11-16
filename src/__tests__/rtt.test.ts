import { describe, it, expect } from 'vitest';
import { RttCollector } from '../network/rtt';

describe('RttCollector', () => {
  it('returns zeroes when no samples recorded', () => {
    const collector = new RttCollector();
    const metrics = collector.getMetrics();
    expect(metrics.samplesCount).toBe(0);
    expect(metrics.current).toBe(0);
    expect(metrics.median).toBe(0);
    expect(metrics.p95).toBe(0);
  });

  it('calculates accurate median and percentiles for samples', () => {
    const collector = new RttCollector(60);
    // Record odd number of samples: [20, 30, 40, 50, 60]
    [20, 50, 30, 60, 40].forEach((s) => collector.record(s));

    const metrics = collector.getMetrics();
    expect(metrics.samplesCount).toBe(5);
    expect(metrics.current).toBe(40);
    expect(metrics.min).toBe(20);
    expect(metrics.max).toBe(60);
    expect(metrics.median).toBe(40);
  });

  it('calculates median for even number of samples', () => {
    const collector = new RttCollector(60);
    [20, 30, 40, 50].forEach((s) => collector.record(s));
    const metrics = collector.getMetrics();
    expect(metrics.samplesCount).toBe(4);
    // (30 + 40) / 2 = 35
    expect(metrics.median).toBe(35);
  });

  it('respects sliding window maxSamples limit', () => {
    const collector = new RttCollector(5);
    for (let i = 1; i <= 10; i++) {
      collector.record(i * 10);
    }
    const metrics = collector.getMetrics();
    expect(metrics.samplesCount).toBe(5);
    // Sliding window holds [60, 70, 80, 90, 100]
    expect(metrics.min).toBe(60);
    expect(metrics.max).toBe(100);
    expect(metrics.median).toBe(80);
    expect(metrics.current).toBe(100);
  });

  it('resets cleanly', () => {
    const collector = new RttCollector();
    collector.record(100);
    collector.reset();
    expect(collector.getMetrics().samplesCount).toBe(0);
  });
});
