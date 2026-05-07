import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Log all requests
  app.use((req, res, next) => {
    console.log(`[Express] Incoming request: ${req.method} ${req.url}`);
    next();
  });

  // AirQo API Proxy
let cachedAirQoData: any = null;
let lastAirQoFetchTime: number = 0;
let isFetchingAirQo: boolean = false;

app.get("/api/proxy/air-quality", async (req, res) => {
  try {
    const apiKey = process.env.AIRQO_API_KEY || "MF2GK8AH3UU3DN5X";
    if (!apiKey) {
       return res.status(500).json({ error: "AIRQO_API_KEY is not configured on the server." });
    }

    const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes
    const now = Date.now();

    // If we have fresh cache, return it immediately
    if (cachedAirQoData && (now - lastAirQoFetchTime < CACHE_DURATION)) {
      return res.json(cachedAirQoData);
    }

    // Trigger background fetch if not already fetching
    if (!isFetchingAirQo) {
      isFetchingAirQo = true;
      const airqoUrl = `https://api.airqo.net/api/v2/devices/events?token=${apiKey}`;
      console.log(`Fetching new data from AirQo...`);
      
      // Fire and forget fetch to avoid blocking the request
      fetch(airqoUrl)
        .then(async (response) => {
          if (!response.ok) {
            console.error(`AirQo API Background Error: Status ${response.status}`);
            return;
          }
          const data = await response.json();
          if (data && data.measurements) {
            cachedAirQoData = data;
            lastAirQoFetchTime = Date.now();
            console.log(`Successfully updated AirQo cache with ${data.measurements.length} records.`);
          }
        })
        .catch(err => {
          console.error("Background fetch error:", err);
        })
        .finally(() => {
          isFetchingAirQo = false;
        });
    }

    // If we have STALE cache, return it immediately while background fetch happens
    if (cachedAirQoData) {
      return res.json(cachedAirQoData);
    }

    // First time request: we MUST wait since there is no cache
    const airqoUrl = `https://api.airqo.net/api/v2/devices/events?token=${apiKey}`;
    console.log(`Proxying first request to: ${airqoUrl}`);
    
    // Add an AbortController to timeout gracefully before Nginx drops it
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 20000); // 20 seconds timeout

    try {
      const response = await fetch(airqoUrl, {
        method: "GET",
        signal: controller.signal
      });
      clearTimeout(timeoutId);

      if (!response.ok) {
        return res.status(response.status).json({ error: `API Error: ${response.status}` });
      }

      const data = await response.json();
      cachedAirQoData = data;
      lastAirQoFetchTime = Date.now();
      res.json(data);
    } catch (fetchErr: any) {
      clearTimeout(timeoutId);
      if (fetchErr.name === 'AbortError') {
        return res.status(504).json({ error: "AirQo API took too long to respond. Please try again soon." });
      }
      throw fetchErr;
    }

  } catch (error) {
    console.error("Proxy error:", error);
    res.status(500).json({ error: "Internal Server Error during Proxy" });
  }
});

  // Proxy for grids if needed
  app.get("/api/airqo/grids", async (req, res) => {
    try {
      const apiKey = process.env.AIRQO_API_KEY || "MF2GK8AH3UU3DN5X";
      if (!apiKey) {
         return res.status(500).json({ error: "AIRQO_API_KEY is not configured on the server." });
      }
      const airqoUrl = `https://api.airqo.net/api/v2/devices/metadata/grids?token=${apiKey}`;

      console.log(`Proxying request to: ${airqoUrl}`);
      
      const response = await fetch(airqoUrl);
      
      if (!response.ok) {
        return res.status(response.status).json({ error: `API Error: ${response.status}` });
      }

      const data = await response.json();
      res.json(data);
    } catch (error) {
      console.error("Proxy error:", error);
      res.status(500).json({ error: "Internal Server Error during Proxy" });
    }
  });


  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    // For Express 4 (installed in this project)
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  // Pre-fetch cache on server startup
  const apiKey = process.env.AIRQO_API_KEY || "MF2GK8AH3UU3DN5X";
  const airqoUrl = `https://api.airqo.net/api/v2/devices/events?token=${apiKey}`;
  console.log("Pre-fetching AirQo data on server startup to warm cache...");
  fetch(airqoUrl)
    .then(async (response) => {
      if (response.ok) {
        const data = await response.json();
        if (data && data.measurements) {
          cachedAirQoData = data;
          lastAirQoFetchTime = Date.now();
          console.log(`Pre-fetch successful! Cached ${data.measurements.length} records.`);
        }
      } else {
        console.error("Pre-fetch failed with status:", response.status);
      }
    })
    .catch((err) => console.error("Pre-fetch threw error:", err));

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
