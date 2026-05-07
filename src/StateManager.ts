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

  getStats(customMeasurements?: AirQoMeasurement[]) {
    const data = customMeasurements || this.measurements;
    if (data.length === 0) return { count: 0, avg: 0 };
    
    let sum = 0;
    data.forEach((m) => {
      // Use value
      sum += m.pm2_5.value;
    });

    return {
      count: data.length,
      avg: Math.round(sum / data.length),
    };
  }

  getWorstAreas(limit: number = 3, customMeasurements?: AirQoMeasurement[]): AirQoMeasurement[] {
    const data = customMeasurements || this.measurements;
    return [...data]
      .sort((a, b) => b.pm2_5.value - a.pm2_5.value)
      .slice(0, limit);
  }
}
