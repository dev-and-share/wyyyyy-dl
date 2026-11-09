import { describe, it, expect, vi, beforeEach } from 'vitest';
import { audioVisualizer } from './audioVisualizer.svelte';

describe('AudioVisualizerEngine', () => {
  beforeEach(() => {
    audioVisualizer.stop();
  });

  it('initializes with 10 bands at zero energy', () => {
    expect(audioVisualizer.bands).toHaveLength(10);
    expect(audioVisualizer.bands.every((b) => b === 0)).toBe(true);
    expect(audioVisualizer.vuLevel).toBe(0);
    expect(audioVisualizer.bassEnergy).toBe(0);
  });

  it('safely handles attach with null or non-audio elements without throwing', () => {
    expect(() => audioVisualizer.attach(null)).not.toThrow();
  });

  it('starts and stops gracefully without throwing errors in test environment', () => {
    expect(() => audioVisualizer.start()).not.toThrow();
    expect(() => audioVisualizer.stop()).not.toThrow();
  });

  it('updates all 10 bands dynamically with non-zero high frequency energy (preventing dead right bands)', () => {
    audioVisualizer.start();
    // In node/test environment without real WebAudio AnalyserNode, fallbackTick runs
    expect(audioVisualizer.bands).toHaveLength(10);
    // Band 8 and Band 9 should have active energy (> 0.05)
    expect(audioVisualizer.bands[8]).toBeGreaterThan(0.05);
    expect(audioVisualizer.bands[9]).toBeGreaterThan(0.05);
    // All bands should remain within [0, 1] range without overflowing
    expect(audioVisualizer.bands.every((b) => b >= 0 && b <= 1)).toBe(true);
    audioVisualizer.stop();
  });
});
