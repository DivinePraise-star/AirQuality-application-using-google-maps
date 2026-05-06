import { StateManager } from "./StateManager";
import { MarkerModule } from "./modules/MarkerModule";
import { HeatmapModule } from "./modules/HeatmapModule";

export class StageManager {
  private stateManager: StateManager;
  private map: google.maps.Map;
  
  private markerModule: MarkerModule;
  private heatmapModule: HeatmapModule;

  constructor(map: google.maps.Map, stateManager: StateManager) {
    this.map = map;
    this.stateManager = stateManager;

    // Initialize visualization modules
    this.markerModule = new MarkerModule(this.map);
    this.heatmapModule = new HeatmapModule(this.map);

    // Subscribe to state changes so UI updates automatically
    this.stateManager.subscribe(() => {
      this.updateModules();
      this.updateUIStats();
    });
  }

  updateModules() {
    const measurements = this.stateManager.getMeasurements();
    const mode = this.stateManager.getMode();

    if (mode === "markers") {
      this.heatmapModule.clear();
      this.markerModule.render(measurements).catch(console.error);
    } else if (mode === "heatmap") {
      this.markerModule.clear();
      this.heatmapModule.render(measurements);
    }
  }

  updateUIStats() {
    const stats = this.stateManager.getStats();
    const countEl = document.getElementById("stat-count");
    const avgEl = document.getElementById("stat-avg");

    if (countEl) countEl.innerText = stats.count.toString();
    if (avgEl) avgEl.innerText = `${stats.avg}`;
  }
}
