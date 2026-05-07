import { AIRQO_API_URL } from "./constants";

export interface AirQoMeasurement {
  device: string;
  deviceDetails?: {
    _id: string;
    name: string;
    latitude: number;
    longitude: number;
  };
  pm2_5: {
    value: number;
  };
  pm10?: {
    value: number;
  };
  time: string;
}

export class AirQoAPI {
  /**
   * Fetches real-time measurements from the AirQo API
   * We add basic error handling as per the teaching guidelines
   */
  static async fetchMeasurements(): Promise<AirQoMeasurement[]> {
    try {
      const response = await fetch(AIRQO_API_URL, {
        method: "GET",
        headers: {
          "Accept": "application/json"
        },
        credentials: "include"
      });
      
      const contentType = response.headers.get("content-type");
      if (contentType && contentType.includes("text/html")) {
        const text = await response.text();
        if (text.includes("Cookie check")) {
          throw new Error("Browser is blocking cookies. Please open the app in a new tab.");
        }
        throw new Error(`Expected JSON but got HTML. Status: ${response.status}`);
      }

      if (!response.ok) {
        let errorText = `Status: ${response.status}`;
        try {
           const errData = await response.json();
           if (errData.error) errorText += ` - ${errData.error}`;
        } catch (e) {
           // ignore json parse error
        }
        throw new Error(`Failed to fetch AirQo data! ${errorText}`);
      }

      const data = await response.json();
      
      // Validate response structure
      if (!data || !data.measurements) {
        throw new Error("Invalid format received from AirQo API: Missing 'measurements' array.");
      }

      // Filter out measurements without location or pm2.5 data
      return data.measurements.filter((m: any) => 
        m.deviceDetails &&
        m.deviceDetails.latitude &&
        m.deviceDetails.longitude &&
        m.pm2_5 &&
        m.pm2_5.value !== null
      ) as AirQoMeasurement[];
      
    } catch (error) {
      console.error("AirQo API Error:", error);
      throw error;
    }
  }

  /**
   * Helper function to get color based on PM2.5 AQI categorizations
   */
  static getAQIColor(pm25Value: number): string {
    if (pm25Value <= 12.0) return "#00e400"; // Good
    if (pm25Value <= 35.4) return "#ffff00"; // Moderate
    if (pm25Value <= 55.4) return "#ff7e00"; // Unhealthy for Sensitive Groups
    if (pm25Value <= 150.4) return "#ff0000"; // Unhealthy
    if (pm25Value <= 250.4) return "#8f3f97"; // Very Unhealthy
    return "#7e0023"; // Hazardous
  }

  /**
   * Helper function to get emoji based on PM2.5 AQI
   */
  static getAQIEmoji(pm25Value: number): string {
    if (pm25Value <= 12.0) return "😊"; // Good
    if (pm25Value <= 35.4) return "😐"; // Moderate
    if (pm25Value <= 55.4) return "😷"; // Unhealthy for Sensitive Groups
    if (pm25Value <= 150.4) return "🤢"; // Bad / Unhealthy
    if (pm25Value <= 250.4) return "🤮"; // Very Bad / Very Unhealthy
    return "☠️"; // Hazardous
  }

  /**
   * Helper function to get description based on PM2.5 AQI
   */
  static getAQIDescription(pm25Value: number): string {
    if (pm25Value <= 12.0) return "Good Quality"; 
    if (pm25Value <= 35.4) return "Moderate Quality"; 
    if (pm25Value <= 55.4) return "Unhealthy for Sensitive Groups"; 
    if (pm25Value <= 150.4) return "Bad Quality"; 
    if (pm25Value <= 250.4) return "Very Bad Quality"; 
    return "Hazardous"; 
  }
}
