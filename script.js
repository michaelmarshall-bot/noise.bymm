/*Page Function*/

document.getElementById("currentYear").innerHTML = new Date().getFullYear();

var acc = document.getElementsByClassName("accordion");
var i;

for (i = 0; i < acc.length; i++) {
  acc[i].addEventListener("click", function() {
    /* Toggle between adding and removing the "active" class,
    to highlight the button that controls the panel */
    this.classList.toggle("active");
    this.classList.toggle("activeArrow");

    /* Toggle between hiding and showing the active panel */
    var panel = this.nextElementSibling;
    if (panel.style.display === "block") {
      panel.style.display = "none";
    } else {
      panel.style.display = "block";
    }
  });
    }

/*Audio Selection*/
/* --- 1. Selectors & Global State --- */
const trackList = document.querySelector('#track-list');
const audio = document.getElementById('audio-player');
const playerUI = document.getElementById('player-ui');
const progressBar = document.getElementById('progress-bar');
const playPauseBtn = document.getElementById('btn-play-pause');
const canvas = document.getElementById('visualizer');
const ctx = canvas.getContext('2d');
const promoBox = document.querySelector('.promoBox');
const volumeSlider = document.getElementById('volume-slider');
const volumeIcon = document.getElementById('volume-icon');
const btnClose = document.getElementById('btn-close');

let currentTrackElement = null;
let audioCtx, analyser, source;
let lastVolume = 1;

/* --- 2. UI Helpers --- */

const formatTime = (s) => `${Math.floor(s/60)}:${Math.floor(s%60).toString().padStart(2, '0')}`;

function updatePlayPauseUI(isPlaying) {
    isPlaying ? playPauseBtn.classList.add('is-playing') : playPauseBtn.classList.remove('is-playing');
}

function updateVolumeUI() {
    if (audio.muted || audio.volume === 0) {
        volumeIcon.style.opacity = "0.3";
    } else if (audio.volume < 0.5) {
        volumeIcon.style.opacity = "0.6";
    } else {
        volumeIcon.style.opacity = "1";
    }
}

/* --- 3. Audio Engine & Visualizer --- */

function initVisualizer() {
    if (audioCtx) return;
    canvas.width = canvas.offsetWidth;
    canvas.height = canvas.offsetHeight;
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    analyser = audioCtx.createAnalyser();
    source = audioCtx.createMediaElementSource(audio);
    source.connect(analyser);
    analyser.connect(audioCtx.destination);
    analyser.fftSize = 64; 
    renderFrame();
}

function renderFrame() {
    requestAnimationFrame(renderFrame);
    const dataArray = new Uint8Array(analyser.frequencyBinCount);
    analyser.getByteFrequencyData(dataArray);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const barWidth = (canvas.width / dataArray.length) * 2;
    let x = 0;
    dataArray.forEach(val => {
        const height = (val / 255) * canvas.height;
        ctx.fillStyle = `rgb(128, 0, 32, ${val / 255})`;
        ctx.fillRect(x, canvas.height - height, barWidth, height);
        x += barWidth + 2;
    });
}

/* --- 4. Core Track Logic (Fade In/Out) --- */

function playTrack(element) {
    if (!element) return;
    initVisualizer();
    if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume();

    audio.pause();
    audio.volume = 0;
    audio.src = element.dataset.song;
    audio.crossOrigin = "anonymous";
    
    audio.play().then(() => {
        const targetVolume = audio.muted ? 0 : volumeSlider.value;
        const fadeIn = setInterval(() => {
            if (audio.volume < targetVolume - 0.1) {
                audio.volume += 0.1;
            } else {
                audio.volume = targetVolume;
                clearInterval(fadeIn);
            }
        }, 40);
    }).catch(e => console.error("Playback Error:", e));

    playerUI.style.display = 'flex'; 
    setTimeout(() => playerUI.classList.add('is-visible'), 10); 
    
    currentTrackElement = element;
    document.getElementById('now-playing').textContent = element.textContent.trim();
    document.querySelector('.track-item.playing')?.classList.remove('playing');
    element.classList.add('playing');
}

