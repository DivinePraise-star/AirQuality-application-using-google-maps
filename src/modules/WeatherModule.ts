import { StateManager } from "../StateManager";

export class WeatherModule {
  private map: google.maps.Map;
  private stateManager: StateManager;
  private currentLat: number = 0;
  private currentLng: number = 0;
  private debounceTimer: number | null = null;

  constructor(map: google.maps.Map, stateManager: StateManager) {
    this.map = map;
    this.stateManager = stateManager;
    this.init();
  }

  private init() {
    this.map.addListener("idle", () => {
      if (this.debounceTimer) {
        clearTimeout(this.debounceTimer);
      }
      this.debounceTimer = window.setTimeout(() => {
        const center = this.map.getCenter();
        if (center) {
           this.fetchWeather(center.lat(), center.lng());
        }
      }, 1000);
    });

    // Initial fetch
    const center = this.map.getCenter();
    if (center) {
        this.fetchWeather(center.lat(), center.lng());
    }
  }

  private async fetchWeather(lat: number, lng: number) {
    // Avoid re-fetching for very small movements
    const distance = Math.sqrt(Math.pow(this.currentLat - lat, 2) + Math.pow(this.currentLng - lng, 2));
    if (distance < 0.05 && this.currentLat !== 0) {
        return; 
    }
    this.currentLat = lat;
    this.currentLng = lng;

    try {
      const conditionEl = document.getElementById("weather-condition");
      if (conditionEl) conditionEl.innerText = "Updating...";

      // Standard free non-commercial Open-Meteo API
      const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat.toFixed(4)}&longitude=${lng.toFixed(4)}&current=temperature_2m,relative_humidity_2m,weather_code&timezone=auto`;
      const response = await fetch(url);
      if (!response.ok) throw new Error("Weather request failed");
      
      const data = await response.json();
      const current = data.current;
      
      if (current) {
         this.updateUI(current.temperature_2m, current.relative_humidity_2m, current.weather_code);
      }
    } catch (e) {
      console.error(e);
      const conditionEl = document.getElementById("weather-condition");
      if (conditionEl) conditionEl.innerText = "Weather unavailable";
    }
  }

  private updateUI(temp: number, humidity: number, weatherCode: number) {
     const tempEl = document.getElementById("weather-temp");
     const humidityEl = document.getElementById("weather-humidity");
     const conditionEl = document.getElementById("weather-condition");
     const iconEl = document.getElementById("weather-icon");

     if (tempEl) tempEl.innerText = `${temp.toFixed(1)}°C`;
     if (humidityEl) humidityEl.innerText = `Humidity: ${humidity}%`;
     
     const { description, emoji } = this.getWeatherDetails(weatherCode);

     if (conditionEl) conditionEl.innerText = description;
     if (iconEl) iconEl.innerText = emoji;
  }

  // WMO Weather interpretation codes
  // https://open-meteo.com/en/docs
  private getWeatherDetails(code: number): { description: string, emoji: string } {
    switch (code) {
      case 0: return { description: "Clear Sky", emoji: "☀️" };
      case 1:
      case 2:
      case 3: return { description: "Partly Cloudy", emoji: "⛅" };
      case 45:
      case 48: return { description: "Foggy", emoji: "🌫️" };
      case 51:
      case 53:
      case 55: return { description: "Drizzle", emoji: "🌧️" };
      case 56:
      case 57: return { description: "Freezing Drizzle", emoji: "❄️" };
      case 61:
      case 63:
      case 65: return { description: "Rain", emoji: "🌧️" };
      case 66:
      case 67: return { description: "Freezing Rain", emoji: "❄️" };
      case 71:
      case 73:
      case 75: return { description: "Snow", emoji: "🌨️" };
      case 77: return { description: "Snow Grains", emoji: "🌨️" };
      case 80:
      case 81:
      case 82: return { description: "Rain Showers", emoji: "🌦️" };
      case 85:
      case 86: return { description: "Snow Showers", emoji: "🌨️" };
      case 95: return { description: "Thunderstorm", emoji: "⛈️" };
      case 96:
      case 99: return { description: "Heavy Thunderstorm", emoji: "⚡" };
      default: return { description: "Unknown", emoji: "🌡️" };
    }
  }
}
