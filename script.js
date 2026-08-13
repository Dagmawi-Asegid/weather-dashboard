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
const unitToggle = document.getElementById("unitToggle");
const suggestionsEl = document.getElementById("suggestions");
const searchWrap = document.getElementById("searchForm");

let unit = "C";
let lastPlace = null;
let lastData = null;

// ---------- fuzzy matching ----------

function normalize(str) {
  return (str || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]/g, "");
}

function levenshtein(a, b) {
  const m = a.length;
  const n = b.length;
  if (!m) return n;
  if (!n) return m;
  const dp = new Array(n + 1);
  for (let j = 0; j <= n; j++) dp[j] = j;
  for (let i = 1; i <= m; i++) {
    let prev = dp[0];
    dp[0] = i;
    for (let j = 1; j <= n; j++) {
      const tmp = dp[j];
      dp[j] = a[i - 1] === b[j - 1] ? prev : 1 + Math.min(prev, dp[j], dp[j - 1]);
      prev = tmp;
    }
  }
  return dp[n];
}

function fuzzyMatches(query, cities, limit = 6) {
  const nq = normalize(query);
  if (!nq) return [];
  const maxAllowed = Math.max(2, Math.ceil(nq.length * 0.4));
  const scored = cities.map((c) => {
    const nc = normalize(c.name);
    let score;
    if (nc === nq) score = 0;
    else if (nc.startsWith(nq) || nq.startsWith(nc)) score = 0.5;
    else if (nc.includes(nq)) score = 1;
    else score = levenshtein(nq, nc);
    return { ...c, score };
  });
  return scored
    .filter((s) => s.score <= maxAllowed)
    .sort((a, b) => a.score - b.score || a.name.length - b.name.length)
    .slice(0, limit);
}

// ---------- API ----------

async function geocode(city, count = 1) {
  const res = await fetch(
    `${GEO_API}?name=${encodeURIComponent(city)}&count=${count}&language=en&format=json`
  );
  if (!res.ok) throw new Error(`Geocoding API responded ${res.status}`);
  const data = await res.json();
  return data.results || [];
}

async function getForecast(lat, lon) {
  const params = new URLSearchParams({
    latitude: lat,
    longitude: lon,
    current: "temperature_2m,apparent_temperature,relative_humidity_2m,weather_code,wind_speed_10m,is_day",
    daily: "weather_code,temperature_2m_max,temperature_2m_min",
    timezone: "auto",
    forecast_days: "5",
  });
  const res = await fetch(`${FORECAST_API}?${params}`);
  if (!res.ok) throw new Error(`Forecast API responded ${res.status}`);
  return res.json();
}

// ---------- rendering ----------

const toFahrenheit = (celsius) => (celsius * 9) / 5 + 32;
const formatTemp = (celsius) =>
  `${Math.round(unit === "C" ? celsius : toFahrenheit(celsius))}°${unit}`;

function placeLabel(place) {
  const parts = [place.name];
  if (place.admin1 && place.admin1 !== place.name) parts.push(place.admin1);
  if (place.country) parts.push(place.country);
  return parts.join(", ");
}

function renderCurrent(place, data) {
  const [text, icon] = describe(data.current.weather_code);
  document.getElementById("locationName").textContent = placeLabel(place);
  document.getElementById("conditionText").textContent = text;
  document.getElementById("tempIcon").textContent = icon;
  document.getElementById("tempValue").textContent = formatTemp(data.current.temperature_2m);
  document.getElementById("feelsLike").textContent = formatTemp(data.current.apparent_temperature);
  document.getElementById("humidity").textContent = `${data.current.relative_humidity_2m}%`;
  document.getElementById("wind").textContent = `${Math.round(data.current.wind_speed_10m)} km/h`;
}

