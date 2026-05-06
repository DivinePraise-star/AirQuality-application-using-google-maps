import { AirQoMeasurement, AirQoAPI } from "../api";
import { MarkerClusterer } from "@googlemaps/markerclusterer";

export class MarkerModule {
  private map: google.maps.Map;
  private markers: google.maps.marker.AdvancedMarkerElement[] = [];
  private clusterer: MarkerClusterer | null = null;
  private openInfoWindow: google.maps.InfoWindow | null = null;

  constructor(map: google.maps.Map) {
    this.map = map;
  }

  async render(measurements: AirQoMeasurement[]) {
    this.clear();
    
    // Load the marker library
    const { AdvancedMarkerElement, PinElement } = await google.maps.importLibrary("marker") as google.maps.MarkerLibrary;

    this.markers = measurements.map((measurement) => {
      const pm25 = measurement.pm2_5.value;
      const color = AirQoAPI.getAQIColor(pm25);
      const emoji = AirQoAPI.getAQIEmoji(pm25);
      const description = AirQoAPI.getAQIDescription(pm25);

      const glyphEl = document.createElement("div");
      glyphEl.style.fontSize = "14px";
      glyphEl.style.lineHeight = "1";
      glyphEl.textContent = emoji;

      const pin = new PinElement({
        background: color,
        borderColor: "#ffffff",
        glyph: glyphEl,
      });

      const startPosition = {
        lat: measurement.deviceDetails!.latitude,
        lng: measurement.deviceDetails!.longitude,
      };

      // Format time
      const date = new Date(measurement.time);
      const timeString = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      const dateString = date.toLocaleDateString([], { month: 'short', day: 'numeric' });
      const pm10Html = measurement.pm10 && measurement.pm10.value 
        ? `<div style="display: flex; align-items: center; justify-content: space-between; border-top: 1px solid #333; padding-top: 6px; margin-top: 4px;">
             <span style="font-size: 11px; color: #888;">PM10:</span>
             <span style="font-size: 11px; color: #ccc;">${measurement.pm10.value.toFixed(1)} µg/m³</span>
           </div>`
        : '';

      const marker = new AdvancedMarkerElement({
        position: startPosition,
        title: `${measurement.deviceDetails!.name}: ${pm25.toFixed(1)} PM2.5`,
        content: pin.element,
      });

      // Optional: Add info window on click
      marker.addEventListener("gmp-click", () => {
        if (this.openInfoWindow) {
          this.openInfoWindow.close();
        }
        
        const infoWindow = new google.maps.InfoWindow({
           content: `
             <div style="color: #fff; background-color: #111827; padding: 12px; font-family: ui-sans-serif, system-ui, sans-serif; min-width: 200px; border-radius: 8px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06); border: 1px solid #374151;">
               <div style="font-size: 10px; color: #9ca3af; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 4px;">STATION</div>
               <strong style="display: block; margin-bottom: 8px; font-size: 14px; font-weight: 600; line-height: 1.2;">${measurement.deviceDetails!.name}</strong>
               
               <div style="display: flex; gap: 6px; margin-bottom: 12px; align-items: center;">
                 <span style="font-size: 16px;">${emoji}</span>
                 <span style="font-size: 12px; font-weight: 500; color: #d1d5db;">${description}</span>
               </div>
               
               <div style="display: flex; flex-direction: column; gap: 4px;">
                 <div style="display: flex; align-items: center; justify-content: space-between; border-top: 1px solid #374151; padding-top: 8px;">
                   <span style="font-size: 11px; color: #9ca3af;">PM2.5:</span>
                   <span style="font-size: 12px; font-weight: 700; background: ${color}; padding: 2px 8px; border-radius: 9999px; color: ${this.getContrastYIQ(color)};">
                     ${pm25.toFixed(1)} µg/m³
                   </span>
                 </div>
                 ${pm10Html}
                 <div style="display: flex; align-items: center; justify-content: space-between; border-top: 1px solid #374151; padding-top: 6px; margin-top: 2px;">
                   <span style="font-size: 10px; color: #6b7280;">Last updated:</span>
                   <span style="font-size: 10px; color: #9ca3af;">${dateString}, ${timeString}</span>
                 </div>
               </div>
             </div>
           `
        });
        
        infoWindow.open({
          anchor: marker,
          map: this.map,
        });
        
        // Remove default white background of google maps infowindow
        google.maps.event.addListener(infoWindow, 'domready', () => {
          const iwOuter = document.querySelector('.gm-style-iw.gm-style-iw-c');
          if (iwOuter) {
            (iwOuter as HTMLElement).style.padding = '0';
            (iwOuter as HTMLElement).style.backgroundColor = 'transparent';
            (iwOuter as HTMLElement).style.boxShadow = 'none';
            (iwOuter as HTMLElement).style.borderRadius = '8px';
          }
          const iwBackground = document.querySelector('.gm-style-iw-d');
          if (iwBackground) {
             (iwBackground as HTMLElement).style.overflow = 'hidden';
          }
          // Try to hide the close button or style it
          const iwCloseBtn = document.querySelector('.gm-ui-hover-effect');
          if (iwCloseBtn) {
            (iwCloseBtn as HTMLElement).style.display = 'none';
          }
        });
        
        this.openInfoWindow = infoWindow;
      });

      return marker;
    });

    // Initialize the MarkerClusterer instead of adding markers directly to the map
    this.clusterer = new MarkerClusterer({
      map: this.map,
      markers: this.markers,
    });
  }

  // Helper function to figure out text color over AQI badge backgrounds
  private getContrastYIQ(hexcolor: string) {
    hexcolor = hexcolor.replace("#", "");
    const r = parseInt(hexcolor.substr(0, 2), 16);
    const g = parseInt(hexcolor.substr(2, 2), 16);
    const b = parseInt(hexcolor.substr(4, 2), 16);
    const yiq = (r * 299 + g * 587 + b * 114) / 1000;
    return yiq >= 128 ? "black" : "white";
  }

  clear() {
    if (this.openInfoWindow) {
      this.openInfoWindow.close();
      this.openInfoWindow = null;
    }
    
    if (this.clusterer) {
      this.clusterer.clearMarkers();
      this.clusterer = null;
    } else {
      this.markers.forEach((marker) => {
        marker.map = null;
      });
    }
    
    this.markers = [];
  }
}
