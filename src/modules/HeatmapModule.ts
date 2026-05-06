import { GoogleMapsOverlay } from "@deck.gl/google-maps";
import { HeatmapLayer } from "@deck.gl/aggregation-layers";
import { AirQoMeasurement } from "../api";

export class HeatmapModule {
  private map: google.maps.Map;
  private overlay: GoogleMapsOverlay | null = null;

  constructor(map: google.maps.Map) {
    this.map = map;
  }

  render(measurements: AirQoMeasurement[]) {
    this.clear();

    // Transform API data for the deck.gl heatmap
    // It expects an array of points, each point typically containing [lng, lat, weight]
    const heatmapData = measurements.map((m) => {
      const pm25 = m.pm2_5.value;
      return [
        m.deviceDetails!.longitude,
        m.deviceDetails!.latitude,
        Math.min(pm25 / 100, 1) // Normalize weight between 0.0 and 1.0 (approximating 100 as hazardous max for weight scaling)
      ];
    });

    // We use deck.gl's HeatmapLayer instead of google.maps.visualization to follow modern practices
    const layer = new HeatmapLayer({
      id: "airquality-heatmap",
      data: heatmapData,
      getPosition: (d: any) => [d[0], d[1]],
      getWeight: (d: any) => d[2],
      radiusPixels: 40,
      intensity: 1.5,
      threshold: 0.05,
    });

    this.overlay = new GoogleMapsOverlay({
      layers: [layer],
    });

    this.overlay.setMap(this.map);
  }

  clear() {
    if (this.overlay) {
      this.overlay.setMap(null);
      this.overlay = null;
    }
  }
}
