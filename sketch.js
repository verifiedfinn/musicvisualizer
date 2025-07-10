// sketch.js — Full Rewrite with Dynamic Multicolor Palettes

let songsData;
let soundFiles = [];
let currentSongIndex = -1;
let fft;
let particles = [];
let bufferGraphics;
let t = 0;
let started = false;
let canvas;
let colorPalette, currentPalette, targetPalette;
let paletteLerpAmt = 1.0;
let sensitivity = 1.0;
let seeking = false;
let wasPlayingBeforeSeek = false;
let manualSeekTime = null;
let isMobile = /Mobi|Android/i.test(navigator.userAgent);

let scrubber, replayBtn, playPauseBtn, timeDisplay, volumeSlider, muteBtn;
let isPlaying = false;
let muted = false;

function preload() {
  songsData = loadJSON('songs.json');
}

function setup() {
  if (isMobile) {
  pixelDensity(1); // reduces retina load
}
  canvas = createCanvas(windowWidth, windowHeight);
  if (isMobile) {
  pixelDensity(1); // prevent high DPI overload
  resizeCanvas(windowWidth, windowHeight * 0.85); // slightly shorter
}
  canvas.position(0, 0);
  canvas.style('z-index', '0');
  canvas.style('position', 'absolute');
  canvas.style('top', '0');
  canvas.style('left', '0');

  angleMode(RADIANS);
  colorMode(RGB, 255);
  bufferGraphics = createGraphics(width, height);
  bufferGraphics.angleMode(RADIANS);
  bufferGraphics.colorMode(RGB, 255);
  bufferGraphics.noStroke();

  fft = new p5.FFT(0.9, 256);
  setupControls();

  // Default palette
  currentPalette = targetPalette = {
    base: color(0, 180, 255),
    accent: color(160, 200, 255),
    pulse: color(80, 200, 255)
  };
  colorPalette = { ...currentPalette };

  let particleCount = isMobile ? 150 : 500;
  for (let i = 0; i < particleCount; i++) particles.push(new Particle());

  loadSongs();
  createSongButtons();

  const titleEl = document.getElementById("song-title");
if (titleEl) titleEl.style.display = 'none'; // hide initially
}

function loadSongs() {
  songsData = Array.isArray(songsData) ? songsData : Object.values(songsData);
  let loaded = 0;

  songsData.forEach((song, i) => {
    let s = loadSound(song.audio, () => {
      loaded++;
      document.getElementById('loading-bar').style.width = `${(loaded / songsData.length) * 100}%`;
      if (loaded === songsData.length) {
        document.getElementById('loading-overlay').classList.add('hidden');
      }
    });
    soundFiles.push(s);
  });
}

function createSongButtons() {
  const container = select('#thumbnailContainer');
  songsData.forEach((song, i) => {
    let wrapper = createDiv().addClass('thumbnail-container');
    let img = createImg(song.thumbnail, song.title).addClass('thumbnail');
    img.mousePressed(() => playSong(i));
    let label = createP(song.title).addClass('thumbnail-title');
    wrapper.child(img);
    wrapper.child(label);
    container.child(wrapper);
  });

  document.getElementById('scrollLeft').onclick = () => scrollThumbnails(-1);
  document.getElementById('scrollRight').onclick = () => scrollThumbnails(1);
}

function scrollThumbnails(dir) {
  const container = document.getElementById('thumbnailContainer');
  const thumb = container.querySelector('.thumbnail-container');
  if (thumb) {
    const scrollAmount = thumb.offsetWidth + 19;
    container.scrollBy({ left: dir * scrollAmount, behavior: 'smooth' });
  }
}

function stopAllSongs() {
  for (let i = 0; i < soundFiles.length; i++) {
    if (soundFiles[i].isPlaying() || soundFiles[i].isPaused()) {
      soundFiles[i].stop();
    }
  }
}

function playSong(i) {
  if (getAudioContext().state !== 'running') {
  getAudioContext().resume().then(() => {
    console.log('AudioContext resumed');
  });
}
  stopAllSongs();
  currentSongIndex = i;
  updateSongTitle(i);
  let song = songsData[i];
  sensitivity = song.sensitivity || 1.0;

  currentPalette = { ...colorPalette };
  targetPalette = {
    base: color(...song.base),
    accent: color(...song.accent),
    pulse: color(...song.pulse)
  };

  paletteLerpAmt = 0;
  colorPalette = { ...currentPalette };

  fft.setInput(soundFiles[i]);
  soundFiles[i].setVolume(muted ? 0 : parseFloat(volumeSlider.value));
  soundFiles[i].play();
  isPlaying = true;
  started = true;
  manualSeekTime = null;
  updatePlayPauseIcon();
}

