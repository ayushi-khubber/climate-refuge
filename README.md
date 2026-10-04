# Climate Refuge

Climate Refuge is a free, static web app that helps people **respond to**, **anticipate**, **prepare for**, and **help with** climate-related disasters. Search any place (or use your location) and see live conditions, nearby hazards, the closest hospitals, a forecast, ten years of history, and vetted ways to give.

---

## Features

### Respond (right now)
- **Live conditions:** temperature, humidity, wind and gusts, and today's rain chance.
- **Hazards within 500 km:** open events from NASA EONET and M2.5+ earthquakes from the past day (USGS), sorted by distance.
- **Map:** your location, nearby hazards, and nearby hospitals on one Leaflet map.
- **Nearest hospitals and clinics:** the 10 closest within 15 km, from OpenStreetMap.
- **Safety guidance:** Before / During / After steps for floods, extreme heat, cyclones, wildfires and earthquakes. It switches automatically to match the disaster you are checking.
- **Local emergency number** for the US, Canada, UK, Australia and India (with a generic fallback).

### Live Events
- A world feed of the latest disasters, auto-refreshed every 10 minutes.
- Filter by type (wildfires, storms, floods, volcanoes, earthquakes and more).
- Each event links to official reporting (agency sources, ReliefWeb, GDACS).
- **"Check this area"** sends an event straight to the Respond tab, carrying its disaster type with it.

### Anticipate
- **7-day forecast** (min/max temperature and rain chance).
- **10-year history** bar chart for heat, rainfall, wind or drought, from the Open-Meteo archive (ERA5 reanalysis).
- A pointer to the ND-GAIN Country Index for vulnerability context. The app deliberately does **not** invent its own risk score.

### Prepare
- A go-bag checklist and a free-text family plan and contacts box.
- Saved in your browser's `localStorage`. Nothing is uploaded.

### Act & Give
- **Context-aware org cards:** organizations relevant to the disaster you just checked are highlighted and sorted first.
- Each card says who the org is best for, what a gift does, and links to its official site and a rating check.
- **How to give well:** cash over goods, unrestricted funds, monthly giving, underfunded crises (UN OCHA FTS), local vs international, and tax notes.
- **Verify before you give:** type a charity name to get Charity Navigator, CharityWatch and complaint-search links.
- **Scam red flags** and **non-money ways to help** (blood donation, volunteering, sharing verified info, checking on neighbors).

---

## Data sources

| Data | Source |
|---|---|
| Geocoding, forecast, historical weather | [Open-Meteo](https://open-meteo.com) |
| Natural hazard events | [NASA EONET](https://eonet.gsfc.nasa.gov) |
| Earthquakes | [USGS](https://earthquake.usgs.gov) |
| Hospitals and clinics, map tiles | [OpenStreetMap](https://www.openstreetmap.org) via the Overpass API |
| Maps | [Leaflet](https://leafletjs.com) |
| Official reporting links | ReliefWeb, GDACS |

Every number on the site is labeled **live**, **forecast**, or **historical**.

---
