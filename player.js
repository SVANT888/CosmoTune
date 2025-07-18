// CosmoTune Radio Player
// Main JavaScript file for all app logic, UI updates, and event handling
// Author: Farai S
// Last updated: 2025-05-29
//
// This file handles:
// - Globe visualization
// - Fetching and rendering radio stations
// - Audio playback controls
// - User authentication and profile
// - Favorites and history
// - Settings and preferences
// - Accessibility and keyboard navigation

// --- Audio Player State ---
const audio = new Audio(); // Main audio element for playback
let isPlaying = false; // Track if audio is currently playing
let currentStationIndex = 0; // Index of the currently playing station
let stations = []; // Array of all loaded stations
let favorites = JSON.parse(localStorage.getItem("radioFavorites")) || []; // Favorite stations
let currentUser = JSON.parse(localStorage.getItem("currentUser")) || null; // Logged-in user
let users = JSON.parse(localStorage.getItem("users")) || []; // All registered users

// --- Globe Visualization ---
const globe = Globe()
  .globeImageUrl("//unpkg.com/three-globe/example/img/earth-blue-marble.jpg")
  .bumpImageUrl("//unpkg.com/three-globe/example/img/earth-topology.png")
  .backgroundImageUrl("//unpkg.com/three-globe/example/img/night-sky.png")
  .showAtmosphere(true)
  .atmosphereColor("rgba(63, 201, 255, 0.2)")
  .atmosphereAltitude(0.25)(document.getElementById("globeViz"));

// Auto-rotate the globe for visual effect
function animateGlobe() {
  globe.controls().autoRotate = true;
  globe.controls().autoRotateSpeed = 0.5;
  requestAnimationFrame(animateGlobe);
}

// Add random city lights and arcs for visual interest
const N = 30;
const gData = [...Array(N).keys()].map(() => ({
  lat: (Math.random() - 0.5) * 180,
  lng: (Math.random() - 0.5) * 360,
  size: Math.random() / 3,
  color: ["#3b82f6", "#8b5cf6", "#ec4899", "#10b981"][
    Math.round(Math.random() * 3)
  ],
}));

globe
  .pointsData(gData)
  .pointAltitude(0.01)
  .pointColor("color")
  .pointRadius("size");

// Simulate radio station connections
const arcsData = [...Array(15).keys()].map(() => {
  const src = gData[Math.round(Math.random() * (N - 1))];
  const dst = gData[Math.round(Math.random() * (N - 1))];
  return {
    startLat: src.lat,
    startLng: src.lng,
    endLat: dst.lat,
    endLng: dst.lng,
    color: [src.color, dst.color],
  };
});

globe
  .arcsData(arcsData)
  .arcColor("color")
  .arcDashLength(0.5)
  .arcDashGap(0.1)
  .arcDashAnimateTime(3000);

// Make the globe responsive to window size
window.addEventListener("resize", () => {
  globe.camera().aspect = window.innerWidth / window.innerHeight;
  globe.camera().updateProjectionMatrix();
  globe.width([window.innerWidth]);
  globe.height([window.innerHeight]);
});

