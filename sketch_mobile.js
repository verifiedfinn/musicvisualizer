let songsData;
let soundFiles = [];
let currentSongIndex = 0;
let fft;
let started = false;
let canvas;
let loadingProgress = 0;

const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

function preload() {
  songsData = loadJSON('songs.json');
}

function setup() {
  canvas = createCanvas(windowWidth, windowHeight);
  angleMode(RADIANS);
  colorMode(RGB);
  fft = new p5.FFT();
  showStartOverlay();
}

function showStartOverlay() {
  let overlay = createDiv("Tap to Start Visualizer");
  overlay.id("startOverlay");

  Object.assign(overlay.elt.style, {
    position: "fixed",
    top: "0", left: "0",
    width: "100%", height: "100%",
    // background: "#000000cc
    color: "white",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    fontSize: "24px",
    zIndex: "9999",
    cursor: "pointer"
  });

  overlay.mousePressed(() => {
    overlay.remove();
    showLoadingOverlay();
    userStartAudio();
    loadAllSongs();
  });
}

function showLoadingOverlay() {
  const overlay = document.getElementById("loading-overlay");
  if (overlay) overlay.style.display = "flex";
}

function hideLoadingOverlay() {
  const overlay = document.getElementById("loading-overlay");
  if (overlay) overlay.style.display = "none";
}

function loadAllSongs() {
  songsData = Array.isArray(songsData) ? songsData : Object.values(songsData);
  let loaded = 0;
  let total = songsData.length;

  songsData.forEach((song, i) => {
    let s = loadSound(song.audio, () => {
      loaded++;
      loadingProgress = loaded / total;

      const loadingBar = document.getElementById("loading-bar");
      const loadingText = document.getElementById("loading-text");

      if (loadingBar) loadingBar.style.width = `${loadingProgress * 100}%`;
      if (loadingText) loadingText.innerText = `Loading… ${Math.floor(loadingProgress * 100)}%`;

      if (loaded === total) {
        setTimeout(() => {
          hideLoadingOverlay();
          setupUI();
          populateThumbnails();
          playSong(0);     // ✅ moved here
          started = true;  // ✅ also set started here
        }, 300);
      }
    });
    soundFiles.push(s);
  });
}

let swirlLayers = [];

let baseColor = [0, 255, 255];
let accentColor = [0, 255, 180];
let pulseColor = [255, 255, 255];

function touchStarted() {
  if (!started) return; // don’t force it early

  let sound = soundFiles[currentSongIndex];
  if (sound && sound.isPlaying()) {
    sound.pause();
  } else if (sound) {
    sound.play();
  } else {
    console.warn("No valid song to play.");
  }
}

function playSong(i) {
  if (currentSongIndex !== -1 && soundFiles[currentSongIndex]?.isPlaying()) {
    soundFiles[currentSongIndex].stop();
  }
  currentSongIndex = i;
  soundFiles[i].loop();
  fft.setInput(soundFiles[i]);

  // Optional: Theme from JSON
  let song = songsData[i];
baseColor = brightenColor(song.base || [0, 255, 255], isMobile ? 100 : 60);
accentColor = brightenColor(song.accent || [0, 255, 180], isMobile ? 120 : 80);
pulseColor = song.pulse || [255, 255, 255];
  updateSongTitle(i);
}

function brightenColor(color, minBrightness = 80) {
  let [r, g, b] = color;
  let brightness = (r + g + b) / 3;
  if (brightness < minBrightness) {
    let boost = minBrightness / brightness;
    r = min(255, r * boost);
    g = min(255, g * boost);
    b = min(255, b * boost);
  }
  return [r, g, b];
}

function draw() {
  background(0, 0, 0, 32);
  if (!started) {
    text("Tap to Begin", width / 2, height / 2);
    return;
  }

  fft.analyze();
  let waveform = fft.waveform();
  let bass = fft.getEnergy("bass");
  let treble = fft.getEnergy("treble");

  translate(width / 2, height / 2 - height * 0.1);

  let baseRadius = min(width, height) * 0.25;
  let pulse = map(bass, 0, 255, baseRadius * 0.8, baseRadius * 1.3);
  let detail = 180;
  let time = millis() * 0.001;

  // 🔁 Celtic Triquetra-style rings
  noFill();
  strokeWeight(1.5);
  for (let i = 0; i < 3; i++) {
    let a = (TWO_PI / 3) * i + time * 0.1;
    let x = cos(a) * baseRadius * 0.8;
    let y = sin(a) * baseRadius * 0.8;
    stroke(baseColor[0], baseColor[1], baseColor[2], map(bass, 0, 255, 10, 80));
    ellipse(x, y, baseRadius * 1.5 + sin(time * 2 + i) * 5);
  }

  // 🧶 Dual-layer Celtic braid
  for (let j = 0; j < 2; j++) {
    strokeWeight(1);
    stroke(baseColor[0], baseColor[1], baseColor[2], 60);
    noFill();
    beginShape();
    for (let i = 0; i <= detail; i++) {
      let angle = map(i, 0, detail, 0, TWO_PI);
      let mod = sin(angle * 4 + time * 2 + j * PI / 4) * 10;
      let r = baseRadius + mod;
      let x = r * cos(angle);
      let y = r * sin(angle);
      curveVertex(x, y);
    }
    endShape(CLOSE);
  }

  // 🌊 Waveform ring
  let ring = [];
  for (let i = 0; i < detail; i++) {
    let angle = map(i, 0, detail, 0, TWO_PI);
    let index = floor(map(i, 0, detail, 0, waveform.length));
    let amp = waveform[index];
    let dynamic = sin(time * 2 + angle * 6 + amp * 8);
    let r = pulse + dynamic * 40 + amp * 80;
    let x = r * cos(angle);
    let y = r * sin(angle);
    ring.push({ x, y });
  }

  swirlLayers.push(ring);
  if (swirlLayers.length > 15) swirlLayers.shift();

  for (let i = 0; i < swirlLayers.length; i++) {
    let layer = swirlLayers[i];
    let alpha = map(i, 0, swirlLayers.length, 15, 200);
    let weight = map(i, 0, swirlLayers.length, 0.3, 2);
    let rotation = time * 0.15 * (i + 1);

    strokeWeight(weight);
    stroke(accentColor[0], accentColor[1], accentColor[2], alpha);
    noFill();
    beginShape();
    for (let p of layer) {
      let px = p.x * cos(rotation) - p.y * sin(rotation);
      let py = p.x * sin(rotation) + p.y * cos(rotation);
      vertex(px, py);
    }
    endShape(CLOSE);
  }

  // 🧿 Treble-reactive rune points (floating)
  let runeCount = 6;
  for (let i = 0; i < runeCount; i++) {
    let angle = map(i, 0, runeCount, 0, TWO_PI) + time * 0.5;
    let r = pulse * 1.1 + sin(time * 4 + i) * map(treble, 0, 255, 0, 30);
    let x = r * cos(angle);
    let y = r * sin(angle);
    noStroke();
    fill(accentColor[0], accentColor[1], accentColor[2], 120);
    ellipse(x, y, 6 + map(treble, 0, 255, 0, 4));
  }

  // 💡 Glowing core
  noStroke();
  fill(pulseColor[0], pulseColor[1], pulseColor[2], 60);
  ellipse(0, 0, pulse * 0.4);
}