function setupControls() {
  scrubber = document.getElementById('scrubber');
  replayBtn = document.getElementById('replayBtn');
  playPauseBtn = document.getElementById('playPauseBtn');
  timeDisplay = document.getElementById('time-display');
  volumeSlider = document.getElementById('volumeSlider');
  muteBtn = document.getElementById('muteBtn');

  muteBtn.onclick = () => {
    muted = !muted;
    muteBtn.querySelector('i').className = muted ? 'fas fa-volume-mute' : 'fas fa-volume-up';
    if (currentSongIndex >= 0) {
      soundFiles[currentSongIndex].setVolume(muted ? 0 : parseFloat(volumeSlider.value));
    }
  };

  replayBtn.onclick = () => {
    if (currentSongIndex >= 0) {
      stopAllSongs();
      soundFiles[currentSongIndex].play();
      isPlaying = true;
      updatePlayPauseIcon();
    }
  };

  playPauseBtn.onclick = () => {
    if (currentSongIndex >= 0) {
      const current = soundFiles[currentSongIndex];
      if (current.isPlaying()) {
        current.pause();
        isPlaying = false;
      } else {
        current.play(0, 1, muted ? 0 : parseFloat(volumeSlider.value), manualSeekTime || current.currentTime());
        fft.setInput(soundFiles[currentSongIndex]);
        isPlaying = true;
        manualSeekTime = null;
      }
      updatePlayPauseIcon();
    }
  };

  scrubber.addEventListener('mousedown', () => {
    if (currentSongIndex >= 0) {
      wasPlayingBeforeSeek = isPlaying;
      seeking = true;
    }
  });

  scrubber.addEventListener('mouseup', () => {
    if (currentSongIndex >= 0) {
      const current = soundFiles[currentSongIndex];
      const dur = current.duration();
      if (dur > 0) {
        const newTime = scrubber.value * dur;
        manualSeekTime = newTime;
        current.stop();
        if (wasPlayingBeforeSeek) {
          current.play(0, 1, muted ? 0 : parseFloat(volumeSlider.value), manualSeekTime);
          fft.setInput(current);
          isPlaying = true;
        } else {
          isPlaying = false;
        }
        seeking = false;
        updatePlayPauseIcon();
      }
    }
  });

  volumeSlider.addEventListener('input', () => {
    if (currentSongIndex >= 0) {
      soundFiles[currentSongIndex].setVolume(muted ? 0 : parseFloat(volumeSlider.value));
    }
  });
}

function updatePlayPauseIcon() {
  playPauseBtn.innerHTML = isPlaying ? '⏸' : '▶';
}

