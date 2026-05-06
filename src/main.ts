import "./index.css";
import { StateManager } from "./StateManager";
import { MapManager } from "./MapManager";
import { StageManager } from "./StageManager";
import { AirQoAPI } from "./api";

// Ensure styles load correctly
// Wait for DOM to be ready
document.addEventListener("DOMContentLoaded", async () => {
  const loadingIndicator = document.getElementById("loading-indicator");
  const errorMessage = document.getElementById("error-message");
  
  try {
    // 1. Initialize State Manager
    const stateManager = new StateManager();

    // 2. Initialize Google Maps
    const mapManager = new MapManager();
    const map = await mapManager.initMap("map");

    // 3. Initialize Stage Manager (Orchestrator)
    new StageManager(map, stateManager);

    // 4. Setup UI Events for Toggle Buttons
    const btnMarkers = document.getElementById("mode-markers");
    const btnHeatmap = document.getElementById("mode-heatmap");

    const updateButtonStyles = (mode: string) => {
      if (mode === "markers") {
        btnMarkers?.classList.add("bg-white", "text-gray-900", "shadow-sm");
        btnMarkers?.classList.remove("text-gray-400", "hover:text-white", "hover:bg-gray-800");
        
        btnHeatmap?.classList.add("text-gray-400", "hover:text-white", "hover:bg-gray-800");
        btnHeatmap?.classList.remove("bg-white", "text-gray-900", "shadow-sm");
      } else {
        btnHeatmap?.classList.add("bg-white", "text-gray-900", "shadow-sm");
        btnHeatmap?.classList.remove("text-gray-400", "hover:text-white", "hover:bg-gray-800");
        
        btnMarkers?.classList.add("text-gray-400", "hover:text-white", "hover:bg-gray-800");
        btnMarkers?.classList.remove("bg-white", "text-gray-900", "shadow-sm");
      }
    };

    btnMarkers?.addEventListener("click", () => {
      stateManager.setMode("markers");
      updateButtonStyles("markers");
    });

    btnHeatmap?.addEventListener("click", () => {
      stateManager.setMode("heatmap");
      updateButtonStyles("heatmap");
    });

    // 5. Fetch Data Logic
    const fetchData = async () => {
      try {
        // Only show loading indicator heavily on initial load to avoid UI jumping every 2 mins
        if (loadingIndicator && stateManager.getMeasurements().length === 0) {
          loadingIndicator.classList.remove("hidden");
        }
        
        // Fetch AirQo Data
        const data = await AirQoAPI.fetchMeasurements();
        
        // Update state with fetched data
        stateManager.setMeasurements(data);
        
        const timestampEl = document.getElementById("last-updated-text");
        if (timestampEl) {
           const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
           timestampEl.innerText = `Live data from AirQo • Updated at ${timeStr}`;
        }

        if (errorMessage) errorMessage.classList.add("hidden");
      } catch (error) {
        console.error("Data refresh error:", error);
        if (errorMessage) {
          errorMessage.innerText = error instanceof Error ? error.message : "Failed to fetch data.";
          errorMessage.classList.remove("hidden");
        }
      } finally {
        if (loadingIndicator) loadingIndicator.classList.add("hidden");
      }
    };

    // Initial fetch
    await fetchData();

    // Adjust map to data bounds or center on a specific region based on initial data
    const initialData = stateManager.getMeasurements();
    if (initialData.length > 0 && initialData[0].deviceDetails) {
       map.setCenter({ 
           lat: initialData[0].deviceDetails.latitude, 
           lng: initialData[0].deviceDetails.longitude 
       });
       map.setZoom(11);
    }

    // Set interval for periodic refresh (every 2 minutes)
    setInterval(fetchData, 2 * 60 * 1000);

  } catch (error) {
    console.error("Initialization error:", error);
    if (loadingIndicator) loadingIndicator.classList.add("hidden");
    if (errorMessage) {
      errorMessage.innerText = error instanceof Error ? error.message : "An unknown error occurred.";
      errorMessage.classList.remove("hidden");
    }
  }
});
