import { StateManager } from "./StateManager";
import { MarkerModule } from "./modules/MarkerModule";
import { HeatmapModule } from "./modules/HeatmapModule";
import { AirQoAPI } from "./api";

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
      this.updateWorstAreas();
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

  updateWorstAreas() {
    const listEl = document.getElementById("worst-areas-list");
    if (!listEl) return;

    const worstAreas = this.stateManager.getWorstAreas(3);
    
    if (worstAreas.length === 0) {
      listEl.innerHTML = '<div class="text-xs text-gray-500">No data available</div>';
      return;
    }

    listEl.innerHTML = worstAreas.map((area, index) => {
      const pm25 = area.pm2_5.value;
      const color = AirQoAPI.getAQIColor(pm25);
      const emoji = AirQoAPI.getAQIEmoji(pm25);

      // Contrast text color for the badge
      const hex = color.replace("#", "");
      const r = parseInt(hex.substr(0, 2), 16);
      const g = parseInt(hex.substr(2, 2), 16);
      const b = parseInt(hex.substr(4, 2), 16);
      const yiq = (r * 299 + g * 587 + b * 114) / 1000;
      const textColor = yiq >= 128 ? "text-gray-900" : "text-white";

      return `
        <div class="flex items-center justify-between p-2 rounded-lg bg-gray-900/50 border border-gray-800 cursor-pointer hover:bg-gray-800 transition-colors" data-lat="${area.deviceDetails?.latitude}" data-lng="${area.deviceDetails?.longitude}">
          <div class="flex items-center gap-2 overflow-hidden">
            <span class="text-sm shrink-0">${emoji}</span>
            <span class="text-[11px] md:text-xs text-gray-300 truncate font-medium">${index + 1}. ${area.deviceDetails?.name || area.device}</span>
          </div>
          <div class="px-2 py-0.5 rounded ${textColor} text-[10px] md:text-xs font-bold shrink-0" style="background-color: ${color}">
            ${pm25.toFixed(1)}
          </div>
        </div>
      `;
    }).join("");

    // Add click listeners to zoom into the markers
    const areaElements = listEl.querySelectorAll('[data-lat]');
    areaElements.forEach(el => {
      el.addEventListener('click', (e) => {
        const lat = parseFloat((e.currentTarget as HTMLElement).dataset.lat || "0");
        const lng = parseFloat((e.currentTarget as HTMLElement).dataset.lng || "0");
        if (lat && lng) {
          this.map.panTo({ lat, lng });
          this.map.setZoom(15);
        }
      });
    });
  }
}
