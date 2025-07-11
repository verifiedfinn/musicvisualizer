let songsData;
let soundFiles = [];
let currentSongIndex = -1;
let fft;
let started = false;
let canvas;
let loadingProgress = 0;

const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

function hexToRGB(hex) {
  hex = hex.replace(/^#/, '');
  if (hex.length === 3) {
    hex = hex.split('').map(c => c + c).join('');
  }
  let bigint = parseInt(hex, 16);
  return [(bigint >> 16) & 255, (bigint >> 8) & 255, bigint & 255];
}

function setup() {
  canvas = createCanvas(windowWidth, windowHeight);
  canvas.position(0, -60); // move the sketch up
  angleMode(RADIANS);
  colorMode(RGB);
  fft = new p5.FFT();
  showStartOverlay();
}

function showStartOverlay() {
  let overlay = createDiv("Tap to Start/Play/Pause");
  overlay.id("startOverlay");

  Object.assign(overlay.elt.style, {
    position: "fixed",
    top: "0", left: "0",
    width: "100%", height: "100%",
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
    startApp(); // <-- NEW: only start everything once user taps
  });
}

function startApp() {
  getAudioContext().resume();  // Ensure context resumes after interaction
  userStartAudio();            // Unlock audio on iOS

  hideLoadingOverlay();        // HIDE loading here immediately

  fetch('songs.json')
    .then(response => response.json())
    .then(data => {
      songsData = data;
      loadAllSongs();
    })
    .catch(err => console.error("Failed to load songs.json", err));
}

function showLoadingOverlay() {
  const overlay = document.getElementById("loading-overlay");
  if (overlay) overlay.style.display = "flex";
}

function hideLoadingOverlay() {
  const overlay = document.getElementById("loading-overlay");
  if (!overlay) return;

  const isMobile = /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
  if (isMobile) {
    overlay.remove(); // remove completely on mobile
  } else {
    overlay.style.display = "none"; // just hide on desktop
  }
}

function loadAllSongs() {
  songsData = Array.isArray(songsData) ? songsData : Object.values(songsData);
  setupUI();
  populateThumbnails();
  started = true;
}


let swirlLayers = [];

let baseColor = [0, 255, 255];
let accentColor = [0, 255, 180];
let pulseColor = [255, 255, 255];

function touchStarted(event) {
  if (!started) return;

  // Check if touch target is NOT a button or UI element
  const tag = event.target.tagName.toLowerCase();
if (
  event.target.closest("#controls") ||
  event.target.closest(".thumb") ||
  event.target.closest("#playPauseBtn") ||
  event.target.id === "playPauseBtn"
) {
  return; // Ignore touches on UI
}


  let sound = soundFiles[currentSongIndex];
  if (!sound) {
    console.warn("⚠️ Tried to play but no song is loaded yet.");
    return;
  }

  if (typeof sound.isPlaying === "function") {
    if (sound.isPlaying()) {
      sound.pause();
      document.getElementById("playPauseBtn").innerHTML = '<i class="fas fa-play"></i>';
    } else {
      sound.play();
      document.getElementById("playPauseBtn").innerHTML = '<i class="fas fa-pause"></i>';
    }
  }
}


let switching = false;

function playSong(i) {
  if (switching || i === currentSongIndex) return;
  switching = true;
  getAudioContext().resume();
  showSongLoadingMsg();

  function normalizeColor(input) {
    if (Array.isArray(input)) return input;
    if (typeof input === 'string' && input.startsWith('#')) return hexToRGB(input);
    return [255, 255, 255]; // default fallback
  }

  const songData = songsData[i];
  baseColor = brightenColor(normalizeColor(songData.base), 80);
  accentColor = brightenColor(normalizeColor(songData.accent), 80);
  pulseColor = brightenColor(normalizeColor(songData.pulse), 100);

  if (soundFiles[currentSongIndex] && soundFiles[currentSongIndex].isPlaying()) {
    soundFiles[currentSongIndex].stop();
  }

  currentSongIndex = i;

  if (soundFiles[i]) {
    afterPlay(soundFiles[i]);
  } else {
    loadSound(songData.audio, (loadedSound) => {
      soundFiles[i] = loadedSound;
      afterPlay(loadedSound);
    });
  }
}

function afterPlay(snd) {
  if (!snd || !snd.isLoaded()) {
    console.warn("Sound not ready yet.");
    return;
  }

  if (getAudioContext().state !== 'running') {
    getAudioContext().resume();
  }

  snd.loop();
  fft.setInput(snd);
  updateSongTitle(currentSongIndex);
  hideLoadingOverlay();
  switching = false;

  // Update play/pause icon properly
  const playPauseBtn = document.getElementById("playPauseBtn");
  if (playPauseBtn) {
    playPauseBtn.innerHTML = '<i class="fas fa-pause"></i>';
  }
}

function brightenColor(color, minBrightness = 80) {
  let [r, g, b] = color;
  let brightness = (r + g + b) / 3;
  if (brightness < minBrightness && brightness > 0) { //tweak later as this had a cool glow affect on the rings
    let factor = minBrightness / brightness;
    r = constrain(r * factor*2, 0, 255);
    g = constrain(g * factor*2, 0, 255);
    b = constrain(b * factor*2, 0, 255);
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

  // Celtic Triquetra-style rings
  noFill();
  strokeWeight(1.5);
  for (let i = 0; i < 3; i++) {
    let a = (TWO_PI / 3) * i + time * 0.1;
    let x = cos(a) * baseRadius * 0.8;
    let y = sin(a) * baseRadius * 0.8;
    stroke(baseColor[0], baseColor[1], baseColor[2], map(bass, 0, 255, 10, 80));
    ellipse(x, y, baseRadius * 1.5 + sin(time * 2 + i) * 5);
  }

  for (let j = 0; j < 2; j++) {
  strokeWeight(2.5);
  let [r, g, b] = brightenColor(baseColor, 60);
  stroke(r, g, b, 30);  // subtle blurred echo
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

  // Dual-layer Celtic braid
for (let j = 0; j < 2; j++) {
  strokeWeight(1);
  let [r, g, b] = brightenColor(baseColor, isMobile ? 90 : 50);  // gentle boost if too dark
  stroke(r, g, b, 80);  // more visible alpha
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

  // Waveform ring
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
    stroke(
  lerp(accentColor[0], pulseColor[0], 0.2),
  lerp(accentColor[1], pulseColor[1], 0.2),
  lerp(accentColor[2], pulseColor[2], 0.2),
  alpha
);
    noFill();
    beginShape();
    for (let p of layer) {
      let px = p.x * cos(rotation) - p.y * sin(rotation);
      let py = p.x * sin(rotation) + p.y * cos(rotation);
      vertex(px, py);
    }
    endShape(CLOSE);
  }

  // Treble-reactive rune points (floating)
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
  fill(pulseColor[0], pulseColor[1], pulseColor[2], 120); // brighter glow
  ellipse(0, 0, pulse * 0.4);
}



function setupUI() {
  document.getElementById("ui-panel").style.display = "flex";
  document.getElementById("controls").style.display = "flex";

const playPauseBtn = document.getElementById("playPauseBtn");
playPauseBtn.onclick = () => {
  if (!started) return;
  const sound = soundFiles[currentSongIndex];
  if (!sound) return;

  if (sound.isPlaying()) {
    sound.pause();
    playPauseBtn.innerHTML = '<i class="fas fa-play"></i>';
  } else {
    sound.play();
    playPauseBtn.innerHTML = '<i class="fas fa-pause"></i>';
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

 // document.getElementById("volumeSlider").oninput = (e) => {
 //   setVolume(e.target.value);
 // };

  document.getElementById("scrubber").oninput = (e) => {
    if (started) {
      let val = e.target.value;
      let duration = soundFiles[currentSongIndex].duration();
      soundFiles[currentSongIndex].jump(duration * val);
    }
  };

  setInterval(updateTimeDisplay, 500);

    if (isMobile) {
    document.getElementById("volumeSlider").style.display = "none";
    document.getElementById("muteBtn").style.marginRight = "0"; // Optional: cleaner spacing
  }
}

function updateTimeDisplay() {
const sound = soundFiles[currentSongIndex];
if (!started || !sound || typeof sound.currentTime !== "function" || !sound.isLoaded()) return;

  const time = sound.currentTime();
  const duration = sound.duration();
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
  if (soundFiles[currentSongIndex] && typeof soundFiles[currentSongIndex].setVolume === "function") {
  soundFiles[currentSongIndex].setVolume(v);
}
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
    titleEl.innerText = `Set Silent off for Speaker Currently Playing: ${songsData[i].title || "Untitled"}`;
  }
}

function showSongLoadingMsg() {
  const titleEl = document.getElementById("song-title");
  if (titleEl) titleEl.innerText = "Loading...";
}








