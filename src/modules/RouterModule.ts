import { StateManager } from "../StateManager";
import { AirQoAPI } from "../api";

export class RouterModule {
  private map: google.maps.Map;
  private stateManager: StateManager;
  private polylines: google.maps.Polyline[] = [];
  
  private originPlace: google.maps.LatLng | null = null;
  private destinationPlace: google.maps.LatLng | null = null;
  private infoWindow?: google.maps.InfoWindow;

  constructor(map: google.maps.Map, stateManager: StateManager) {
    this.map = map;
    this.stateManager = stateManager;
    this.init();
  }

  private async init() {
    this.setupUI();

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

    const useLocationBtn = document.getElementById("btn-use-location");
    if (useLocationBtn) {
       useLocationBtn.addEventListener("click", () => {
          if (navigator.geolocation) {
             useLocationBtn.innerText = "Locating...";
             navigator.geolocation.getCurrentPosition(
               (position) => {
                 this.originPlace = new google.maps.LatLng(position.coords.latitude, position.coords.longitude);
                 if (originInput) originInput.value = `📍 Current Location`;
                 useLocationBtn.innerText = "Use My Location";
               },
               (e) => {
                 console.error(e);
                 useLocationBtn.innerText = "Use My Location";
                 alert("Error: The Geolocation service failed. Please ensure location permissions are granted.");
               }
             );
          } else {
             alert("Error: Your browser doesn't support geolocation.");
          }
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



  private clearRoutes(keepInputs: boolean = false) {
    this.polylines.forEach(p => p.setMap(null));
    this.polylines = [];
    if (this.infoWindow) {
      this.infoWindow.close();
    }
    document.getElementById("btn-clear-route")?.classList.add("hidden");
    document.getElementById("routing-results")?.classList.add("hidden");
    const calcBtn = document.getElementById("btn-calc-route");
    if (calcBtn) {
      calcBtn.innerText = "Find Cleanest Route";
      (calcBtn as HTMLButtonElement).disabled = false;
      calcBtn.classList.remove("opacity-50", "cursor-not-allowed");
    }
    
    if (!keepInputs) {
      // Reset selections if they were made via map click
      this.originPlace = null;
      this.destinationPlace = null;
      const originInput = document.getElementById("origin-input") as HTMLInputElement;
      const destInput = document.getElementById("destination-input") as HTMLInputElement;
      
      if (originInput) originInput.value = '';
      if (destInput) destInput.value = '';
    }
  }

  private async calculateRoute() {
     const originInput = document.getElementById("origin-input") as HTMLInputElement;
     const destInput = document.getElementById("destination-input") as HTMLInputElement;

     let originRaw: string | google.maps.LatLng | null = null;
     let destRaw: string | google.maps.LatLng | null = null;

     if (originInput && originInput.value) {
         if (originInput.value.startsWith("📍") && this.originPlace) {
             originRaw = this.originPlace;
         } else {
             originRaw = originInput.value;
         }
     }
     if (destInput && destInput.value) {
         if (destInput.value.startsWith("🏁") && this.destinationPlace) {
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

     this.clearRoutes(true);

     // Re-disable since clearRoutes enables it
     if (calcBtn) {
        calcBtn.innerText = "Calculating...";
        calcBtn.disabled = true;
        calcBtn.classList.add("opacity-50", "cursor-not-allowed");
     }

     try {
         const directionsService = new google.maps.DirectionsService();
         
         const request: google.maps.DirectionsRequest = {
            origin: originRaw,
            destination: destRaw,
            travelMode: google.maps.TravelMode.DRIVING,
            provideRouteAlternatives: true
         };

         directionsService.route(request, (response, status) => {
             if (status === google.maps.DirectionsStatus.OK && response && response.routes && response.routes.length > 0) {
                 this.evaluateAndDrawRoutes(response.routes);
             } else {
                 if (status === google.maps.DirectionsStatus.ZERO_RESULTS) {
                    alert("Could not find a driving route between these locations.");
                 } else if (status === google.maps.DirectionsStatus.REQUEST_DENIED) {
                    alert("Directions API Request Denied. Please ensure both 'Maps JavaScript API' and 'Directions API' are enabled in your Google Cloud Console for this API key, and that the key is unrestricted or properly restricted.");
                 } else {
                    alert("Directions request failed: " + status);
                 }
                 this.clearRoutes(true);
             }
         });
     } catch (e) {
         console.error(e);
         this.clearRoutes(true);
     }
  }

  private evaluateAndDrawRoutes(routes: any[]) {
      const measurements = this.stateManager.getMeasurements();
      
      let bestRouteIndex = 0;
      let minAvgPm25 = Infinity;
      let routeScores: { avgPm25: number; maxPm25: number }[] = [];

      routes.forEach((route, index) => {
          const path = route.overview_path;
          let totalPm25 = 0;
          let count = 0;
          let maxPm25 = 0;

          // For simplicity, we just evaluate the route path by finding nearest requested points
          if (path) {
              path.forEach((point: google.maps.LatLng) => {
                 let closestMeasure = null;
                 let minDistance = Infinity;

                 measurements.forEach(m => {
                     if (m.deviceDetails?.latitude && m.deviceDetails?.longitude) {
                         const mLatLng = new google.maps.LatLng(m.deviceDetails.latitude, m.deviceDetails.longitude);
                         const dist = google.maps.geometry.spherical.computeDistanceBetween(point, mLatLng);
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
         
         let strokeColor = "#3b82f6"; // blue for alternatives
         let strokeOpacity = 0.6;
         let zIndex = 1;

         if (isBest) {
             strokeColor = AirQoAPI.getAQIColor(score); // Use AQI coloring for the best route
             strokeOpacity = 1.0;
             zIndex = 10;
         }

         const polyline = new google.maps.Polyline({
             path: route.overview_path,
             strokeColor: strokeColor,
             strokeOpacity: strokeOpacity,
             strokeWeight: isBest ? 6 : 4,
             zIndex: zIndex,
             map: this.map
         });
         
         polyline.addListener("mouseover", (e: google.maps.PolyMouseEvent) => {
             if (!this.infoWindow) {
                 this.infoWindow = new google.maps.InfoWindow();
             }
             
             const aqiDesc = AirQoAPI.getAQIDescription(score);
             const emoji = AirQoAPI.getAQIEmoji(score);
             const textColor = AirQoAPI.getAQIColor(score) === "#000000" ? "#ffffff" : "#1f2937";
             const bgColor = AirQoAPI.getAQIColor(score);
             
             const popupContent = `
                <div class="px-3 py-2 -m-1 font-sans rounded-lg flex flex-col gap-1.5 min-w-[160px]">
                   <div class="font-semibold text-sm flex items-center gap-1.5 ${isBest ? 'text-blue-600' : 'text-gray-700'}">
                      ${isBest ? '✨ Best Route' : 'Alternative Route'}
                   </div>
                   <div class="flex items-center gap-2">
                       <div class="text-xs font-semibold px-2 py-0.5 rounded shadow-sm text-gray-900" style="background-color: ${bgColor}">
                          ${score.toFixed(1)} µg/m³
                       </div>
                       <span class="text-lg">${emoji}</span>
                   </div>
                   <div class="text-xs text-gray-600 font-medium">
                      ${aqiDesc.description}
                   </div>
                </div>
             `;
             
             this.infoWindow.setContent(popupContent);
             this.infoWindow.setPosition(e.latLng);
             this.infoWindow.open(this.map);
             
             polyline.setOptions({ strokeOpacity: 1.0, strokeWeight: 7, zIndex: 20 });
         });
         
         polyline.addListener("mouseout", () => {
             if (this.infoWindow) {
                 this.infoWindow.close();
             }
             polyline.setOptions({ strokeOpacity: strokeOpacity, strokeWeight: isBest ? 6 : 4, zIndex: zIndex });
         });
         
         this.polylines.push(polyline);
         
         // Fit bounds for all
         if (index === 0 && route.bounds) {
            this.map.fitBounds(route.bounds);
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
         
         const distText = bestRoute.legs?.[0]?.distance?.text || "Unknown Dist";
         const durText = bestRoute.legs?.[0]?.duration?.text || "Unknown Time";
         
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
