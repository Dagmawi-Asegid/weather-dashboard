const GEO_API = "https://geocoding-api.open-meteo.com/v1/search";
const FORECAST_API = "https://api.open-meteo.com/v1/forecast";

const WEATHER_CODES = {
  0: ["Clear sky", "☀️"],
  1: ["Mainly clear", "🌤️"],
  2: ["Partly cloudy", "⛅"],
  3: ["Overcast", "☁️"],
  45: ["Fog", "🌫️"],
  48: ["Depositing rime fog", "🌫️"],
  51: ["Light drizzle", "🌦️"],
  53: ["Moderate drizzle", "🌦️"],
  55: ["Dense drizzle", "🌧️"],
  61: ["Slight rain", "🌦️"],
  63: ["Moderate rain", "🌧️"],
  65: ["Heavy rain", "🌧️"],
  71: ["Slight snow", "🌨️"],
  73: ["Moderate snow", "🌨️"],
  75: ["Heavy snow", "❄️"],
  80: ["Rain showers", "🌦️"],
  81: ["Moderate showers", "🌧️"],
  82: ["Violent showers", "⛈️"],
  95: ["Thunderstorm", "⛈️"],
  96: ["Thunderstorm w/ hail", "⛈️"],
  99: ["Thunderstorm w/ hail", "⛈️"],
};

const describe = (code) => WEATHER_CODES[code] ?? ["Unknown", "❓"];

const statusEl = document.getElementById("status");
const resultsEl = document.getElementById("results");
const form = document.getElementById("searchForm");
const cityInput = document.getElementById("cityInput");

async function geocode(city) {
  const res = await fetch(`${GEO_API}?name=${encodeURIComponent(city)}&count=1&language=en&format=json`);
  if (!res.ok) throw new Error(`Geocoding API responded ${res.status}`);
  const data = await res.json();
  if (!data.results || !data.results.length) throw new Error(`No location found for "${city}"`);
  return data.results[0];
}

async function getForecast(lat, lon) {
  const params = new URLSearchParams({
    latitude: lat,
    longitude: lon,
    current: "temperature_2m,apparent_temperature,relative_humidity_2m,weather_code,wind_speed_10m",
    daily: "weather_code,temperature_2m_max,temperature_2m_min",
    timezone: "auto",
    forecast_days: "5",
  });
  const res = await fetch(`${FORECAST_API}?${params}`);
  if (!res.ok) throw new Error(`Forecast API responded ${res.status}`);
  return res.json();
}

function renderCurrent(place, data) {
  const [text, icon] = describe(data.current.weather_code);
  document.getElementById("locationName").textContent = `${place.name}${place.admin1 ? ", " + place.admin1 : ""}, ${place.country}`;
  document.getElementById("conditionText").textContent = text;
  document.getElementById("tempIcon").textContent = icon;
  document.getElementById("tempValue").textContent = `${Math.round(data.current.temperature_2m)}°C`;
  document.getElementById("feelsLike").textContent = `${Math.round(data.current.apparent_temperature)}°C`;
  document.getElementById("humidity").textContent = `${data.current.relative_humidity_2m}%`;
  document.getElementById("wind").textContent = `${Math.round(data.current.wind_speed_10m)} km/h`;
}

function renderForecast(data) {
  const forecastEl = document.getElementById("forecast");
  forecastEl.innerHTML = "";
  data.daily.time.forEach((dateStr, i) => {
    const [, icon] = describe(data.daily.weather_code[i]);
    const date = new Date(dateStr);
    const dayName = date.toLocaleDateString("en-US", { weekday: "short" });
    const card = document.createElement("div");
    card.className = "forecast-day";
    card.innerHTML = `
      <p class="day-name">${dayName}</p>
      <p class="day-icon">${icon}</p>
      <p class="day-temps">
        <span class="max">${Math.round(data.daily.temperature_2m_max[i])}°</span>
        <span class="min">${Math.round(data.daily.temperature_2m_min[i])}°</span>
      </p>
    `;
    forecastEl.appendChild(card);
  });
}

async function search(city) {
  statusEl.hidden = false;
  statusEl.textContent = `Looking up "${city}"…`;
  resultsEl.hidden = true;
  try {
    const place = await geocode(city);
    const data = await getForecast(place.latitude, place.longitude);
    renderCurrent(place, data);
    renderForecast(data);
    statusEl.hidden = true;
    resultsEl.hidden = false;
  } catch (err) {
    statusEl.hidden = false;
    statusEl.textContent = err.message;
  }
}

form.addEventListener("submit", (e) => {
  e.preventDefault();
  const city = cityInput.value.trim();
  if (city) search(city);
});

search("Poughkeepsie");
