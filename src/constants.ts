// Load API keys from environment variables
// Make sure to add VITE_GOOGLE_MAPS_API_KEY into AI Studio secret or .env file.
export const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || "AIzaSyAwNR0RoKOamzkTkJbq9TPE--yiSAzBw3M";
export const AIRQO_API_URL = "/api/airqo/measurements";

// Kampala, Uganda (center for AirQo data typically)
export const DEFAULT_MAP_CENTER = { lat: 0.347596, lng: 32.582520 };
export const DEFAULT_MAP_ZOOM = 12;