// --- Station Fetching and Rendering ---
// Fetch radio stations from Radio Browser API and update the UI
async function fetchStations(searchTerm = "", searchType = "name") {
  const stationsContainer = document.getElementById("stationsContainer");
  stationsContainer.innerHTML = `
    <div class="col-span-3 flex justify-center py-10">
      <div class="loading-spinner"></div>
    </div>
  `;

  try {
    // Use multiple API endpoints for better reliability
    const apiEndpoints = [
      "https://de1.api.radio-browser.info/json",
      "https://nl1.api.radio-browser.info/json",
      "https://at1.api.radio-browser.info/json",
      "https://fr1.api.radio-browser.info/json",
    ];

    let url;
    let response;
    let finalEndpoint;

    // Try each endpoint until one works
    for (const endpoint of apiEndpoints) {
      try {
        // Build URL based on search type and term
        if (searchTerm) {
          // Determine search endpoint based on search type
          if (searchType === "country") {
            url = `${endpoint}/stations/bycountry/${encodeURIComponent(
              searchTerm
            )}?limit=100&hidebroken=true&order=votes&reverse=true`;
          } else if (searchType === "tag" || searchType === "genre") {
            url = `${endpoint}/stations/bytag/${encodeURIComponent(
              searchTerm
            )}?limit=100&hidebroken=true&order=votes&reverse=true`;
          } else {
            // Default name search
            url = `${endpoint}/stations/search?name=${encodeURIComponent(
              searchTerm
            )}&limit=100&hidebroken=true&order=votes&reverse=true`;
          }
        } else {
          // Get popular stations when no search term - get top voted stations
          url = `${endpoint}/stations/topvote/100`;
        }

        console.log(`Trying API endpoint: ${url}`);

        response = await fetch(url, {
          method: "GET",
          headers: {
            "User-Agent": "CosmoTune/1.0",
            Accept: "application/json",
          },
        });

        if (response.ok) {
          finalEndpoint = endpoint;
          console.log(`Successfully connected to: ${endpoint}`);
          break;
        } else {
          console.log(`HTTP error ${response.status} from ${endpoint}`);
        }
      } catch (endpointError) {
        console.log(`Failed to connect to ${endpoint}:`, endpointError.message);
        continue;
      }
    }

    if (!response || !response.ok) {
      throw new Error(`All API endpoints failed`);
    }

    stations = await response.json();
    console.log(`Received ${stations.length} stations from ${finalEndpoint}`);

    // Filter stations with valid URLs and remove duplicates
    stations = stations
      .filter(
        (station) =>
          station.url_resolved &&
          station.name &&
          station.url_resolved.startsWith("http")
      )
      .filter(
        (station, index, self) =>
          index ===
          self.findIndex((s) => s.url_resolved === station.url_resolved)
      );

    if (stations.length === 0) {
      stationsContainer.innerHTML = `
        <div class="col-span-3 text-center py-10">
          <i class="fas fa-satellite-dish text-4xl text-gray-500 mb-4"></i>
          <p class="text-xl">No stations found. Try a different search term.</p>
        </div>
      `;
      return;
    }

    renderStations();
    updateGlobeWithStations();

    // Show success message that real API data is loaded
    showToast(`Loaded ${stations.length} stations successfully!`, "success");
  } catch (error) {
    console.error("Error fetching stations:", error);

    // Use mock data for testing when API fails
    console.log("API failed, using mock data for demonstration...");
    stations = [
      {
        stationuuid: "mock-1",
        name: "BBC Radio 1",
        country: "United Kingdom",
        state: "England",
        url_resolved: "http://stream.live.vc.bbcmedia.co.uk/bbc_radio_one",
        favicon: "https://static.mytuner.mobi/media/tvos_radios/2LS2zx3Geb.png",
        tags: "pop, rock, music, entertainment",
        language: "english",
      },
      {
        stationuuid: "mock-2",
        name: "NPR News",
        country: "United States",
        state: "Washington DC",
        url_resolved: "https://npr-ice.streamguys1.com/live.mp3",
        favicon: "https://media.npr.org/chrome_svg/npr-logo.svg",
        tags: "news, talk, current affairs",
        language: "english",
      },
      {
        stationuuid: "mock-3",
        name: "Radio France Info",
        country: "France",
        state: "Paris",
        url_resolved: "https://icecast.radiofrance.fr/franceinfo-lofi.mp3",
        favicon: "https://www.francetvinfo.fr/static/img/favicon.ico",
        tags: "news, french, information",
        language: "french",
      },
      {
        stationuuid: "mock-4",
        name: "Classic FM",
        country: "United Kingdom",
        state: "England",
        url_resolved: "http://media-ice.musicradio.com/ClassicFMMP3",
        favicon:
          "https://planetradio.co.uk/common-images/stations/classicfm.png",
        tags: "classical, music, orchestral",
        language: "english",
      },
      {
        stationuuid: "mock-5",
        name: "Radio Cidade",
        country: "Brazil",
        state: "Rio de Janeiro",
        url_resolved: "https://centova.svdns.com.br:20020/;",
        favicon: "https://radiocidade.am.br/favicon.ico",
        tags: "brazilian, samba, latin music",
        language: "portuguese",
      },
      {
        stationuuid: "mock-6",
        name: "Radio Tokyo FM",
        country: "Japan",
        state: "Tokyo",
        url_resolved: "https://radio-tokyo.com/stream",
        favicon: "https://www.tfm.co.jp/favicon.ico",
        tags: "j-pop, japanese, tokyo",
        language: "japanese",
      },
      {
        stationuuid: "mock-7",
        name: "KEXP 90.3 FM",
        country: "United States",
        state: "Washington",
        url_resolved: "https://kexp-mp3-128.streamguys1.com/kexp128.mp3",
        favicon: "https://kexp.org/favicon.ico",
        tags: "alternative, indie, experimental",
        language: "english",
      },
      {
        stationuuid: "mock-8",
        name: "Radio Swiss Jazz",
        country: "Switzerland",
        state: "Zurich",
        url_resolved: "http://stream.srg-ssr.ch/m/rsj/mp3_128",
        favicon: "https://www.radioswissjazz.ch/favicon.ico",
        tags: "jazz, smooth jazz, contemporary",
        language: "multilingual",
      },
      {
        stationuuid: "mock-9",
        name: "ABC Jazz",
        country: "Australia",
        state: "Sydney",
        url_resolved: "https://live-radio01.mediahubaustralia.com/2JJW/mp3/",
        favicon: "https://www.abc.net.au/favicon.ico",
        tags: "jazz, australian, contemporary",
        language: "english",
      },
      {
        stationuuid: "mock-10",
        name: "Radio Paradise",
        country: "United States",
        state: "California",
        url_resolved: "https://stream.radioparadise.com/aac-320",
        favicon: "https://radioparadise.com/favicon.ico",
        tags: "eclectic, world music, alternative",
        language: "english",
      },
      {
        stationuuid: "mock-11",
        name: "FIP Radio",
        country: "France",
        state: "Paris",
        url_resolved: "https://icecast.radiofrance.fr/fip-hifi.aac",
        favicon: "https://www.fip.fr/favicon.ico",
        tags: "eclectic, world, electronic, jazz",
        language: "french",
      },
      {
        stationuuid: "mock-12",
        name: "Triple J",
        country: "Australia",
        state: "Sydney",
        url_resolved: "https://live-radio01.mediahubaustralia.com/2TJW/mp3/",
        favicon: "https://www.abc.net.au/triplej/favicon.ico",
        tags: "alternative, indie, australian",
        language: "english",
      },
      {
        stationuuid: "mock-13",
        name: "SomaFM Groove Salad",
        country: "United States",
        state: "California",
        url_resolved: "https://ice1.somafm.com/groovesalad-256-mp3",
        favicon: "https://somafm.com/favicon.ico",
        tags: "ambient, electronic, chill",
        language: "english",
      },
      {
        stationuuid: "mock-14",
        name: "Radio Nacional Argentina",
        country: "Argentina",
        state: "Buenos Aires",
        url_resolved: "https://sa.mp3.icecast.magma.edge-access.net/sc_rad37",
        favicon: "https://www.radionacional.com.ar/favicon.ico",
        tags: "tango, latin, news, talk",
        language: "spanish",
      },
      {
        stationuuid: "mock-15",
        name: "NRK P3",
        country: "Norway",
        state: "Oslo",
        url_resolved: "https://lyd.nrk.no/nrk_radio_p3_mp3_h",
        favicon: "https://www.nrk.no/favicon.ico",
        tags: "pop, rock, norwegian",
        language: "norwegian",
      },
      {
        stationuuid: "mock-16",
        name: "Radio Studio Souto",
        country: "Italy",
        state: "Milan",
        url_resolved: "https://www.radiosouto.it/stream",
        favicon: "https://www.radiosouto.it/favicon.ico",
        tags: "italian, pop, contemporary",
        language: "italian",
      },
      {
        stationuuid: "mock-17",
        name: "BBC Radio 6 Music",
        country: "United Kingdom",
        state: "London",
        url_resolved: "http://stream.live.vc.bbcmedia.co.uk/bbc_6music",
        favicon: "https://static.mytuner.mobi/media/tvos_radios/bbc6music.png",
        tags: "alternative, indie, rock",
        language: "english",
      },
      {
        stationuuid: "mock-18",
        name: "Radio Swiss Pop",
        country: "Switzerland",
        state: "Bern",
        url_resolved: "http://stream.srg-ssr.ch/m/rsp/mp3_128",
        favicon: "https://www.radioswiss.ch/favicon.ico",
        tags: "pop, swiss, contemporary",
        language: "multilingual",
      },
      {
        stationuuid: "mock-19",
        name: "Deutschlandfunk",
        country: "Germany",
        state: "Cologne",
        url_resolved: "https://st01.sslstream.dlf.de/dlf/01/128/mp3/stream.mp3",
        favicon: "https://www.deutschlandfunk.de/favicon.ico",
        tags: "news, talk, culture, german",
        language: "german",
      },
      {
        stationuuid: "mock-20",
        name: "Ibiza Global Radio",
        country: "Spain",
        state: "Ibiza",
        url_resolved: "https://ibizaglobalradio.streaming-pro.com:8024/stream",
        favicon: "https://www.ibizaglobalradio.com/favicon.ico",
        tags: "electronic, dance, house, techno",
        language: "spanish",
      },
    ];

    // Filter mock stations by search term if provided
    if (searchTerm) {
      stations = stations.filter(
        (station) =>
          station.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          station.country.toLowerCase().includes(searchTerm.toLowerCase()) ||
          station.tags.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    if (stations.length === 0) {
      stationsContainer.innerHTML = `
        <div class="col-span-3 text-center py-10">
          <i class="fas fa-satellite-dish text-4xl text-gray-500 mb-4"></i>
          <p class="text-xl">No stations found. Try a different search term.</p>
        </div>
      `;
      return;
    }

    renderStations();
    updateGlobeWithStations();

    // Show info that we're using demo data
    showToast(
      `API temporarily unavailable - showing ${stations.length} demo stations`,
      "info"
    );
  }
}

/**
 * Create a radio station card element for use in station lists, favorites, or history.
 * @param {Object} station - The station object.
 * @param {number} index - The index in the stations array (or -1 for favorites/history).
 * @param {boolean} isFavorite - Whether the station is a favorite.
 * @returns {HTMLElement} The card element.
 */
function createStationCard(station, index, isFavorite) {
  const card = document.createElement("div");
  card.className =
    "radio-card rounded-xl p-6 border border-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-400";
  card.setAttribute("tabindex", "0");
  card.setAttribute("role", "region");
  card.setAttribute("aria-label", `Radio station: ${station.name}`);
  card.innerHTML = `
    <div class="flex items-center mb-4">
      <div class="w-12 h-12 rounded-full bg-blue-900 flex items-center justify-center mr-4 overflow-hidden">
        ${
          station.favicon
            ? `<img src="${station.favicon}" alt="${station.name}" class="w-full h-full object-cover">`
            : `<i class="fas fa-broadcast-tower text-blue-300" aria-hidden="true"></i>`
        }
      </div>
      <div>
        <h4 class="font-bold truncate">${station.name}</h4>
        <p class="text-sm text-gray-400">${station.country || "Unknown"}${
    station.state ? ", " + station.state : ""
  }</p>
      </div>
    </div>
    <p class="text-gray-300 mb-4 line-clamp-2">${
      station.tags || "Various music and talk"
    }</p>
    <div class="flex justify-between items-center">
      <span class="text-xs px-2 py-1 bg-blue-900 rounded-full">${
        station.language || "Multilingual"
      }</span>
      <div class="flex space-x-2">
        <button class="favorite-btn px-2 py-1 rounded-full text-sm ${
          isFavorite ? "text-red-500" : "text-gray-400"
        } hover:text-red-500 focus:outline-none focus:ring-2 focus:ring-blue-400" data-id="${
    station.stationuuid
  }" aria-label="${isFavorite ? "Remove from favorites" : "Add to favorites"}">
          <i class="fas fa-heart" aria-hidden="true"></i>
        </button>
        <button class="play-btn px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-full text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" data-index="${index}" aria-label="Play ${
    station.name
  }">
          <i class="fas fa-play mr-1" aria-hidden="true"></i> Play
        </button>
      </div>
    </div>
  `;
  // Add event listeners
  card.querySelector(".favorite-btn").addEventListener("click", function () {
    toggleFavorite(station.stationuuid);
    showToast(
      isFavorite ? "Removed from favorites" : "Added to favorites",
      "info"
    );
  });
  card.querySelector(".play-btn").addEventListener("click", function () {
    const idx = parseInt(this.getAttribute("data-index"));
    playStation(idx);
  });
  return card;
}

// Render stations to the DOM as cards
function renderStations() {
  const stationsContainer = document.getElementById("stationsContainer");
  stationsContainer.innerHTML = "";
  stations.forEach((station, index) => {
    const isFavorite = favorites.some(
      (fav) => fav.stationuuid === station.stationuuid
    );
    stationsContainer.appendChild(
      createStationCard(station, index, isFavorite)
    );
  });
}

// Render all stations in the All Stations section
function renderAllStations() {
  const allStationsContainer = document.getElementById("allStationsContainer");
  if (!allStationsContainer) return;
  allStationsContainer.innerHTML = "";
  stations.forEach((station, index) => {
    const isFavorite = favorites.some(
      (fav) => fav.stationuuid === station.stationuuid
    );
    allStationsContainer.appendChild(
      createStationCard(station, index, isFavorite)
    );
  });
}

// Update globe with real station locations
function updateGlobeWithStations() {
  const validStations = stations.filter(
    (station) => station.latitude && station.longitude
  );

  const stationPoints = validStations.map((station) => ({
    lat: parseFloat(station.latitude),
    lng: parseFloat(station.longitude),
    size: 0.1,
    color: "#3b82f6",
  }));

  globe.pointsData([...gData, ...stationPoints]);
}

// --- Audio Playback Controls ---
// Play a radio station by index
async function playStation(index) {
  if (index < 0 || index >= stations.length) return;

  currentStationIndex = index;
  const station = stations[index];

  // Update player UI first
  document.getElementById("stationName").textContent = station.name;
  document.getElementById("stationLocation").textContent = `${
    station.country || ""
  } ${station.state || ""}`.trim();
  document.getElementById("stationLogo").src =
    station.favicon || "https://via.placeholder.com/60";

  // Update favorite button state
  const isFavorite = favorites.some(
    (fav) => fav.stationuuid === station.stationuuid
  );
  document.getElementById("favoriteBtn").className = isFavorite
    ? "text-red-500 hover:text-red-400"
    : "text-gray-400 hover:text-white";

  // Show player controls if hidden
  const playerControls = document.querySelector(".fixed.bottom-0");
  if (playerControls) {
    playerControls.classList.remove("hidden");
  }

  // Handle playing the audio
  try {
    // Stop current playback
    audio.pause();

    // Set new source
    audio.src = station.url_resolved;

    // Load and play
    await audio.load();
    const playPromise = audio.play();

    if (playPromise !== undefined) {
      playPromise
        .then(() => {
          isPlaying = true;
          document.getElementById("playPauseBtn").innerHTML =
            '<i class="fas fa-pause"></i>';

          // Update play button in station list
          document.querySelectorAll(".play-btn").forEach((btn) => {
            const btnIndex = parseInt(btn.getAttribute("data-index"));
            if (btnIndex === index) {
              btn.innerHTML = '<i class="fas fa-pause mr-1"></i> Playing';
            } else {
              btn.innerHTML = '<i class="fas fa-play mr-1"></i> Play';
            }
          });
        })
        .catch((error) => {
          console.error("Error playing station:", error);
          showToast(
            "Could not play this station. Please try another one.",
            "error"
          );
          isPlaying = false;
          document.getElementById("playPauseBtn").innerHTML =
            '<i class="fas fa-play"></i>';
        });
    }
  } catch (error) {
    console.error("Error playing station:", error);
    showToast("Could not play this station. Please try another one.", "error");
    isPlaying = false;
    document.getElementById("playPauseBtn").innerHTML =
      '<i class="fas fa-play"></i>';
  }

  // Add to recently played for current user
  if (currentUser) {
    currentUser.recentlyPlayed = currentUser.recentlyPlayed || [];
    // Remove if already in recently played
    currentUser.recentlyPlayed = currentUser.recentlyPlayed.filter(
      (s) => s.stationuuid !== station.stationuuid
    );
    // Add to front
    currentUser.recentlyPlayed.unshift(station);
    // Limit to 20
    currentUser.recentlyPlayed = currentUser.recentlyPlayed.slice(0, 20);
    localStorage.setItem("currentUser", JSON.stringify(currentUser));
    // Update user in users array
    const userIndex = users.findIndex((u) => u.id === currentUser.id);
    if (userIndex !== -1) {
      users[userIndex] = currentUser;
      localStorage.setItem("users", JSON.stringify(users));
    }
  }
  // Update history section if open
  updateHistorySection();
}

// Toggle play/pause for the audio player
function togglePlayPause() {
  if (isPlaying) {
    audio.pause();
    document.getElementById("playPauseBtn").innerHTML =
      '<i class="fas fa-play"></i>';
  } else {
    audio
      .play()
      .then(() => {
        document.getElementById("playPauseBtn").innerHTML =
          '<i class="fas fa-pause"></i>';
      })
      .catch((error) => {
        console.error("Error resuming playback:", error);
      });
  }
  isPlaying = !isPlaying;
}

// Play next station in the list
function playNext() {
  const nextIndex = (currentStationIndex + 1) % stations.length;
  playStation(nextIndex);
}

// Play previous station in the list
function playPrev() {
  const prevIndex =
    (currentStationIndex - 1 + stations.length) % stations.length;
  playStation(prevIndex);
}

// Toggle favorite status for a station
function toggleFavorite(stationId) {
  const station = stations.find((s) => s.stationuuid === stationId);
  if (!station) return;

  const favoriteIndex = favorites.findIndex(
    (fav) => fav.stationuuid === stationId
  );

  if (favoriteIndex === -1) {
    favorites.push(station);
    // Also add to currentUser.favorites if logged in
    if (currentUser) {
      currentUser.favorites = currentUser.favorites || [];
      if (!currentUser.favorites.some((fav) => fav.stationuuid === stationId)) {
        currentUser.favorites.push(station);
        localStorage.setItem("currentUser", JSON.stringify(currentUser));
        // Update user in users array
        const userIndex = users.findIndex((u) => u.id === currentUser.id);
        if (userIndex !== -1) {
          users[userIndex] = currentUser;
          localStorage.setItem("users", JSON.stringify(users));
        }
      }
    }
    localStorage.setItem("radioFavorites", JSON.stringify(favorites));
  } else {
    favorites.splice(favoriteIndex, 1);
    // Remove from currentUser.favorites if logged in
    if (currentUser && currentUser.favorites) {
      currentUser.favorites = currentUser.favorites.filter(
        (fav) => fav.stationuuid !== stationId
      );
      localStorage.setItem("currentUser", JSON.stringify(currentUser));
      // Update user in users array
      const userIndex = users.findIndex((u) => u.id === currentUser.id);
      if (userIndex !== -1) {
        users[userIndex] = currentUser;
        localStorage.setItem("users", JSON.stringify(users));
      }
    }
    localStorage.setItem("radioFavorites", JSON.stringify(favorites));
  }

  // Update UI
  const favoriteBtn = document.querySelector(
    `.favorite-btn[data-id="${stationId}"]`
  );
  if (favoriteBtn) {
    favoriteBtn.classList.toggle("text-red-500");
    favoriteBtn.classList.toggle("text-gray-400");
  }
  // Update favorites section if open
  updateFavoritesSection();
}

// Update the progress bar as audio plays
function updateProgressBar() {
  if (audio.duration && isFinite(audio.duration)) {
    const progress = (audio.currentTime / audio.duration) * 100;
    document.getElementById("progressBar").style.width = `${progress}%`;
    document.getElementById("currentTime").textContent = formatTime(
      audio.currentTime
    );
    document.getElementById("duration").textContent = formatTime(
      audio.duration
    );
  } else {
    document.getElementById("progressBar").style.width = `0%`;
    document.getElementById("currentTime").textContent = formatTime(
      audio.currentTime
    );
    document.getElementById("duration").textContent = "--:--";
  }
}

// Format seconds as MM:SS, fallback to '--:--' for invalid values
function formatTime(seconds) {
  if (!isFinite(seconds) || isNaN(seconds) || seconds < 0) return "--:--";
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs < 10 ? "0" : ""}${secs}`;
}

// --- UI and Event Listeners ---
// Initialize all event listeners for UI controls
function initEventListeners() {
  // Search functionality
  const searchBtn = document.getElementById("searchBtn");
  const searchInput = document.getElementById("searchInput");
  if (searchBtn && searchInput) {
    // Debounced search
    const debouncedSearch = debounce(() => {
      const searchTerm = searchInput.value.trim();
      fetchStations(searchTerm);
    }, 400);
    searchBtn.addEventListener("click", debouncedSearch);
    searchInput.addEventListener("input", debouncedSearch);
    searchInput.addEventListener("keypress", (e) => {
      if (e.key === "Enter") {
        debouncedSearch();
      }
    });
  }

  // Player controls
  const playPauseBtn = document.getElementById("playPauseBtn");
  if (playPauseBtn) playPauseBtn.addEventListener("click", togglePlayPause);
  const nextBtn = document.getElementById("nextBtn");
  if (nextBtn) nextBtn.addEventListener("click", playNext);
  const prevBtn = document.getElementById("prevBtn");
  if (prevBtn) prevBtn.addEventListener("click", playPrev);

  // Favorite button in player controls
  document.getElementById("favoriteBtn")?.addEventListener("click", () => {
    if (!currentUser) {
      alert("Please sign in to add favorites");
      showAuthModal();
      return;
    }

    const currentStation = stations[currentStationIndex];
    if (currentStation) {
      toggleFavorite(currentStation.stationuuid);
      // Update button color
      const isFavorite = favorites.some(
        (fav) => fav.stationuuid === currentStation.stationuuid
      );
      document.getElementById("favoriteBtn").className = isFavorite
        ? "text-red-500 hover:text-red-400"
        : "text-gray-400 hover:text-white";
    }
  });

  // Shuffle button
  document.getElementById("shuffleBtn")?.addEventListener("click", () => {
    if (stations.length === 0) return;

    // Get random index different from current
    let randomIndex;
    do {
      randomIndex = Math.floor(Math.random() * stations.length);
    } while (randomIndex === currentStationIndex && stations.length > 1);

    playStation(randomIndex);
  });

  // Volume control
  const volumeSlider = document.getElementById("volumeSlider");
  if (volumeSlider) {
    // Update audio volume when slider changes
    volumeSlider.addEventListener("input", (e) => {
      const volume = e.target.value / 100;
      audio.volume = volume;
      // Save the volume preference
      const preferences = JSON.parse(
        localStorage.getItem("userPreferences") || "{}"
      );
      preferences.defaultVolume = e.target.value;
      localStorage.setItem("userPreferences", JSON.stringify(preferences));
    });
  }

  // Mute button functionality
  const muteBtn = document.getElementById("muteBtn");
  if (muteBtn) {
    muteBtn.addEventListener("click", () => {
      audio.muted = !audio.muted;
      muteBtn.innerHTML = audio.muted
        ? '<i class="fas fa-volume-mute"></i>'
        : '<i class="fas fa-volume-up"></i>';
    });
    // Set initial icon
    muteBtn.innerHTML = audio.muted
      ? '<i class="fas fa-volume-mute"></i>'
      : '<i class="fas fa-volume-up"></i>';
  }

  // Audio events
  audio.addEventListener("timeupdate", updateProgressBar);
  audio.addEventListener("ended", playNext);

  // View All logic
  const viewAllBtn = document.getElementById("viewAllBtn");
  const allStationsSection = document.getElementById("allStationsSection");
  const featuredSection = document.getElementById("featuredSection");
  const backToFeaturedBtn = document.getElementById("backToFeaturedBtn");
  if (viewAllBtn && allStationsSection && featuredSection) {
    viewAllBtn.addEventListener("click", (e) => {
      e.preventDefault();
      featuredSection.classList.add("hidden");
      allStationsSection.classList.remove("hidden");
      renderAllStations();
    });
  }
  if (backToFeaturedBtn && allStationsSection && featuredSection) {
    backToFeaturedBtn.addEventListener("click", () => {
      allStationsSection.classList.add("hidden");
      featuredSection.classList.remove("hidden");
    });
  }

  // Add authentication event listeners
  addAuthEventListeners();

  // Add these event listeners and functions for audio controls

  // Event Listeners for Player Controls
  document.addEventListener("DOMContentLoaded", function () {
    // Play/Pause button
    document
      .getElementById("playPauseBtn")
      .addEventListener("click", togglePlayPause);

    // Previous/Next buttons
    document
      .getElementById("prevBtn")
      .addEventListener("click", playPreviousStation);
    document
      .getElementById("nextBtn")
      .addEventListener("click", playNextStation);

    // Volume controls
    document
      .getElementById("volumeSlider")
      .addEventListener("input", updateVolume);
    document.getElementById("muteBtn").addEventListener("click", toggleMute);

    // Favorite button
    document
      .getElementById("favoriteBtn")
      .addEventListener("click", toggleFavorite);

    // Audio event listeners
    audio.addEventListener("loadstart", onAudioLoadStart);
    audio.addEventListener("canplay", onAudioCanPlay);
    audio.addEventListener("play", onAudioPlay);
    audio.addEventListener("pause", onAudioPause);
    audio.addEventListener("error", onAudioError);
    audio.addEventListener("timeupdate", updateProgress);
  });

  // Play/Pause functionality
  function togglePlayPause() {
    if (isPlaying) {
      pauseStation();
    } else {
      if (stations.length > 0) {
        playStation(stations[currentStationIndex]);
      } else {
        showToast("No stations available to play", "error");
      }
    }
  }

  // Play station function
  function playStation(station) {
    if (!station || !station.url_resolved) {
      showToast("Invalid station URL", "error");
      return;
    }

    try {
      // Stop current audio
      audio.pause();
      audio.currentTime = 0;

      // Set new source
      audio.src = station.url_resolved;

      // Update UI immediately
      updateNowPlayingInfo(station);
      updatePlayPauseButton(true);

      // Add to history
      addToHistory(station);

      // Show loading state
      showToast("Loading station...", "info");

      // Load and play
      audio.load();

      const playPromise = audio.play();
      if (playPromise !== undefined) {
        playPromise
          .then(() => {
            isPlaying = true;
            updatePlayPauseButton(true);
            showToast(`Now playing: ${station.name}`, "success");
          })
          .catch((error) => {
            console.error("Playback failed:", error);
            isPlaying = false;
            updatePlayPauseButton(false);
            showToast("Failed to play station. Trying next...", "error");

            // Auto-try next station if current fails
            setTimeout(() => playNextStation(), 2000);
          });
      }
    } catch (error) {
      console.error("Error playing station:", error);
      showToast("Error playing station", "error");
      isPlaying = false;
      updatePlayPauseButton(false);
    }
  }

  // Pause station function
  function pauseStation() {
    audio.pause();
    isPlaying = false;
    updatePlayPauseButton(false);
    showToast("Playback paused", "info");
  }

  // Previous station function
  function playPreviousStation() {
    if (stations.length === 0) {
      showToast("No stations available", "error");
      return;
    }

    currentStationIndex =
      currentStationIndex > 0 ? currentStationIndex - 1 : stations.length - 1;
    playStation(stations[currentStationIndex]);
  }

  // Next station function
  function playNextStation() {
    if (stations.length === 0) {
      showToast("No stations available", "error");
      return;
    }

    currentStationIndex =
      currentStationIndex < stations.length - 1 ? currentStationIndex + 1 : 0;
    playStation(stations[currentStationIndex]);
  }

  // Update play/pause button
  function updatePlayPauseButton(playing) {
    const btn = document.getElementById("playPauseBtn");
    const icon = btn.querySelector("i");

    if (playing) {
      icon.className = "fas fa-pause";
      btn.setAttribute("aria-label", "Pause");
    } else {
      icon.className = "fas fa-play";
      btn.setAttribute("aria-label", "Play");
    }
  }

  // Update now playing info
  function updateNowPlayingInfo(station) {
    document.getElementById("stationName").textContent =
      station.name || "Unknown Station";
    document.getElementById("stationLocation").textContent = `${
      station.country || "Unknown"
    }, ${station.state || ""}`;

    // Update logo
    const logo = document.getElementById("stationLogo");
    if (station.favicon && station.favicon !== "") {
      logo.src = station.favicon;
      logo.onerror = () => {
        logo.src = "https://placehold.co/40x40/666/fff?text=♪";
      };
    } else {
      logo.src = "https://placehold.co/40x40/666/fff?text=♪";
    }
  }

  // Volume control
  function updateVolume(event) {
    const volume = event.target.value / 100;
    audio.volume = volume;

    // Update mute button icon
    const muteBtn = document.getElementById("muteBtn");
    const icon = muteBtn.querySelector("i");

    if (volume === 0) {
      icon.className = "fas fa-volume-mute";
    } else if (volume < 0.5) {
      icon.className = "fas fa-volume-down";
    } else {
      icon.className = "fas fa-volume-up";
    }
  }

  // Toggle mute
  function toggleMute() {
    const volumeSlider = document.getElementById("volumeSlider");

    if (audio.volume > 0) {
      audio.dataset.previousVolume = audio.volume;
      audio.volume = 0;
      volumeSlider.value = 0;
    } else {
      const previousVolume = audio.dataset.previousVolume || 0.7;
      audio.volume = previousVolume;
      volumeSlider.value = previousVolume * 100;
    }

    updateVolume({ target: volumeSlider });
  }

  // Toggle favorite
  function toggleFavorite() {
    if (stations.length === 0 || !stations[currentStationIndex]) {
      showToast("No station to favorite", "error");
      return;
    }

    const station = stations[currentStationIndex];
    const favoriteBtn = document.getElementById("favoriteBtn");
    const icon = favoriteBtn.querySelector("i");

    const isFavorited = favorites.some(
      (fav) => fav.stationuuid === station.stationuuid
    );

    if (isFavorited) {
      // Remove from favorites
      favorites = favorites.filter(
        (fav) => fav.stationuuid !== station.stationuuid
      );
      icon.className = "fas fa-heart";
      icon.classList.remove("text-red-500");
      icon.classList.add("text-gray-400");
      showToast("Removed from favorites", "info");
    } else {
      // Add to favorites
      favorites.push(station);
      icon.className = "fas fa-heart";
      icon.classList.remove("text-gray-400");
      icon.classList.add("text-red-500");
      showToast("Added to favorites", "success");
    }

    // Save to localStorage
    localStorage.setItem("radioFavorites", JSON.stringify(favorites));
  }

  // Add to history
  function addToHistory(station) {
    let history = JSON.parse(localStorage.getItem("radioHistory")) || [];

    // Remove if already exists to avoid duplicates
    history = history.filter(
      (item) => item.stationuuid !== station.stationuuid
    );

    // Add to beginning
    history.unshift({
      ...station,
      playedAt: new Date().toISOString(),
    });

    // Keep only last 50 items
    history = history.slice(0, 50);

    localStorage.setItem("radioHistory", JSON.stringify(history));
  }

  // Audio event handlers
  function onAudioLoadStart() {
    console.log("Audio loading started");
  }

  function onAudioCanPlay() {
    console.log("Audio can play");
  }

  function onAudioPlay() {
    isPlaying = true;
    updatePlayPauseButton(true);
  }

  function onAudioPause() {
    isPlaying = false;
    updatePlayPauseButton(false);
  }

  function onAudioError(event) {
    console.error("Audio error:", event);
    isPlaying = false;
    updatePlayPauseButton(false);
    showToast("Failed to load audio stream", "error");
  }

  // Update progress (for radio streams, this might not work as expected)
  function updateProgress() {
    // For live radio streams, we can't show real progress
    // But we can show that it's playing
    if (isPlaying) {
      document.getElementById("currentTime").textContent = "LIVE";
      document.getElementById("duration").textContent = "∞";
    }
  }
}

// --- App Initialization ---
// Initialize the app and load preferences
function init() {
  // Start globe animation
  animateGlobe();

  // Load user preferences
  const preferences = JSON.parse(
    localStorage.getItem("userPreferences") || "{}"
  );

  // Set initial volume from preferences or default
  const volumeSlider = document.getElementById("volumeSlider");
  if (volumeSlider) {
    const defaultVolume = preferences.defaultVolume ?? 70;
    volumeSlider.value = defaultVolume;
    audio.volume = defaultVolume / 100;
  }

  // Initialize event listeners and fetch stations
  initEventListeners();
  fetchStations();
}

document.addEventListener("DOMContentLoaded", init);

// --- Authentication and User Management ---
// Show/hide authentication modal
function showAuthModal() {
  const authModal = document.getElementById("authModal");
  if (authModal) {
    authModal.style.display = "flex";
  }
}

function hideAuthModal() {
  const authModal = document.getElementById("authModal");
  if (authModal) {
    authModal.style.display = "none";
  }
}

// Add all authentication-related event listeners
function addAuthEventListeners() {
  // Auth modal controls
  document
    .getElementById("openAuthModal")
    ?.addEventListener("click", showAuthModal);
  document
    .getElementById("closeAuthModal")
    ?.addEventListener("click", hideAuthModal);

  // Tab switching
  document
    .getElementById("switchToRegister")
    ?.addEventListener("click", (e) => {
      e.preventDefault();
      switchToRegister();
    });
  document.getElementById("switchToLogin")?.addEventListener("click", (e) => {
    e.preventDefault();
    switchToLogin();
  });
  document.getElementById("loginTab")?.addEventListener("click", (e) => {
    e.preventDefault();
    switchToLogin();
  });
  document.getElementById("registerTab")?.addEventListener("click", (e) => {
    e.preventDefault();
    switchToRegister();
  });

  // User dropdown
  document.getElementById("userAvatar")?.addEventListener("click", () => {
    document.getElementById("userDropdown")?.classList.toggle("show");
  });

  // Close dropdown when clicking outside
  document.addEventListener("click", (e) => {
    if (!e.target.closest("#userProfile")) {
      document.getElementById("userDropdown")?.classList.remove("show");
    }
  });

  // Register form submission
  document.getElementById("registerBtn")?.addEventListener("click", () => {
    const username = document.getElementById("registerUsername").value.trim();
    const email = document.getElementById("registerEmail").value.trim();
    const password = document.getElementById("registerPassword").value.trim();

    if (!username || !email || !password) {
      alert("Please fill in all fields");
      return;
    }

    register(username, email, password);
  });

  // Login form submission
  document.getElementById("loginBtn")?.addEventListener("click", () => {
    const email = document.getElementById("loginEmail").value.trim();
    const password = document.getElementById("loginPassword").value.trim();

    if (!email || !password) {
      alert("Please enter both email and password");
      return;
    }

    login(email, password);
  });

  // Logout button
  document.getElementById("logoutBtn")?.addEventListener("click", logout);

  // Navigation
  document
    .querySelector('a[href="#"][title="My Favorites"]')
    ?.addEventListener("click", (e) => {
      e.preventDefault();
      showSection("favoritesSection");
      document.getElementById("userDropdown")?.classList.remove("show");
    });

  document
    .querySelector('a[href="#"][title="History"]')
    ?.addEventListener("click", (e) => {
      e.preventDefault();
      showSection("historySection");
      document.getElementById("userDropdown")?.classList.remove("show");
    });

  document
    .querySelector('a[href="#"][title="Settings"]')
    ?.addEventListener("click", (e) => {
      e.preventDefault();
      showSection("settingsSection");
      document.getElementById("userDropdown")?.classList.remove("show");
    });

  // Settings form
  document.getElementById("saveSettingsBtn")?.addEventListener("click", () => {
    if (!currentUser) return;

    const username = document.getElementById("settingsUsername").value;
    const email = document.getElementById("settingsEmail").value;
    const newPassword = document.getElementById("settingsNewPassword").value;

    // Update user data
    currentUser.username = username;
    currentUser.email = email;
    if (newPassword) {
      currentUser.password = newPassword;
    }

    // Update in storage
    const userIndex = users.findIndex((u) => u.id === currentUser.id);
    if (userIndex !== -1) {
      users[userIndex] = currentUser;
      localStorage.setItem("users", JSON.stringify(users));
      localStorage.setItem("currentUser", JSON.stringify(currentUser));
    }

    // Update preferences
    updateUserPreferences();

    // Update UI
    updateUserUI();

    // Show success message
    alert("Settings saved successfully!");
  });

  // Preferences change handlers
  document
    .getElementById("autoplayToggle")
    ?.addEventListener("change", updateUserPreferences);
  document
    .getElementById("defaultVolume")
    ?.addEventListener("change", updateUserPreferences);

  // Add close button event listeners for sections
  document.querySelectorAll(".section-close").forEach((button) => {
    button.addEventListener("click", (e) => {
      const section = e.target.closest("section");
      if (section) {
        section.classList.add("hidden");
      }
      // Return to featured section
      showSection("featuredSection");
    });
  });
}

function switchToLogin() {
  document.getElementById("loginTab")?.classList.add("active");
  document.getElementById("registerTab")?.classList.remove("active");
  document.getElementById("loginForm")?.classList.remove("hidden");
  document.getElementById("registerForm")?.classList.add("hidden");
}

function switchToRegister() {
  document.getElementById("registerTab")?.classList.add("active");
  document.getElementById("loginTab")?.classList.remove("active");
  document.getElementById("registerForm")?.classList.remove("hidden");
  document.getElementById("loginForm")?.classList.add("hidden");
}

// Register, login, logout, and update user profile
function register(username, email, password) {
  // Check if user already exists
  if (users.some((u) => u.email === email)) {
    alert("This email is already registered");
    return false;
  }

  const newUser = {
    id: Date.now().toString(),
    username,
    email,
    password,
    favorites: [],
    recentlyPlayed: [],
  };

  users.push(newUser);
  localStorage.setItem("users", JSON.stringify(users));

  // Auto login after registration
  currentUser = newUser;
  localStorage.setItem("currentUser", JSON.stringify(currentUser));
  updateUserUI();
  hideAuthModal();
  return true;
}

function login(email, password) {
  const user = users.find((u) => u.email === email && u.password === password);
  if (user) {
    currentUser = user;
    localStorage.setItem("currentUser", JSON.stringify(currentUser));
    updateUserUI();
    hideAuthModal();
    return true;
  }
  alert("Invalid email or password");
  return false;
}

function logout() {
  currentUser = null;
  localStorage.removeItem("currentUser");
  updateUserUI();
}

function updateUserUI() {
  const authButtons = document.getElementById("authButtons");
  const userProfile = document.getElementById("userProfile");

  if (currentUser) {
    // Show user profile, hide auth buttons
    authButtons.classList.add("hidden");
    userProfile.classList.remove("hidden");

    // Update user info
    document.getElementById("dropdownUsername").textContent =
      currentUser.username;
    document.getElementById("dropdownEmail").textContent = currentUser.email;

    // Update avatar initials
    const initials = currentUser.username
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase();
    document.getElementById("avatarInitials").textContent = initials.substring(
      0,
      2
    );
  } else {
    // Show auth buttons, hide user profile
    authButtons.classList.remove("hidden");
    userProfile.classList.add("hidden");
  }
}

// --- Section Navigation and Settings ---
// Show/hide main app sections
function showSection(sectionId) {
  // Hide all sections first
  const sections = [
    "featuredSection",
    "favoritesSection",
    "historySection",
    "settingsSection",
  ];

  sections.forEach((id) => {
    document.getElementById(id)?.classList.add("hidden");
  });

  // Show the requested section
  document.getElementById(sectionId)?.classList.remove("hidden");

  // Update section content if needed
  if (sectionId === "favoritesSection") {
    updateFavoritesSection();
  } else if (sectionId === "historySection") {
    updateHistorySection();
  } else if (sectionId === "settingsSection") {
    updateSettingsSection();
  }
}

// Update favorites/history/settings sections
function updateFavoritesSection() {
  const favoritesContainer = document.getElementById("favoritesContainer");
  if (!favoritesContainer) return;
  favoritesContainer.innerHTML = "";
  const favs =
    currentUser && currentUser.favorites && currentUser.favorites.length > 0
      ? currentUser.favorites
      : favorites;
  if (!favs || favs.length === 0) {
    favoritesContainer.innerHTML = `
      <div class="col-span-full text-center text-gray-400 py-8">
        <i class="fas fa-heart-broken text-4xl mb-4"></i>
        <p>No favorite stations yet</p>
      </div>
    `;
    return;
  }
  favs.forEach((station) => {
    const isFavorite = true;
    favoritesContainer.appendChild(createStationCard(station, -1, isFavorite));
  });
}
function updateHistorySection() {
  const historyContainer = document.getElementById("historyContainer");
  if (!historyContainer || !currentUser) return;
  historyContainer.innerHTML = "";
  const recents = currentUser.recentlyPlayed || [];
  if (recents.length === 0) {
    historyContainer.innerHTML = `
      <div class="col-span-full text-center text-gray-400 py-8">
        <i class="fas fa-history text-4xl mb-4"></i>
        <p>No recently played stations</p>
      </div>
    `;
    return;
  }
  recents.forEach((station) => {
    const isFavorite = favorites.some(
      (fav) => fav.stationuuid === station.stationuuid
    );
    historyContainer.appendChild(createStationCard(station, -1, isFavorite));
  });
}

// Update settings section
function updateSettingsSection() {
  if (!currentUser) return;

  // Update settings form with current user data
  document.getElementById("settingsUsername").value = currentUser.username;
  document.getElementById("settingsEmail").value = currentUser.email;
  document.getElementById("settingsNewPassword").value = "";

  // Update preferences
  const preferences = JSON.parse(
    localStorage.getItem("userPreferences") || "{}"
  );
  document.getElementById("autoplayToggle").checked =
    preferences.autoplay ?? true;
  document.getElementById("defaultVolume").value =
    preferences.defaultVolume ?? 70;
}

// Update user preferences and apply them
function updateUserPreferences() {
  const preferences = {
    autoplay: document.getElementById("autoplayToggle")?.checked ?? true,
    defaultVolume: document.getElementById("defaultVolume")?.value ?? 70,
  };

  localStorage.setItem("userPreferences", JSON.stringify(preferences));

  // Apply volume preference immediately
  if (preferences.defaultVolume !== undefined) {
    const volumeSlider = document.getElementById("volumeSlider");
    if (volumeSlider) {
      volumeSlider.value = preferences.defaultVolume;
      audio.volume = preferences.defaultVolume / 100;
    }
  }
}

// --- Toast Notification Utility ---
/**
 * Show a toast notification at the bottom of the screen.
 * @param {string} message - The message to display.
 * @param {string} [type] - Optional type: 'success', 'error', 'info'.
 */
function showToast(message, type = "info") {
  let toast = document.getElementById("toastNotification");
  if (!toast) {
    toast = document.createElement("div");
    toast.id = "toastNotification";
    toast.setAttribute("role", "status");
    toast.setAttribute("aria-live", "polite");
    toast.style.position = "fixed";
    toast.style.bottom = "2rem";
    toast.style.left = "50%";
    toast.style.transform = "translateX(-50%)";
    toast.style.zIndex = "9999";
    toast.style.minWidth = "200px";
    toast.style.maxWidth = "90vw";
    toast.style.padding = "1rem 2rem";
    toast.style.borderRadius = "9999px";
    toast.style.fontWeight = "bold";
    toast.style.textAlign = "center";
    toast.style.boxShadow = "0 2px 16px rgba(0,0,0,0.2)";
    document.body.appendChild(toast);
  }
  toast.style.background =
    type === "error" ? "#dc2626" : type === "success" ? "#16a34a" : "#334155";
  toast.style.color = "#fff";
  toast.textContent = message;
  toast.style.opacity = "1";
  setTimeout(() => {
    toast.style.opacity = "0";
  }, 2500);
}

// --- Debounce Utility ---
function debounce(fn, delay) {
  let timer = null;
  return function (...args) {
    clearTimeout(timer);
    timer = setTimeout(() => fn.apply(this, args), delay);
  };
}

// Note: No need to import Three.js directly, globe.gl includes it.
