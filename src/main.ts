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
        btnMarkers?.classList.add("bg-blue-600", "text-white");
        btnMarkers?.classList.remove("text-gray-400", "hover:bg-gray-700");
        
        btnHeatmap?.classList.add("text-gray-400", "hover:bg-gray-700");
        btnHeatmap?.classList.remove("bg-blue-600", "text-white");
      } else {
        btnHeatmap?.classList.add("bg-blue-600", "text-white");
        btnHeatmap?.classList.remove("text-gray-400", "hover:bg-gray-700");
        
        btnMarkers?.classList.add("text-gray-400", "hover:bg-gray-700");
        btnMarkers?.classList.remove("bg-blue-600", "text-white");
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

    // 5. Fetch Data
    if (loadingIndicator) loadingIndicator.classList.remove("hidden");
    
    // Fetch AirQo Data
    const data = await AirQoAPI.fetchMeasurements();
    
    // Update state with fetched data
    stateManager.setMeasurements(data);
    
    // Adjust map to data bounds or center on a specific region
    if (data.length > 0 && data[0].deviceDetails) {
       map.setCenter({ 
           lat: data[0].deviceDetails.latitude, 
           lng: data[0].deviceDetails.longitude 
       });
       map.setZoom(11);
    }
    
    if (loadingIndicator) loadingIndicator.classList.add("hidden");

  } catch (error) {
    console.error("Initialization error:", error);
    if (loadingIndicator) loadingIndicator.classList.add("hidden");
    if (errorMessage) {
      errorMessage.innerText = error instanceof Error ? error.message : "An unknown error occurred.";
      errorMessage.classList.remove("hidden");
    }
  }
});
