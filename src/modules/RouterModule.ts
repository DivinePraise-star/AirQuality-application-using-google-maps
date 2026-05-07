import { importLibrary } from "@googlemaps/js-api-loader";
import { StateManager } from "../StateManager";
import { AirQoAPI } from "../api";

export class RouterModule {
  private map: google.maps.Map;
  private stateManager: StateManager;
  private polylines: google.maps.Polyline[] = [];
  
  private originPlace: google.maps.LatLng | null = null;
  private destinationPlace: google.maps.LatLng | null = null;
  
  private routeLib: any = null;

  constructor(map: google.maps.Map, stateManager: StateManager) {
    this.map = map;
    this.stateManager = stateManager;
    this.init();
  }

  private async init() {
    this.setupUI();
    // @ts-ignore
    this.routeLib = await importLibrary("routes");

    const originInput = document.getElementById("origin-input") as HTMLInputElement;
    const destInput = document.getElementById("destination-input") as HTMLInputElement;

    // Map click fallback for missing Places API
    this.map.addListener("click", (e: any) => {
        const routeBody = document.getElementById("routing-body");
        if (!routeBody || routeBody.classList.contains("hidden")) return; // Only if planner is open

        if (!this.originPlace) {
           this.originPlace = e.latLng;
           if (originInput) originInput.value = `📍 Picked on map: ${e.latLng.lat().toFixed(4)}, ${e.latLng.lng().toFixed(4)}`;
        } else if (!this.destinationPlace) {
           this.destinationPlace = e.latLng;
           if (destInput) destInput.value = `🏁 Picked on map: ${e.latLng.lat().toFixed(4)}, ${e.latLng.lng().toFixed(4)}`;
        }
    });
    
    // Add logic for button calculate
    const calcBtn = document.getElementById("btn-calc-route");
    if (calcBtn) {
       calcBtn.addEventListener("click", () => {
         this.calculateRoute();
       });
    }

    const clearBtn = document.getElementById("btn-clear-route");
    if (clearBtn) {
       clearBtn.addEventListener("click", () => {
          this.clearRoutes();
       });
    }
  }

  private setupUI() {
    const header = document.getElementById("routing-header");
    const body = document.getElementById("routing-body");
    const chevron = document.getElementById("routing-chevron");
    
    if (header && body && chevron) {
      header.addEventListener("click", () => {
        body.classList.toggle("hidden");
        if (body.classList.contains("hidden")) {
          chevron.style.transform = "rotate(0deg)";
        } else {
          chevron.style.transform = "rotate(180deg)";
        }
      });
    }
  }



  private clearRoutes() {
    this.polylines.forEach(p => p.setMap(null));
    this.polylines = [];
    document.getElementById("btn-clear-route")?.classList.add("hidden");
    document.getElementById("routing-results")?.classList.add("hidden");
    const calcBtn = document.getElementById("btn-calc-route");
    if (calcBtn) {
      calcBtn.innerText = "Find Cleanest Route";
      (calcBtn as HTMLButtonElement).disabled = false;
      calcBtn.classList.remove("opacity-50", "cursor-not-allowed");
    }
    
    // Reset selections if they were made via map click
    this.originPlace = null;
    this.destinationPlace = null;
    const originInput = document.getElementById("origin-input") as HTMLInputElement;
    const destInput = document.getElementById("destination-input") as HTMLInputElement;
    
    if (originInput) originInput.value = '';
    if (destInput) destInput.value = '';
  }

  private async calculateRoute() {
     const originInput = document.getElementById("origin-input") as HTMLInputElement;
     const destInput = document.getElementById("destination-input") as HTMLInputElement;

     if (!this.routeLib) return;

     let originRaw: string | google.maps.LatLng | null = null;
     let destRaw: string | google.maps.LatLng | null = null;

     if (originInput && originInput.value) {
         if (originInput.value.startsWith("📍 Picked") && this.originPlace) {
             originRaw = this.originPlace;
         } else {
             originRaw = originInput.value;
         }
     }
     if (destInput && destInput.value) {
         if (destInput.value.startsWith("🏁 Picked") && this.destinationPlace) {
             destRaw = this.destinationPlace;
         } else {
             destRaw = destInput.value;
         }
     }

     if (!originRaw || !destRaw) {
        alert("Please enter both an origin and destination or pick them on the map.");
        return;
     }

     const calcBtn = document.getElementById("btn-calc-route") as HTMLButtonElement;
     if (calcBtn) {
        calcBtn.innerText = "Calculating...";
        calcBtn.disabled = true;
        calcBtn.classList.add("opacity-50", "cursor-not-allowed");
     }

     this.clearRoutes();

     // Re-disable since clearRoutes enables it
     if (calcBtn) {
        calcBtn.innerText = "Calculating...";
        calcBtn.disabled = true;
        calcBtn.classList.add("opacity-50", "cursor-not-allowed");
     }

     try {
         const request = {
            origin: originRaw,
            destination: destRaw,
            travelMode: 'DRIVING',
            computeAlternativeRoutes: true,
            fields: ['path', 'distanceMeters', 'durationMillis', 'viewport', 'legs', 'localizedValues']
         };

         this.routeLib.Route.computeRoutes(request).then((response: any) => {
             if (response.routes && response.routes.length > 0) {
                 this.evaluateAndDrawRoutes(response.routes);
             } else {
                 alert("Could not find a route.");
                 this.clearRoutes();
             }
         }).catch((e: Error) => {
             alert("Directions request failed: " + e.message);
             this.clearRoutes();
         });
     } catch (e) {
         console.error(e);
         this.clearRoutes();
     }
  }

