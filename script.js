/*Page Function*/
/*Dynamic Height Fix (Avoid Chrome Forced Dimensions) */
const setAppHeight = () => {
    const doc = document.documentElement;
    doc.style.setProperty('--true-height', `${window.innerHeight}px`);
};

window.addEventListener('resize', () => {
    setAppHeight();
    // Re-scale canvas on resize for Safari stability
    if (audioCtx) resizeCanvas(); 
});
setAppHeight();

document.getElementById("currentYear").innerHTML = new Date().getFullYear();

var acc = document.getElementsByClassName("accordion");
for (let i = 0; i < acc.length; i++) {
    acc[i].addEventListener("click", function() {
        this.classList.toggle("active");
        this.classList.toggle("activeArrow");
        var panel = this.nextElementSibling;
        if (panel) {
            panel.style.display = panel.style.display === "block" ? "none" : "block";
        }
    });
}

/*Audio Selection*/
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
const nowPlayingText = document.getElementById('now-playing');

let currentTrackElement = null;
let audioCtx, analyser, source;
let lastVolume = 1;

/* --- UI Helpers --- */
const formatTime = (s) => `${Math.floor(s/60)}:${Math.floor(s%60).toString().padStart(2, '0')}`;

function updatePlayPauseUI(isPlaying) {
    isPlaying ? playPauseBtn.classList.add('is-playing') : playPauseBtn.classList.remove('is-playing');
}

function updateVolumeUI() {
    if (!volumeSlider || !volumeIcon) return;
    if (audio.muted || audio.volume === 0) {
        volumeIcon.style.opacity = "0.3";
        volumeSlider.classList.add('muted'); 
    } else {
        volumeSlider.classList.remove('muted');
        volumeIcon.style.opacity = audio.volume < 0.5 ? "0.6" : "1";
    }
}

function syncSliderTrack(el) {
    if (!el) return;
    const value = (el.value - el.min) / (el.max - el.min) * 100;
    el.style.setProperty('--value', value + '%');
}

/* --- Improved Audio Engine & Visualizer --- */

function resizeCanvas() {
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    // Set display size
    const rect = canvas.getBoundingClientRect();
    // Set actual resolution
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    // Scale context to match
    ctx.scale(dpr, dpr);
}

function initVisualizer() {
    // Safari Fix: Handle 'interrupted' state or existing context
    if (audioCtx) {
        if (audioCtx.state === 'suspended' || audioCtx.state === 'interrupted') {
            audioCtx.resume();
        }
        return;
    }

    const AudioContext = window.AudioContext || window.webkitAudioContext;
    audioCtx = new AudioContext();
    analyser = audioCtx.createAnalyser();
    
    // Safari Fix: Connect the source ONCE. Changing audio.src won't break this connection.
    source = audioCtx.createMediaElementSource(audio);
    source.connect(analyser);
    analyser.connect(audioCtx.destination);
    
    analyser.fftSize = 64; 
    resizeCanvas();
    renderFrame();
}

function renderFrame() {
    requestAnimationFrame(renderFrame);
    if (!analyser) return;

    const dataArray = new Uint8Array(analyser.frequencyBinCount);
    analyser.getByteFrequencyData(dataArray);
    
    const dpr = window.devicePixelRatio || 1;
    const logicalW = canvas.width / dpr;
    const logicalH = canvas.height / dpr;

    ctx.clearRect(0, 0, logicalW, logicalH);
    const barWidth = (logicalW / dataArray.length) * 2;
    let x = 0;

    dataArray.forEach(val => {
        const height = (val / 255) * logicalH;
        ctx.fillStyle = `rgba(128, 0, 32, ${val / 255})`;
        ctx.fillRect(x, logicalH - height, barWidth, height);
        x += barWidth + 2;
    });
}

/* --- Core Track Logic --- */

function playTrack(element) {
    if (!element) return;

    // Safari Fix: CORS must be set before source
    audio.crossOrigin = "anonymous";
    audio.src = element.dataset.song;

    initVisualizer();
    if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume();

    if (nowPlayingText) {
        const title = element.textContent.trim();
        nowPlayingText.textContent = title;
        nowPlayingText.style.display = 'flex';
        nowPlayingText.style.height = 'auto';
        if (nowPlayingText.offsetHeight === 0) nowPlayingText.style.minHeight = '24px';
    }

    audio.pause();
    audio.volume = 0;
    
    audio.play().then(() => {
        const targetVolume = audio.muted ? 0 : volumeSlider.value;
        const fadeIn = setInterval(() => {
            if (audio.volume < targetVolume - 0.05) {
                audio.volume += 0.05;
            } else {
                audio.volume = targetVolume;
                clearInterval(fadeIn);
            }
        }, 40);
    }).catch(e => console.error("Playback Error:", e));

    playerUI.classList.add('is-visible'); 
    
    currentTrackElement = element;
    document.querySelector('.track-item.playing')?.classList.remove('playing');
    element.classList.add('playing');
}

function dismissPlayer() {
    if (window.fadeInterval) clearInterval(window.fadeInterval);
    playerUI.classList.remove('is-visible');

    window.fadeInterval = setInterval(() => {
        if (audio.volume > 0.05) {
            audio.volume = Math.max(0, audio.volume - 0.05);
            volumeSlider.value = audio.volume;
            syncSliderTrack(volumeSlider);
            updateVolumeUI();
        } else {
            clearInterval(window.fadeInterval);
            audio.pause();
            audio.volume = 0;
            // Safari: Don't set src to empty string, use a null-ish value or just pause
            audio.removeAttribute('src'); 
            audio.load(); // Clean up the buffer
            
            setTimeout(() => {
                document.querySelector('.track-item.playing')?.classList.remove('playing');
                if (promoBox) promoBox.classList.remove('is-active');
            }, 300);
        }
    }, 30); 
}

/* --- Event Listeners --- */
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

progressBar.addEventListener('input', (e) => {
    const pos = e.target.value / 100;
    audio.currentTime = pos * audio.duration;
});

volumeSlider.addEventListener('input', (e) => {
    const val = e.target.value;
    audio.volume = val;
    audio.muted = (val == 0);
    updateVolumeUI();
    syncSliderTrack(e.target);
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
    syncSliderTrack(volumeSlider);
});

function handleBoxClick(e) {
    e.stopPropagation();
    initVisualizer();
    if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume();
    promoBox.classList.toggle('is-active');
    if (!promoBox.classList.contains('is-active')) {
        dismissPlayer();
    }
}

document.querySelectorAll('.nBox1 .trigger-text, .nBox2 .trigger-text').forEach(el => {
    el.addEventListener('click', handleBoxClick);
});

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

syncSliderTrack(volumeSlider);
updateVolumeUI();