function renderForecast(data) {
  const forecastEl = document.getElementById("forecast");
  forecastEl.innerHTML = "";
  data.daily.time.forEach((dateStr, i) => {
    const [text, icon] = describe(data.daily.weather_code[i]);
    const date = new Date(dateStr);
    const dayName = date.toLocaleDateString("en-US", { weekday: "short" });
    const card = document.createElement("div");
    card.className = "forecast-day";
    card.style.animationDelay = `${i * 60}ms`;
    card.innerHTML = `
      <p class="day-name">${dayName}</p>
      <p class="day-icon" title="${text}">${icon}</p>
      <p class="day-temps">
        <span class="max">${formatTemp(data.daily.temperature_2m_max[i])}</span>
        <span class="min">${formatTemp(data.daily.temperature_2m_min[i])}</span>
      </p>
    `;
    forecastEl.appendChild(card);
  });
}

// ---------- status / suggestions UI ----------

function showStatusNode(node) {
  statusEl.innerHTML = "";
  statusEl.appendChild(node);
  statusEl.hidden = false;
  resultsEl.hidden = true;
}

function showLoading(city) {
  const wrap = document.createElement("div");
  wrap.className = "loading";
  const spinner = document.createElement("div");
  spinner.className = "spinner";
  const text = document.createElement("p");
  text.textContent = `Looking up "${city}"…`;
  wrap.append(spinner, text);
  showStatusNode(wrap);
}

function chipRow(cities) {
  const chips = document.createElement("div");
  chips.className = "suggestion-chips";
  cities.forEach((c) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "chip";
    btn.textContent = c.name;
    btn.addEventListener("click", () => {
      cityInput.value = c.name;
      hideSuggestions();
      search(c.name);
    });
    chips.appendChild(btn);
  });
  return chips;
}

function showNotFound(query) {
  const wrap = document.createElement("div");
  const msg = document.createElement("p");
  msg.textContent = `We couldn't find "${query}". Check the spelling, add a space between words, or try one of these:`;
  wrap.appendChild(msg);
  const guesses = fuzzyMatches(query, MAJOR_CITIES, 6);
  wrap.appendChild(chipRow(guesses.length ? guesses : POPULAR_CITIES));
  showStatusNode(wrap);
}

function showError(message) {
  const p = document.createElement("p");
  p.textContent = message;
  showStatusNode(p);
}

function showResults() {
  statusEl.hidden = true;
  resultsEl.hidden = false;
}

// ---------- autocomplete dropdown ----------

let currentSuggestions = [];
let activeIndex = -1;
let debounceTimer = null;

function hideSuggestions() {
  clearTimeout(debounceTimer);
  suggestionsEl.hidden = true;
  suggestionsEl.innerHTML = "";
  currentSuggestions = [];
  activeIndex = -1;
  cityInput.removeAttribute("aria-activedescendant");
  cityInput.setAttribute("aria-expanded", "false");
}

