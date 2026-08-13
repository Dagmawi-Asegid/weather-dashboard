// Animated background "scene" that reacts to the current weather condition
// and time of day. Pure DOM + CSS keyframes, no canvas/libraries.

const WeatherScene = (() => {
  const sceneEl = document.getElementById("weatherScene");
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  let lightningTimer = null;

  function categoryFor(code) {
    if (code === 0) return "clear";
    if (code === 1 || code === 2) return "cloudy";
    if (code === 3) return "overcast";
    if (code === 45 || code === 48) return "fog";
    if ([51, 53, 55].includes(code)) return "drizzle";
    if ([61, 63, 65, 80, 81, 82].includes(code)) return "rain";
    if ([71, 73, 75, 77, 85, 86].includes(code)) return "snow";
    if ([95, 96, 99].includes(code)) return "thunder";
    return "cloudy";
  }

  function rand(min, max) {
    return Math.random() * (max - min) + min;
  }

  function el(className) {
    const div = document.createElement("div");
    div.className = className;
    return div;
  }

  function buildClouds(count) {
    const frag = document.createDocumentFragment();
    for (let i = 0; i < count; i++) {
      const cloud = el("cloud");
      const scale = rand(0.6, 1.6);
      cloud.style.top = `${rand(4, 40)}%`;
      cloud.style.setProperty("--scale", scale);
      cloud.style.opacity = rand(0.45, 0.9).toFixed(2);
      cloud.style.animationDuration = `${rand(40, 90)}s`;
      cloud.style.animationDelay = `-${rand(0, 60)}s`;
      frag.appendChild(cloud);
    }
    return frag;
  }

  function buildRain(count) {
    const frag = document.createDocumentFragment();
    for (let i = 0; i < count; i++) {
      const drop = el("raindrop");
      drop.style.left = `${rand(0, 100)}%`;
      drop.style.animationDuration = `${rand(0.35, 0.75)}s`;
      drop.style.animationDelay = `-${rand(0, 2)}s`;
      drop.style.opacity = rand(0.3, 0.7).toFixed(2);
      frag.appendChild(drop);
    }
    return frag;
  }

  function buildSnow(count) {
    const frag = document.createDocumentFragment();
    for (let i = 0; i < count; i++) {
      const flake = el("snowflake");
      flake.style.left = `${rand(0, 100)}%`;
      const size = rand(3, 7);
      flake.style.width = `${size}px`;
      flake.style.height = `${size}px`;
      flake.style.animationDuration = `${rand(6, 13)}s, ${rand(2.5, 4.5)}s`;
      flake.style.animationDelay = `-${rand(0, 10)}s, -${rand(0, 4)}s`;
      flake.style.opacity = rand(0.5, 0.95).toFixed(2);
      frag.appendChild(flake);
    }
    return frag;
  }

  function buildFog() {
    const frag = document.createDocumentFragment();
    for (let i = 0; i < 4; i++) {
      const band = el("fog-band");
      band.style.top = `${i * 26 + rand(-5, 5)}%`;
      band.style.animationDuration = `${rand(30, 55)}s`;
      band.style.animationDelay = `-${rand(0, 30)}s`;
      band.style.opacity = rand(0.25, 0.5).toFixed(2);
      frag.appendChild(band);
    }
    return frag;
  }

  function buildStars(count) {
    const frag = document.createDocumentFragment();
    for (let i = 0; i < count; i++) {
      const star = el("star");
      star.style.left = `${rand(0, 100)}%`;
      star.style.top = `${rand(0, 70)}%`;
      star.style.animationDuration = `${rand(2, 5)}s`;
      star.style.animationDelay = `-${rand(0, 5)}s`;
      const size = rand(1, 2.4);
      star.style.width = `${size}px`;
      star.style.height = `${size}px`;
      frag.appendChild(star);
    }
    return frag;
  }

  function startLightning() {
    stopLightning();
    const flash = el("lightning-flash");
    sceneEl.appendChild(flash);
    const strike = () => {
      flash.classList.remove("strike");
      // Force reflow so the animation can restart.
      void flash.offsetWidth;
      flash.classList.add("strike");
      lightningTimer = setTimeout(strike, rand(3500, 8000));
    };
    lightningTimer = setTimeout(strike, rand(1000, 3000));
  }

  function stopLightning() {
    if (lightningTimer) {
      clearTimeout(lightningTimer);
      lightningTimer = null;
    }
  }

  function apply(weatherCode, isDay) {
    stopLightning();
    sceneEl.innerHTML = "";
    const category = categoryFor(weatherCode);
    sceneEl.className = `weather-scene scene-${category} ${isDay ? "is-day" : "is-night"}`;

    if (reduceMotion) return;

    if (category === "clear" && isDay) {
      sceneEl.appendChild(el("sun"));
    } else if (category === "clear" && !isDay) {
      sceneEl.appendChild(el("moon"));
      sceneEl.appendChild(buildStars(60));
    } else if (category === "cloudy") {
      if (!isDay) {
        sceneEl.appendChild(el("moon"));
        sceneEl.appendChild(buildStars(30));
      } else {
        sceneEl.appendChild(el("sun"));
      }
      sceneEl.appendChild(buildClouds(4));
    } else if (category === "overcast") {
      if (!isDay) sceneEl.appendChild(buildStars(15));
      sceneEl.appendChild(buildClouds(7));
    } else if (category === "fog") {
      sceneEl.appendChild(buildFog());
    } else if (category === "drizzle") {
      sceneEl.appendChild(buildClouds(5));
      sceneEl.appendChild(buildRain(35));
    } else if (category === "rain") {
      sceneEl.appendChild(buildClouds(6));
      sceneEl.appendChild(buildRain(90));
    } else if (category === "snow") {
      sceneEl.appendChild(buildClouds(5));
      sceneEl.appendChild(buildSnow(55));
    } else if (category === "thunder") {
      sceneEl.appendChild(buildClouds(7));
      sceneEl.appendChild(buildRain(90));
      startLightning();
    }
  }

  return { apply, categoryFor };
})();