  private evaluateAndDrawRoutes(routes: any[]) {
      const measurements = this.stateManager.getMeasurements();
      
      let bestRouteIndex = 0;
      let minAvgPm25 = Infinity;
      let routeScores: { avgPm25: number; maxPm25: number }[] = [];

      routes.forEach((route, index) => {
          const path = route.path;
          let totalPm25 = 0;
          let count = 0;
          let maxPm25 = 0;

          // For simplicity, we just evaluate the route path by finding nearest requested points
          if (path) {
              path.forEach((point: any) => {
                 let closestMeasure = null;
                 let minDistance = Infinity;

                 measurements.forEach(m => {
                     if (m.deviceDetails?.latitude && m.deviceDetails?.longitude) {
                         const mLatLng = new google.maps.LatLng(m.deviceDetails.latitude, m.deviceDetails.longitude);
                         const dist = google.maps.geometry.spherical.computeDistanceBetween({lat: point.lat, lng: point.lng}, mLatLng);
                         if (dist < 5000 && dist < minDistance) {  // within 5km
                             minDistance = dist;
                             closestMeasure = m;
                         }
                     }
                 });

                 if (closestMeasure) {
                     const val = closestMeasure.pm2_5.value;
                     totalPm25 += val;
                     if (val > maxPm25) maxPm25 = val;
                     count++;
                 }
              });
          }

          let avgPm25 = count > 0 ? totalPm25 / count : 20; // fallback to 20 if no data
          routeScores.push({ avgPm25, maxPm25 });

          if (avgPm25 < minAvgPm25) {
              minAvgPm25 = avgPm25;
              bestRouteIndex = index;
          }
      });

      // Draw routes
      routes.forEach((route, index) => {
         const isBest = index === bestRouteIndex;
         const score = routeScores[index].avgPm25;
         
         let strokeColor = "#888888"; // default grey
         let strokeOpacity = 0.4;
         let zIndex = 1;

         if (isBest) {
             strokeColor = AirQoAPI.getAQIColor(score); // Use AQI coloring for the best route
             strokeOpacity = 0.9;
             zIndex = 10;
         }

         const polylines = route.createPolylines({
             strokeColor: strokeColor,
             strokeOpacity: strokeOpacity,
             strokeWeight: isBest ? 6 : 4,
             zIndex: zIndex,
         });
         
         polylines.forEach((pl: any) => {
             pl.setMap(this.map);
             this.polylines.push(pl);
         });
         
         // Fit bounds for all
         if (index === 0 && route.viewport) {
            this.map.fitBounds(route.viewport);
         }
      });

      this.showResults(routes[bestRouteIndex], routeScores[bestRouteIndex], bestRouteIndex);
  }

  private showResults(bestRoute: any, score: { avgPm25: number, maxPm25: number }, index: number) {
     const resultsDiv = document.getElementById("routing-results");
     const statsDiv = document.getElementById("routing-stats");
     const clearBtn = document.getElementById("btn-clear-route");
     const calcBtn = document.getElementById("btn-calc-route") as HTMLButtonElement;

     if (calcBtn) {
         calcBtn.innerText = "Recalculate Route";
         calcBtn.disabled = false;
         calcBtn.classList.remove("opacity-50", "cursor-not-allowed");
     }

     if (resultsDiv && statsDiv && clearBtn) {
         resultsDiv.classList.remove("hidden");
         clearBtn.classList.remove("hidden");

         const color = AirQoAPI.getAQIColor(score.avgPm25);
         const emoji = AirQoAPI.getAQIEmoji(score.avgPm25);
         
         const distText = bestRoute.legs?.[0]?.localizedValues?.distance || "Unknown Dist";
         const durText = bestRoute.legs?.[0]?.localizedValues?.duration || "Unknown Time";
         
         statsDiv.innerHTML = `
           <div class="flex items-center gap-2 mb-2">
             <span class="text-xl">${emoji}</span>
             <div>
                <span class="font-bold text-gray-100 block leading-tight">Cleanest Route Found</span>
                <span class="text-[10px] text-gray-400">Distance: ${distText} • Time: ${durText}</span>
             </div>
           </div>
           <div class="flex flex-col gap-1 mt-2">
             <div class="flex justify-between items-center bg-gray-800 px-2 py-1.5 rounded">
                <span>Avg PM2.5:</span> 
                <span class="font-bold px-1.5 py-0.5 rounded text-[10px]" style="background-color: ${color}; color: #000;">${score.avgPm25.toFixed(1)} µg/m³</span>
             </div>
             <div class="flex justify-between items-center bg-gray-800 px-2 py-1.5 rounded text-[10px]">
                <span class="text-gray-400">Max PM2.5 detected:</span> 
                <span class="text-gray-300 font-medium">${score.maxPm25.toFixed(1)} µg/m³</span>
             </div>
           </div>
         `;
     }
  }
}
