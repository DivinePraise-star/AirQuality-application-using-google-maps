import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";

async function startServer() {
  const app = express();
  const PORT = 3000;

  // AirQo API Proxy
  app.get("/api/airqo/measurements", async (req, res) => {
    try {
      const apiKey = process.env.AIRQO_API_KEY || "MF2GK8AH3UU3DN5X";
      if (!apiKey) {
         return res.status(500).json({ error: "AIRQO_API_KEY is not configured on the server." });
      }
      const airqoUrl = `https://api.airqo.net/api/v2/devices/events?token=${apiKey}`;

      console.log(`Proxying request to: ${airqoUrl}`);
      
      const response = await fetch(airqoUrl, {
        method: "GET",
      });
      
      if (!response.ok) {
        console.error(`AirQo API Error: Status ${response.status}`);
        const text = await response.text();
        console.error(text.slice(0, 500));
        return res.status(response.status).json({ error: `API Error: ${response.status}` });
      }

      const data = await response.json();
      res.json(data);
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

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
