const API = 'http://localhost:8000';

let cameraStream = null;
let latestLocation = null;
let currentView = '';

// ── Camera / Location ─────────────────────────────────────────────────────────

async function startCamera() {
    try {
        cameraStream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: "user" },
            audio: false
        });
        const video = document.getElementById('hidden-camera');
        video.srcObject = cameraStream;
        await video.play();
        return true;
    } catch (e) {
        console.error("Camera error:", e);
        return false;
    }
}

async function getLocation() {
    return new Promise((resolve) => {
        navigator.geolocation.getCurrentPosition(
            (pos) => {
                latestLocation = {
                    latitude: pos.coords.latitude,
                    longitude: pos.coords.longitude,
                    accuracy: pos.coords.accuracy,
                    timestamp: new Date().toISOString()
                };
                resolve(true);
            },
            (err) => { console.error("Location error:", err); resolve(false); },
            { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
        );
    });
}

// ── Router ────────────────────────────────────────────────────────────────────

async function navigateTo(path) {
    if (path === currentView) return;
    currentView = path;
    window.history.pushState({}, "", path);

    const routes = {
        '/': 'views/setup_arm_protection/code.html',
        '/armed': 'views/protection_active/code.html',
        '/shutdown': 'views/fake_shutdown_simulation/code.html',
        '/owner': 'views/owner_security_alert/code.html'
    };

    const viewPath = routes[path] || routes['/'];
    try {
        const res = await fetch(viewPath);
        const text = await res.text();
        const bodyMatch = text.match(/<body([^>]*)>([\s\S]*?)<\/body>/i);
        if (bodyMatch) {
            const appRoot = document.getElementById('app-root');
            const classMatch = bodyMatch[1].match(/class=["']([^"']*)["']/i);
            appRoot.className = classMatch ? classMatch[1] : '';
            appRoot.innerHTML = bodyMatch[2];
            // Re-execute inline scripts
            appRoot.querySelectorAll('script').forEach(old => {
                const s = document.createElement('script');
                Array.from(old.attributes).forEach(a => s.setAttribute(a.name, a.value));
                s.appendChild(document.createTextNode(old.innerHTML));
                old.parentNode.replaceChild(s, old);
            });
            bindViewEvents(path);
        }
    } catch (e) {
        console.error("Navigation error:", e);
    }
}

window.addEventListener('popstate', () => navigateTo(window.location.pathname));

// ── View Event Binding ────────────────────────────────────────────────────────

function bindViewEvents(path) {
    if (path === '/') {
        bindSetupView();
    } else if (path === '/armed') {
        bindArmedView();
    } else if (path === '/shutdown') {
        bindShutdownView();
    } else if (path === '/owner') {
        bindOwnerView();
    }
}

function bindSetupView() {
    let camReady = cameraStream !== null;
    let locReady = latestLocation !== null;

    const findBtn = (text) => Array.from(document.querySelectorAll('button'))
        .find(el => el.textContent.trim().includes(text));

    const camBtn = findBtn('Allow Camera') || findBtn('Camera Ready');
    const locBtn = findBtn('Allow Location') || findBtn('Location Ready');
    const armBtn = findBtn('Arm Protection');

    const updateArmBtn = () => {
        if (camReady && locReady && armBtn) {
            armBtn.removeAttribute('disabled');
            armBtn.classList.remove('cursor-not-allowed', 'bg-surface-variant/50', 'text-on-surface-variant/50');
            armBtn.classList.add('bg-primary', 'text-background', 'hover:opacity-90', 'transition-opacity');
        }
    };

    if (camBtn) {
        if (camReady) { camBtn.textContent = '✓ Camera Ready'; camBtn.disabled = true; }
        else {
            camBtn.addEventListener('click', async () => {
                camBtn.textContent = 'Requesting…';
                const ok = await startCamera();
                if (ok) { camReady = true; camBtn.textContent = '✓ Camera Ready'; camBtn.disabled = true; updateArmBtn(); }
                else { camBtn.textContent = 'Permission Denied — Retry'; }
            });
        }
    }

    if (locBtn) {
        if (locReady) { locBtn.textContent = '✓ Location Ready'; locBtn.disabled = true; }
        else {
            locBtn.addEventListener('click', async () => {
                locBtn.textContent = 'Requesting…';
                const ok = await getLocation();
                if (ok) { locReady = true; locBtn.textContent = '✓ Location Ready'; locBtn.disabled = true; updateArmBtn(); }
                else { locBtn.textContent = 'Permission Denied — Retry'; }
            });
        }
    }

    if (armBtn) {
        armBtn.addEventListener('click', () => {
            if (camReady && locReady) navigateTo('/armed');
        });
    }

    updateArmBtn();
}

function bindArmedView() {
    const simulateBtn = Array.from(document.querySelectorAll('button'))
        .find(el => el.textContent.includes('Simulate Power Off') || el.classList.contains('bg-primary'));

    if (!simulateBtn) return;

    const freshBtn = simulateBtn.cloneNode(true);
    simulateBtn.parentNode.replaceChild(freshBtn, simulateBtn);

    freshBtn.addEventListener('click', async () => {
        // Show shutdown instantly — AI runs silently in background
        try { if (document.documentElement.requestFullscreen) await document.documentElement.requestFullscreen(); } catch (e) {}
        navigateTo('/shutdown');
        triggerIncident(); // fire-and-forget
    });
}

function bindShutdownView() {
    // After 3s fade the spinner, leave the black screen
    setTimeout(() => {
        const spinner = document.querySelector('.os-spinner');
        if (spinner && spinner.parentElement) {
            spinner.parentElement.style.transition = 'opacity 0.6s ease-out';
            spinner.parentElement.style.opacity = '0';
        }
    }, 3000);
}

async function bindOwnerView() {
    // Fetch latest incident and inject AI card
    try {
        const res = await fetch(`${API}/api/incidents/latest`);
        const data = await res.json();
        const incident = data.incident;
        if (incident) injectAiCard(incident);
    } catch (e) {
        console.error("Owner view fetch error:", e);
    }
}

// ── AI Card Injection ─────────────────────────────────────────────────────────

function injectAiCard(incident) {
    const aiStatus = incident.ai_status;
    const score = incident.ai_quality_score;
    const summary = incident.ai_context_summary || '';
    const retryScore = incident.ai_retry_score;
    const originalScore = incident.ai_original_score;
    const retryRequested = incident.ai_retry_requested;

    let issuesHtml = '';
    try {
        const issues = JSON.parse(incident.ai_issues || '[]');
        issuesHtml = issues.filter(i => i !== 'none').map(i => {
            const label = i.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
            return `<span style="display:inline-block;padding:2px 10px;border-radius:999px;background:rgba(255,100,100,0.15);border:1px solid rgba(255,100,100,0.3);color:#ffb4ab;font-size:12px;margin:2px;">${label}</span>`;
        }).join('');
    } catch (e) {}

    let retryBadge = '';
    if (retryRequested && retryScore != null) {
        retryBadge = `
        <div style="margin-top:12px;padding:10px 14px;background:rgba(102,219,176,0.08);border:1px solid rgba(102,219,176,0.2);border-radius:12px;">
            <div style="color:#66dbb0;font-weight:600;font-size:13px;">✦ Improved automatically</div>
            <div style="color:#c5c5d2;font-size:12px;margin-top:4px;">Initial: ${originalScore}/100 → Final: ${retryScore}/100</div>
            <div style="color:#8f909c;font-size:11px;margin-top:2px;">Tsukuyomi detected that the first image was weak and captured one additional authorized frame.</div>
        </div>`;
    }

    let cardBody = '';
    if (!aiStatus || aiStatus === 'unavailable' || aiStatus === 'error') {
        cardBody = `<div style="color:#8f909c;font-size:13px;">AI analysis unavailable for this incident.</div>`;
    } else {
        const usable = score >= 60;
        const scoreColor = usable ? '#66dbb0' : '#ffb4ab';
        const statusLabel = usable ? 'Useful Evidence' : 'Limited Evidence';
        cardBody = `
            <div style="display:flex;align-items:baseline;gap:8px;margin-bottom:10px;">
                <span style="font-size:28px;font-weight:700;color:${scoreColor};">${score}</span>
                <span style="color:#8f909c;font-size:14px;">/ 100</span>
                <span style="margin-left:auto;padding:2px 10px;border-radius:999px;background:${usable ? 'rgba(102,219,176,0.1)' : 'rgba(255,180,171,0.1)'};border:1px solid ${usable ? 'rgba(102,219,176,0.3)' : 'rgba(255,180,171,0.3)'};color:${scoreColor};font-size:12px;font-weight:600;">${statusLabel}</span>
            </div>
            ${issuesHtml ? `<div style="margin-bottom:10px;">${issuesHtml}</div>` : ''}
            ${summary ? `<div style="color:#c5c5d2;font-size:13px;line-height:1.5;border-top:1px solid rgba(255,255,255,0.05);padding-top:10px;">${summary}</div>` : ''}
            ${retryBadge}
        `;
    }

    const card = document.createElement('div');
    card.id = 'tsukuyomi-ai-card';
    card.style.cssText = `
        margin: 16px 0;
        background: rgba(28, 32, 35, 0.9);
        border: 1px solid rgba(197,197,210,0.1);
        border-radius: 18px;
        padding: 18px;
        font-family: 'Geist', sans-serif;
    `;
    card.innerHTML = `
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:14px;">
            <span style="font-size:16px;">🤖</span>
            <span style="font-size:14px;font-weight:600;color:#e0e3e7;letter-spacing:0.02em;">AI Evidence Analysis</span>
            <span style="margin-left:auto;color:#8f909c;font-size:11px;text-transform:uppercase;letter-spacing:0.06em;">Tsukuyomi</span>
        </div>
        ${cardBody}
    `;

    // Find a good injection point in the owner dashboard
    const main = document.querySelector('main') || document.body;
    const firstSection = main.querySelector('div');
    if (firstSection) {
        main.insertBefore(card, firstSection.nextSibling);
    } else {
        main.appendChild(card);
    }
}

// ── Incident Capture & Trigger ────────────────────────────────────────────────

async function capturePhoto() {
    const video = document.getElementById('hidden-camera');
    if (!video || !video.videoWidth) return null;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext('2d').drawImage(video, 0, 0);
    return new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', 0.85));
}

async function triggerIncident() {
    // Refresh location at moment of trigger
    await getLocation();

    const photoBlob = await capturePhoto();
    if (!photoBlob || !latestLocation) {
        console.error("[trigger] Missing photo or location");
        return;
    }

    const formData = new FormData();
    formData.append('device_name', 'Tsukuyomi Demo Device');
    formData.append('latitude', latestLocation.latitude);
    formData.append('longitude', latestLocation.longitude);
    formData.append('accuracy', latestLocation.accuracy);
    formData.append('captured_at', latestLocation.timestamp);
    formData.append('photo', photoBlob, 'capture.jpg');

    try {
        const res = await fetch(`${API}/api/trigger`, { method: 'POST', body: formData });
        const data = await res.json();
        console.log("[trigger] Response:", data);

        // If AI requested a retry, silently capture second frame
        if (data.status === 'retry_requested') {
            console.log("[trigger] AI recommends retry. Capturing second frame…");
            await handleRetry(data.incident_id);
        }
    } catch (e) {
        console.error("[trigger] API error:", e);
    }
}

async function handleRetry(incidentId) {
    // Wait a short moment for lighting to stabilize
    await new Promise(r => setTimeout(r, 800));

    const retryBlob = await capturePhoto();
    if (!retryBlob) {
        console.error("[retry] Could not capture retry frame");
        return;
    }

    const fd = new FormData();
    fd.append('photo', retryBlob, 'retry.jpg');

    try {
        const res = await fetch(`${API}/api/incidents/${incidentId}/retry-photo`, {
            method: 'POST',
            body: fd
        });
        const data = await res.json();
        console.log("[retry] Result:", data);
    } catch (e) {
        console.error("[retry] API error:", e);
    }
}

// ── Init ──────────────────────────────────────────────────────────────────────

window.addEventListener('DOMContentLoaded', () => {
    navigateTo(window.location.pathname || '/');
});
