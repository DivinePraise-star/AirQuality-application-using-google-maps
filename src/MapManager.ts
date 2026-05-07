import { setOptions, importLibrary } from "@googlemaps/js-api-loader";
import { GOOGLE_MAPS_API_KEY, DEFAULT_MAP_CENTER, DEFAULT_MAP_ZOOM } from "./constants";

export class MapManager {
  private map: google.maps.Map | null = null;
  
  async initMap(elementId: string): Promise<google.maps.Map> {
    // 1. Initialize the Google Maps Config
    setOptions({
      key: GOOGLE_MAPS_API_KEY,
      v: "weekly",
      libraries: ["visualization", "geometry", "routes"],
    });

    // 2. Load the maps API
    const { Map } = await importLibrary("maps");

    const mapElement = document.getElementById(elementId);
    if (!mapElement) {
      throw new Error(`Element with id ${elementId} not found`);
    }

    // 3. Create the Map using the standard google.maps object
    this.map = new Map(mapElement, {
      center: DEFAULT_MAP_CENTER,
      zoom: DEFAULT_MAP_ZOOM,
      mapId: "e44d37fe3c597db2", // This map ID has dark styling or fallback to custom styles
      disableDefaultUI: true, // We are building our own UI layer
      zoomControl: true,
      zoomControlOptions: {
          position: google.maps.ControlPosition.RIGHT_BOTTOM
      }
    });

    return this.map;
  }

  getMap(): google.maps.Map | null {
    return this.map;
  }
}