function dismissPlayer() {
    const fadeOut = setInterval(() => {
        if (audio.volume > 0.1) {
            audio.volume -= 0.1;
        } else {
            clearInterval(fadeOut);
            audio.pause();
            audio.src = "";
            playerUI.classList.remove('is-visible');
            setTimeout(() => playerUI.style.display = 'none', 500); 
            document.querySelector('.track-item.playing')?.classList.remove('playing');
            
            // Sync with Homepage Behavior: Ensure promoBox is closed
            promoBox.classList.remove('is-active');
        }
    }, 40);
}

/* --- 5. Event Listeners --- */

trackList.addEventListener('click', (e) => {
    const item = e.target.closest('.track-item');
    if (item) playTrack(item);
});

playPauseBtn.addEventListener('click', () => audio.paused ? audio.play() : audio.pause());

document.getElementById('btn-next').addEventListener('click', () => {
    playTrack(currentTrackElement?.nextElementSibling || trackList.firstElementChild);
});

document.getElementById('btn-prev').addEventListener('click', () => {
    if (audio.currentTime > 3) audio.currentTime = 0;
    else playTrack(currentTrackElement?.previousElementSibling || trackList.lastElementChild);
});

// Close Button Listener
btnClose.addEventListener('click', (e) => {
    e.stopPropagation();
    dismissPlayer();
});

audio.addEventListener('play', () => updatePlayPauseUI(true));
audio.addEventListener('pause', () => updatePlayPauseUI(false));
audio.addEventListener('ended', () => {
    const next = currentTrackElement?.nextElementSibling;
    next ? playTrack(next) : updatePlayPauseUI(false);
});

audio.addEventListener('timeupdate', () => {
    if (audio.duration) {
        progressBar.value = (audio.currentTime / audio.duration) * 100;
        document.getElementById('current-time').textContent = formatTime(audio.currentTime);
        document.getElementById('duration').textContent = formatTime(audio.duration);
    }
});

progressBar.addEventListener('click', (e) => {
    const rect = progressBar.getBoundingClientRect();
    const pos = (e.clientX - rect.left) / rect.width;
    audio.currentTime = pos * audio.duration;
});

volumeSlider.addEventListener('input', (e) => {
    const val = e.target.value;
    audio.volume = val;
    audio.muted = (val == 0);
    updateVolumeUI();
});

volumeIcon.addEventListener('click', () => {
    audio.muted = !audio.muted;
    if (audio.muted) {
        lastVolume = volumeSlider.value;
        volumeSlider.value = 0;
    } else {
        volumeSlider.value = lastVolume;
    }
    audio.volume = volumeSlider.value;
    updateVolumeUI();
});

/* --- 6. Integrated Homepage & Keyboard Logic --- */

function handleBoxClick(e) {
    e.stopPropagation();
    initVisualizer();
    if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume();

    // Toggle logic for bottomTag and namebox z-index
    promoBox.classList.toggle('is-active');

    // Sync Audio: If deactivated via clicking nbox, dismiss player
    if (!promoBox.classList.contains('is-active')) {
        dismissPlayer();
    }
}

// Bind to trigger text specifically
document.querySelectorAll('.nBox1 .trigger-text, .nBox2 .trigger-text').forEach(el => {
    el.addEventListener('click', handleBoxClick);
});

// Keyboard
window.addEventListener('keydown', (e) => {
    if (playerUI.classList.contains('is-visible')) {
        if (e.code === "Space") { e.preventDefault(); audio.paused ? audio.play() : audio.pause(); }
        if (e.code === "ArrowRight") { e.preventDefault(); document.getElementById('btn-next').click(); }
        if (e.code === "ArrowLeft") { e.preventDefault(); document.getElementById('btn-prev').click(); }
        if (e.code === "ArrowUp") { 
            e.preventDefault(); 
            volumeSlider.value = Math.min(1, parseFloat(volumeSlider.value) + 0.1); 
            volumeSlider.dispatchEvent(new Event('input')); 
        }
        if (e.code === "ArrowDown") { 
            e.preventDefault(); 
            volumeSlider.value = Math.max(0, parseFloat(volumeSlider.value) - 0.1); 
            volumeSlider.dispatchEvent(new Event('input')); 
        }
    }
});