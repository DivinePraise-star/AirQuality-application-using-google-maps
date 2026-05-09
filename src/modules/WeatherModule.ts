import { StateManager } from "../StateManager";

export class WeatherModule {
  private map: google.maps.Map;
  private stateManager: StateManager;
  private currentLat: number = 0;
  private currentLng: number = 0;
  private debounceTimer: number | null = null;
  private isExpanded: boolean = false;

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

    const header = document.getElementById("weather-header");
    if (header) {
      header.addEventListener("click", () => this.toggleFormat());
    }

    // Initial fetch
    const center = this.map.getCenter();
    if (center) {
        this.fetchWeather(center.lat(), center.lng());
    }
  }

  private toggleFormat() {
    this.isExpanded = !this.isExpanded;
    const body = document.getElementById("weather-forecast-body");
    const chevron = document.getElementById("weather-chevron");
    if (body) {
      if (this.isExpanded) {
        body.classList.remove("hidden");
        body.classList.add("flex");
      } else {
        body.classList.add("hidden");
        body.classList.remove("flex");
      }
    }
    if (chevron) {
      chevron.style.transform = this.isExpanded ? "rotate(180deg)" : "rotate(0deg)";
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
      const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat.toFixed(4)}&longitude=${lng.toFixed(4)}&current=temperature_2m,relative_humidity_2m,weather_code&daily=weather_code,temperature_2m_max,temperature_2m_min&timezone=auto&forecast_days=3`;
      const response = await fetch(url);
      if (!response.ok) throw new Error("Weather request failed");
      
      const data = await response.json();
      const current = data.current;
      const daily = data.daily;
      
      if (current) {
         this.updateUI(current.temperature_2m, current.relative_humidity_2m, current.weather_code);
      }
      
      if (daily) {
         this.renderForecast(daily);
      }
    } catch (e) {
      console.error(e);
      const conditionEl = document.getElementById("weather-condition");
      if (conditionEl) conditionEl.innerText = "Weather unavailable";
    }
  }

  private renderForecast(daily: any) {
    const container = document.getElementById("forecast-container");
    if (!container) return;
    
    container.innerHTML = "";
    
    const time = daily.time;
    const maxTemps = daily.temperature_2m_max;
    const minTemps = daily.temperature_2m_min;
    const codes = daily.weather_code;
    
    for (let i = 0; i < time.length; i++) {
       const dateStr = time[i];
       const dateObj = new Date(dateStr);
       // Format day: 'Mon', 'Tue' etc.
       const dayName = dateObj.toLocaleDateString("en-US", { weekday: "short" });
       const { emoji } = this.getWeatherDetails(codes[i]);
       
       const maxT = Math.round(maxTemps[i]);
       const minT = Math.round(minTemps[i]);
       
       const itemStr = `
         <div class="bg-gray-900/60 border border-gray-800/80 rounded-xl p-2.5 flex flex-col items-center text-center justify-center gap-1.5 transition-colors hover:bg-gray-900/80 shadow-sm">
            <div class="text-[10px] font-medium text-gray-500 uppercase tracking-widest">${dayName}</div>
            <div class="text-3xl drop-shadow-sm my-1">${emoji}</div>
            <div class="text-xs font-mono font-medium mt-0.5">
               <span class="text-gray-100">${maxT}°</span><span class="text-gray-500 ml-1.5">${minT}°</span>
            </div>
         </div>
       `;
       container.innerHTML += itemStr;
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