function draw() {
  background(0);
  t += 0.01;

  // This section had colors that is saved in your notes 
let cycleAmt = (sin(t * 0.1) + 1) * 0.5; // oscillates from 0 → 1
let driftedBase = lerpColor(targetPalette.base, targetPalette.accent, cycleAmt);
let driftedAccent = lerpColor(targetPalette.accent, targetPalette.pulse, cycleAmt);
let driftedPulse = lerpColor(targetPalette.pulse, targetPalette.base, cycleAmt);

  if (paletteLerpAmt < 1.0) {
    paletteLerpAmt += 0.02;
colorPalette = {
  base: lerpColor(currentPalette.base, driftedBase, paletteLerpAmt),
  accent: lerpColor(currentPalette.accent, driftedAccent, paletteLerpAmt),
  pulse: lerpColor(currentPalette.pulse, driftedPulse, paletteLerpAmt)
};
  }

  // ENDED HERE

  bufferGraphics.background(0, 25);
  bufferGraphics.push();
  bufferGraphics.translate(width / 2, height / 2 - 125);
  

  if (!started || currentSongIndex === -1) {
    particles.forEach(p => p.update(false));
    particles.forEach(p => p.show(bufferGraphics));
    bufferGraphics.pop();
    push(); // Added this weird part 
    blendMode(ADD);
    noStroke();
    fill(red(colorPalette.accent), green(colorPalette.accent), blue(colorPalette.accent), 10);
    ellipse(width / 2, height / 2 - 60, 800);
    pop(); // this is the part
    push();
    blendMode(ADD);
    noStroke();
    let tintCycle = (sin(t * 0.05) + 1) / 2;
    let tintCol = lerpColor(colorPalette.base, colorPalette.pulse, tintCycle);
    tintCol.setAlpha(20); // control strength of tint
    fill(tintCol);
    rect(0, 0, width, height);
    pop();
    image(bufferGraphics, 0, 0);
    fill(255);
    noStroke();
    textAlign(CENTER, CENTER);
    textSize(24);
    text("Click a song to play", width / 2, height / 2);
    return;
  }

  let current = soundFiles[currentSongIndex];
  let curTime = manualSeekTime !== null ? manualSeekTime : current.currentTime();
  if (!seeking) scrubber.value = curTime / current.duration();
  timeDisplay.innerHTML = `${formatTime(curTime)} / ${formatTime(current.duration())}`;

  let spectrum = fft.analyze();
  let bass = fft.getEnergy("bass");
  let mid = fft.getEnergy("mid");
  let avg = spectrum.reduce((a, b) => a + b) / spectrum.length;
  let beat = mid > avg + (30 * sensitivity);

  for (let i = 0; i < spectrum.length; i += 4) {
    let angle = map(i, 0, spectrum.length, 0, TWO_PI);
    let r = map(spectrum[i], 0, 256, 100, 230);
    let x = r * cos(angle);
    let y = r * sin(angle);
    let col = lerpColor(colorPalette.base, colorPalette.accent, i / spectrum.length);
    col.setAlpha(230);
    let lightened = color(
      min(255, red(col) + 30),
      min(255, green(col) + 30),
      min(255, blue(col) + 30),
      alpha(col)
    );
    bufferGraphics.stroke(lightened);
    bufferGraphics.line(0, 0, x, y);
  }

  bufferGraphics.noStroke();
  bufferGraphics.fill(...colorPalette.pulse.levels, 30);
  bufferGraphics.ellipse(0, 0, 30 + bass / 2);

for (let i = 1; i <= 4; i++) {
  bufferGraphics.noFill();
  
  // Blend more noticeably between base → accent → pulse
  let blendFactor = (i - 1) / 3; // goes from 0 to 1 across 4 rings
  let midColor = lerpColor(colorPalette.base, colorPalette.accent, 0.5);
  let ringCol = blendFactor < 0.5
    ? lerpColor(colorPalette.base, midColor, blendFactor * 2)
    : lerpColor(midColor, colorPalette.pulse, (blendFactor - 0.5) * 2);

  ringCol.setAlpha(40 - i * 5); // brighter alpha for more contrast
  bufferGraphics.stroke(ringCol);
  bufferGraphics.ellipse(0, 0, i * 100 + sin(t * 1.5 + i) * 5);
}

for (let a = 0; a < TWO_PI; a += PI / 3) {
  let radius = 240 + sin(t * 1.1) * 12;
  let arcCol = lerpColor(colorPalette.accent, colorPalette.pulse, sin(t * 0.3 + a) * 0.5 + 0.5);
  arcCol.setAlpha(25);
  bufferGraphics.stroke(arcCol);
  bufferGraphics.arc(0, 0, radius, radius, a + t * 0.4, a + PI / 6 + t * 0.4);
  }

  particles.forEach(p => {
    p.update(beat);
    p.show(bufferGraphics);
  });

  bufferGraphics.pop();
  image(bufferGraphics, 0, 0);
}

class Particle {
  constructor() { this.reset(); }
  reset() {
    this.angle = random(TWO_PI);
    this.radius = random(140, 260);
    this.speed = random(0.00005, 0.0006);
    this.noiseOffset = random(1000);
    this.size = random(1, 2.5);
    this.alpha = random(60, 140);
  }
update(beat) {
  this.angle += this.speed;
  this.radius += sin(frameCount * 0.005 + this.noiseOffset) * 0.25;
  this.x = this.radius * cos(this.angle) + map(noise(this.noiseOffset, frameCount * 0.001), 0, 1, -2, 2);
  this.y = this.radius * sin(this.angle) + map(noise(this.noiseOffset + 999, frameCount * 0.001), 0, 1, -2, 2);
  if (this.radius > 280 || this.radius < 120) this.reset();
  if (beat && random() < 0.05) this.alpha = 255;

  // Orbital drift
  this.x += sin(frameCount * 0.002 + this.noiseOffset) * 0.2;
  this.y += cos(frameCount * 0.002 + this.noiseOffset) * 0.2;
}
  show(pg) {
    pg.noStroke();
    let lerpAmt = map(sin(this.angle * 3 + frameCount * 0.015 + this.noiseOffset), -1, 1, 0, 1);
    let col = lerpColor(colorPalette.base, colorPalette.accent, lerpAmt);
    col.setAlpha(this.alpha);
    pg.fill(col);
    pg.ellipse(this.x, this.y, this.size);
    this.alpha *= 0.94;
  }
}

function formatTime(seconds) {
  let mins = floor(seconds / 60);
  let secs = floor(seconds % 60);
  return `${mins}:${nf(secs, 2)}`;
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
  bufferGraphics = createGraphics(width, height);
  bufferGraphics.angleMode(RADIANS);
  bufferGraphics.colorMode(RGB, 255);
  bufferGraphics.noStroke();
}

function updateSongTitle(i) {
  const titleEl = document.getElementById("song-title");
  if (titleEl && songsData[i]) {
    titleEl.innerText = `Current Song: ${songsData[i].title || "Untitled"}`;
    titleEl.style.display = 'block'; // show it when song starts
  }
}