function setupUI() {
  document.getElementById("ui-panel").style.display = "flex";
  document.getElementById("controls").style.display = "flex";

  document.getElementById("playPauseBtn").onclick = () => {
    if (!started) return;
    let sound = soundFiles[currentSongIndex];
    if (sound.isPlaying()) {
      sound.pause();
      document.getElementById("playPauseBtn").innerText = "▶";
    } else {
      sound.play();
      document.getElementById("playPauseBtn").innerText = "⏸";
    }
  };

  document.getElementById("replayBtn").onclick = () => {
    if (!started) return;
    soundFiles[currentSongIndex].stop();
    soundFiles[currentSongIndex].play();
  };

  document.getElementById("muteBtn").onclick = () => {
    let v = getVolume();
    setVolume(v > 0 ? 0 : 0.8);
  };

  document.getElementById("volumeSlider").oninput = (e) => {
    setVolume(e.target.value);
  };

  document.getElementById("scrubber").oninput = (e) => {
    if (started) {
      let val = e.target.value;
      let duration = soundFiles[currentSongIndex].duration();
      soundFiles[currentSongIndex].jump(duration * val);
    }
  };

  setInterval(updateTimeDisplay, 500);
}

function updateTimeDisplay() {
  if (!started) return;
  const time = soundFiles[currentSongIndex].currentTime();
  const duration = soundFiles[currentSongIndex].duration();
  document.getElementById("scrubber").value = time / duration;
  document.getElementById("time-display").innerText = formatTime(time) + " / " + formatTime(duration);
}

function formatTime(t) {
  t = Math.floor(t);
  return `${Math.floor(t / 60)}:${("0" + (t % 60)).slice(-2)}`;
}

function getVolume() {
  return parseFloat(document.getElementById("volumeSlider").value);
}

function setVolume(v) {
  if (!started) return;
  soundFiles[currentSongIndex].setVolume(v);
  document.getElementById("volumeSlider").value = v;
  document.getElementById("muteBtn").innerHTML = v > 0
    ? '<i class="fas fa-volume-up"></i>'
    : '<i class="fas fa-volume-mute"></i>';
}

function wrapThumbnailsIfMobile() {
  const isMobile = /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
  if (!isMobile) return;

  const left = document.getElementById("scrollLeft");
  const right = document.getElementById("scrollRight");
  const container = document.getElementById("thumbnailContainer");

  // Create wrapper
  const wrapper = document.createElement("div");
  wrapper.className = "thumbnail-wrapper";

  // Insert wrapper and move elements into it
  const uiPanel = document.getElementById("ui-panel");
  uiPanel.insertBefore(wrapper, left); // Insert before old first child

  wrapper.appendChild(left);
  wrapper.appendChild(container);
  wrapper.appendChild(right);
}

function populateThumbnails() {
  const container = document.getElementById("thumbnailContainer");
  container.innerHTML = '';

  songsData.forEach((song, i) => {
    const div = document.createElement("div");
    div.className = "thumbnail-container";

    const img = document.createElement("img");
    img.src = song.thumbnail;
    img.className = "thumb";
    img.onclick = () => {
      playSong(i);
    };

    const label = document.createElement("div");
    label.className = "thumbnail-title";
    label.innerText = song.title;

    div.appendChild(img);
    div.appendChild(label);
    container.appendChild(div);
  });

  document.getElementById("scrollLeft").onclick = () => {
    container.scrollBy({ left: -120, behavior: 'smooth' });
  };
  document.getElementById("scrollRight").onclick = () => {
    container.scrollBy({ left: 120, behavior: 'smooth' });
  };
}

function updateSongTitle(i) {
  const titleEl = document.getElementById("song-title");
  if (titleEl && songsData[i]) {
    titleEl.innerText = `Currently Playing: ${songsData[i].title || "Untitled"}`;
  }
}