function dedupeSuggestions(list) {
  const seen = new Set();
  const out = [];
  for (const item of list) {
    const key = `${normalize(item.name)}|${normalize(item.country || "")}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }
  return out.slice(0, 7);
}

function renderSuggestions(list) {
  currentSuggestions = list;
  activeIndex = -1;
  suggestionsEl.innerHTML = "";
  if (!list.length) {
    hideSuggestions();
    return;
  }
  list.forEach((item, i) => {
    const li = document.createElement("li");
    li.id = `suggestion-${i}`;
    li.className = "suggestion-item";
    li.setAttribute("role", "option");

    const name = document.createElement("span");
    name.className = "suggestion-name";
    name.textContent = item.name;
    li.appendChild(name);

    const meta = [item.admin1, item.country].filter(Boolean).join(", ");
    if (meta) {
      const metaEl = document.createElement("span");
      metaEl.className = "suggestion-meta";
      metaEl.textContent = meta;
      li.appendChild(metaEl);
    }

    li.addEventListener("mousedown", (e) => {
      e.preventDefault();
      selectSuggestion(item);
    });
    suggestionsEl.appendChild(li);
  });
  suggestionsEl.hidden = false;
  cityInput.setAttribute("aria-expanded", "true");
}

function setActive(index) {
  const items = suggestionsEl.querySelectorAll(".suggestion-item");
  items.forEach((el) => el.classList.remove("active"));
  if (index >= 0 && index < items.length) {
    items[index].classList.add("active");
    cityInput.setAttribute("aria-activedescendant", items[index].id);
  } else {
    cityInput.removeAttribute("aria-activedescendant");
  }
  activeIndex = index;
}

function selectSuggestion(item) {
  cityInput.value = item.name;
  hideSuggestions();
  if (typeof item.latitude === "number" && typeof item.longitude === "number") {
    search(item.name, item);
  } else {
    search(item.name);
  }
}

cityInput.addEventListener("input", () => {
  clearTimeout(debounceTimer);
  const q = cityInput.value.trim();
  if (q.length < 2) {
    hideSuggestions();
    return;
  }

  const local = fuzzyMatches(q, MAJOR_CITIES, 5);
  renderSuggestions(dedupeSuggestions(local));

  debounceTimer = setTimeout(async () => {
    if (cityInput.value.trim() !== q) return;
    try {
      let apiResults = await geocode(q, 8);
      if (!apiResults.length) {
        const guesses = fuzzyMatches(q, MAJOR_CITIES, 3);
        for (const guess of guesses) {
          const r = await geocode(guess.name, 2);
          apiResults.push(...r);
        }
      }
      if (cityInput.value.trim() !== q) return;
      const merged = dedupeSuggestions([...apiResults, ...local]);
      if (merged.length) renderSuggestions(merged);
    } catch {
      // Typeahead network errors are non-fatal; local suggestions still stand.
    }
  }, 250);
});

cityInput.addEventListener("keydown", (e) => {
  if (suggestionsEl.hidden) return;
  const count = currentSuggestions.length;
  if (e.key === "ArrowDown") {
    e.preventDefault();
    setActive((activeIndex + 1) % count);
  } else if (e.key === "ArrowUp") {
    e.preventDefault();
    setActive((activeIndex - 1 + count) % count);
  } else if (e.key === "Enter") {
    if (activeIndex >= 0) {
      e.preventDefault();
      selectSuggestion(currentSuggestions[activeIndex]);
    } else {
      hideSuggestions();
    }
  } else if (e.key === "Escape") {
    hideSuggestions();
  }
});

document.addEventListener("click", (e) => {
  if (!searchWrap.contains(e.target)) hideSuggestions();
});

// ---------- search ----------

async function search(cityQuery, knownPlace = null) {
  showLoading(cityQuery);
  hideSuggestions();
  try {
    let place = knownPlace;
    if (!place) {
      let results = await geocode(cityQuery, 1);
      if (!results.length) {
        const guesses = fuzzyMatches(cityQuery, MAJOR_CITIES, 5);
        for (const guess of guesses) {
          results = await geocode(guess.name, 1);
          if (results.length) break;
        }
      }
      if (!results.length) {
        showNotFound(cityQuery);
        return;
      }
      place = results[0];
    }
    const data = await getForecast(place.latitude, place.longitude);
    lastPlace = place;
    lastData = data;
    renderCurrent(place, data);
    renderForecast(data);
    WeatherScene.apply(data.current.weather_code, data.current.is_day === 1);
    showResults();
  } catch (err) {
    showError(err.message);
  }
}

form.addEventListener("submit", (e) => {
  e.preventDefault();
  if (activeIndex >= 0 && currentSuggestions[activeIndex]) {
    selectSuggestion(currentSuggestions[activeIndex]);
    return;
  }
  const city = cityInput.value.trim();
  hideSuggestions();
  if (city) search(city);
});

unitToggle.addEventListener("click", () => {
  unit = unit === "C" ? "F" : "C";
  unitToggle.textContent = `°${unit}`;
  if (lastPlace && lastData) {
    renderCurrent(lastPlace, lastData);
    renderForecast(lastData);
  }
});

search("Poughkeepsie");
