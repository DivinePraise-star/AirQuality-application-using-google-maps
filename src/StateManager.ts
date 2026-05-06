import { AirQoMeasurement } from "./api";

export type VisualizationMode = "markers" | "heatmap";

export class StateManager {
  private measurements: AirQoMeasurement[] = [];
  private mode: VisualizationMode = "markers";
  private listeners: (() => void)[] = [];

  // Update measurements and notify listeners
  setMeasurements(data: AirQoMeasurement[]) {
    this.measurements = data;
    this.notify();
  }

  getMeasurements(): AirQoMeasurement[] {
    return this.measurements;
  }

  // Update mode and notify listeners
  setMode(newMode: VisualizationMode) {
    if (this.mode !== newMode) {
      this.mode = newMode;
      this.notify();
    }
  }

  getMode(): VisualizationMode {
    return this.mode;
  }

  // Simple publish-subscribe pattern for state changes
  subscribe(listener: () => void) {
    this.listeners.push(listener);
  }

  private notify() {
    this.listeners.forEach((listener) => listener());
  }

  getStats() {
    if (this.measurements.length === 0) return { count: 0, avg: 0 };
    
    let sum = 0;
    this.measurements.forEach((m) => {
      // Use value
      sum += m.pm2_5.value;
    });

    return {
      count: this.measurements.length,
      avg: Math.round(sum / this.measurements.length),
    };
  }
}
