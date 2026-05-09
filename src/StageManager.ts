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
      this.refreshUIWithVisibleData();
    });

    // Also update UI when map bounds change
    this.map.addListener("idle", () => {
      this.refreshUIWithVisibleData();
    });

    const searchInput = document.getElementById("search-stations") as HTMLInputElement;
    if (searchInput) {
      searchInput.addEventListener("input", () => {
         this.refreshUIWithVisibleData();
      });
    }
  }

  private getVisibleMeasurements() {
    const bounds = this.map.getBounds();
    const allMeasurements = this.stateManager.getMeasurements();
    
    if (!bounds || allMeasurements.length === 0) {
      return allMeasurements;
    }

    return allMeasurements.filter(m => {
      if (!m.deviceDetails?.latitude || !m.deviceDetails?.longitude) return false;
      const latLng = new google.maps.LatLng(m.deviceDetails.latitude, m.deviceDetails.longitude);
      return bounds.contains(latLng);
    });
  }

  private refreshUIWithVisibleData() {
    const visibleData = this.getVisibleMeasurements();
    this.updateUIStats(visibleData);
    this.updateWorstAreas(visibleData);
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

  updateUIStats(visibleData?: any[]) {
    const stats = this.stateManager.getStats(visibleData);
    const countEl = document.getElementById("stat-count");
    const avgEl = document.getElementById("stat-avg");

    if (countEl) countEl.innerText = stats.count.toString();
    if (avgEl) avgEl.innerText = `${stats.avg}`;

    const healthRecommendationEl = document.getElementById("health-recommendation");
    const healthEmoji = document.getElementById("health-emoji");
    const healthTitle = document.getElementById("health-title");
    const healthDesc = document.getElementById("health-desc");

    if (stats.count > 0 && healthRecommendationEl && healthEmoji && healthTitle && healthDesc) {
      healthRecommendationEl.classList.remove("hidden");
      const avg = stats.avg;
      if (avg <= 12) {
        healthEmoji.innerText = "😊";
        healthTitle.innerText = "Good Air Quality";
        healthDesc.innerText = "Air quality is considered satisfactory, and air pollution poses little or no risk.";
        healthRecommendationEl.style.borderColor = "#00e40044";
        healthRecommendationEl.style.backgroundColor = "rgba(0, 228, 0, 0.05)";
      } else if (avg <= 35) {
        healthEmoji.innerText = "😐";
        healthTitle.innerText = "Moderate";
        healthDesc.innerText = "Air quality is acceptable; however, there may be a risk for some people.";
        healthRecommendationEl.style.borderColor = "#ffff0044";
        healthRecommendationEl.style.backgroundColor = "rgba(255, 255, 0, 0.05)";
      } else if (avg <= 55) {
        healthEmoji.innerText = "😷";
        healthTitle.innerText = "Unhealthy for Sensitive Groups";
        healthDesc.innerText = "Members of sensitive groups may experience health effects.";
        healthRecommendationEl.style.borderColor = "#ff7e0044";
        healthRecommendationEl.style.backgroundColor = "rgba(255, 126, 0, 0.05)";
      } else if (avg <= 150) {
        healthEmoji.innerText = "🤢";
        healthTitle.innerText = "Unhealthy";
        healthDesc.innerText = "Everyone may begin to experience health effects.";
        healthRecommendationEl.style.borderColor = "#ff000044";
        healthRecommendationEl.style.backgroundColor = "rgba(255, 0, 0, 0.05)";
      } else if (avg <= 250) {
        healthEmoji.innerText = "🤮";
        healthTitle.innerText = "Very Unhealthy";
        healthDesc.innerText = "Health warnings of emergency conditions. The entire population is more likely to be affected.";
        healthRecommendationEl.style.borderColor = "#8f3f9744";
        healthRecommendationEl.style.backgroundColor = "rgba(143, 63, 151, 0.05)";
      } else {
        healthEmoji.innerText = "☠️";
        healthTitle.innerText = "Hazardous";
        healthDesc.innerText = "Health alert: everyone may experience more serious health effects.";
        healthRecommendationEl.style.borderColor = "#7e002344";
        healthRecommendationEl.style.backgroundColor = "rgba(126, 0, 35, 0.05)";
      }
    } else if (healthRecommendationEl) {
      healthRecommendationEl.classList.add("hidden");
    }
  }

  updateWorstAreas(visibleData?: any[]) {
    const listEl = document.getElementById("worst-areas-list");
    if (!listEl) return;

    const searchInput = document.getElementById("search-stations") as HTMLInputElement;
    const query = searchInput ? searchInput.value.toLowerCase() : "";

    let dataToUse = visibleData || this.stateManager.getMeasurements();
    if (query) {
       dataToUse = dataToUse.filter((m: any) => {
          const name = m.deviceDetails?.name || m.device;
          return name.toLowerCase().includes(query);
       });
    }

    const worstAreas = this.stateManager.getWorstAreas(50, dataToUse); // Increase limit to act like a list
    
    if (worstAreas.length === 0) {
      listEl.innerHTML = '<div class="text-xs text-gray-500 py-2">No stations found matching criteria.</div>';
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

      const description = AirQoAPI.getAQIDescription(pm25);
      const date = new Date(area.time);
      const timeString = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      const dateString = date.toLocaleDateString([], { month: 'short', day: 'numeric' });

      return `
        <div class="flex flex-col p-2.5 rounded-xl bg-gray-900/40 border border-gray-800/80 cursor-pointer hover:bg-gray-800/60 transition-all station-item" data-lat="${area.deviceDetails?.latitude}" data-lng="${area.deviceDetails?.longitude}" data-device="${area.device}">
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-2.5 overflow-hidden">
              <span class="text-sm shrink-0 drop-shadow-sm">${emoji}</span>
              <span class="text-[11px] md:text-xs text-gray-200 truncate font-medium">${index + 1}. ${area.deviceDetails?.name || area.device}</span>
            </div>
            <div class="px-2 py-0.5 rounded-md ${textColor} text-[10px] md:text-xs font-bold shrink-0 shadow-sm" style="background-color: ${color}">
              ${pm25.toFixed(1)}
            </div>
          </div>
          <!-- Expanded details (hidden by default) -->
          <div class="hidden flex-col gap-1.5 mt-2.5 pt-2.5 border-t border-gray-700/50 text-[10px] text-gray-400 station-details">
            <div class="flex justify-between"><span>AQI Context:</span> <span class="text-gray-300 font-medium">${description}</span></div>
            <div class="flex justify-between"><span>PM2.5:</span> <span class="text-gray-300 font-medium">${pm25.toFixed(2)} µg/m³</span></div>
            ${area.pm10 && area.pm10.value ? `<div class="flex justify-between"><span>PM10:</span> <span class="text-gray-300 font-medium">${area.pm10.value.toFixed(2)} µg/m³</span></div>` : ''}
            <div class="flex justify-between"><span>Last Updated:</span> <span class="text-gray-300 font-medium">${dateString}, ${timeString}</span></div>
          </div>
        </div>
      `;
    }).join("");

    // Add click listeners to zoom into the markers and toggle details
    const areaElements = listEl.querySelectorAll('.station-item');
    areaElements.forEach(el => {
      el.addEventListener('click', (e) => {
        const item = e.currentTarget as HTMLElement;
        const lat = parseFloat(item.dataset.lat || "0");
        const lng = parseFloat(item.dataset.lng || "0");
        const deviceId = item.dataset.device;
        
        // Toggle 'hidden' class on the details section
        const details = item.querySelector('.station-details');
        if (details) {
          // Close others
          areaElements.forEach(otherEl => {
             if (otherEl !== item) {
                otherEl.querySelector('.station-details')?.classList.add('hidden');
             }
          });
          details.classList.toggle('hidden');
        }

        if (lat && lng) {
          this.map.panTo({ lat, lng });
          this.map.setZoom(15);
        }
        
        if (deviceId && this.stateManager.getMode() === "markers") {
          this.markerModule.openInfoWindowForDevice(deviceId);
        }
      });
    });
  }
}
