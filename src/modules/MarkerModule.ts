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
             <div style="color: black; padding: 4px; font-family: sans-serif; min-width: 180px;">
               <strong style="display: block; margin-bottom: 4px; font-size: 14px;">${measurement.deviceDetails!.name}</strong>
               <div style="margin-bottom: 8px; font-size: 13px; color: #444;">
                 <span>${emoji} ${description}</span>
               </div>
               <div style="display: flex; align-items: center; justify-content: space-between; border-top: 1px solid #ccc; padding-top: 6px;">
                 <span style="font-size: 12px; color: #666;">PM2.5:</span>
                 <span style="font-size: 12px; font-weight: bold; background: ${color}; padding: 2px 6px; border-radius: 4px; color: ${this.getContrastYIQ(color)};">
                   ${pm25.toFixed(1)} µg/m³
                 </span>
               </div>
             </div>
           `
        });
        infoWindow.open({
          anchor: marker,
          map: this.map,
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
