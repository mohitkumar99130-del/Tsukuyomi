const API = '';

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
    // Fetch latest incident and populate DOM + AI card & Escalation card
    try {
        const res = await fetch(`${API}/api/incidents/latest`);
        const data = await res.json();
        const incident = data.incident;
        if (!incident) return;

        // 1. Update Subtitle (Device & Triggered time)
        const timeStr = new Date(incident.created_at).toLocaleTimeString();
        const subtitle = document.querySelector('main section p');
        if (subtitle) {
            subtitle.textContent = `Device: ${incident.device_name || 'Tsukuyomi Device'} • Triggered: ${timeStr}`;
        }

        // 2. Update Location Data
        const spans = document.querySelectorAll('section span.text-on-surface');
        if (spans.length >= 3) {
            spans[0].textContent = `${incident.latitude}°`;
            spans[1].textContent = `${incident.longitude}°`;
            spans[2].textContent = `Within ${incident.accuracy ? Number(incident.accuracy).toFixed(1) : 15} meters`;
        }

        const mapBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Open Location'));
        if (mapBtn) {
            mapBtn.onclick = () => {
                window.open(`https://www.google.com/maps?q=${incident.latitude},${incident.longitude}`, '_blank');
            };
        }

        // 3. Update Security Snapshot Photo
        const photoFilename = incident.ai_selected_photo || incident.photo_filename;
        const photoUrl = `${API}/media/${photoFilename}`;
        
        const photoDivs = document.querySelectorAll('div.bg-cover');
        if (photoDivs.length >= 2) {
            photoDivs[1].style.backgroundImage = `url('${photoUrl}')`;
        } else if (photoDivs.length === 1) {
            photoDivs[0].style.backgroundImage = `url('${photoUrl}')`;
        }

        const viewImgBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('View Image'));
        if (viewImgBtn) {
            viewImgBtn.onclick = () => {
                window.open(photoUrl, '_blank');
            };
        }

        // 4. Inject dynamic AI card & Escalation card
        const oldAi = document.getElementById('tsukuyomi-ai-card');
        if (oldAi) oldAi.remove();
        const oldEsc = document.getElementById('tsukuyomi-escalation-card');
        if (oldEsc) oldEsc.remove();

        injectAiCard(incident);
        injectEscalationCard(incident);
    } catch (e) {
        console.error("Owner view fetch error:", e);
    }
}

// ── Escalation Card Injection ──────────────────────────────────────────────────

function injectEscalationCard(incident) {
    const escStatus = incident.escalation_status;
    const isAcknowledged = incident.acknowledged === 1;

    let primaryText = incident.primary_email_status === 'sent' ? 'Sent ✓' : (incident.primary_email_status === 'failed' ? 'Failed ❌' : 'Pending');
    
    let ackText = 'Waiting';
    if (isAcknowledged) ackText = 'Confirmed ✓';
    else if (escStatus === 'secondary_alerted' || escStatus === 'campus_alerted') ackText = 'No response';

    let secondaryText = 'Standby';
    if (incident.secondary_email_status === 'sent') secondaryText = 'Alerted ✓';
    else if (incident.secondary_email_status === 'failed') secondaryText = 'Failed ❌';

    let campusText = 'Standby';
    if (incident.campus_email_status === 'sent') campusText = 'Alerted ✓';
    else if (incident.campus_email_status === 'failed') campusText = 'Failed ❌';
    else if (!incident.campus_email_status && escStatus !== 'campus_alerted') campusText = 'Disabled';
    
    let timelineHtml = `
        <div style="font-size:12px; color:#9CA8BE; margin-top:14px; border-top:1px solid rgba(255,255,255,0.08); padding-top:12px; display:flex; flex-col; gap:4px;">
            <div>${new Date(incident.created_at).toLocaleTimeString()} — Protection triggered</div>
            ${incident.primary_sent_at ? `<div>${new Date(incident.primary_sent_at).toLocaleTimeString()} — Primary contact notified</div>` : ''}
            ${incident.secondary_sent_at ? `<div>${new Date(incident.secondary_sent_at).toLocaleTimeString()} — Secondary contact notified</div>` : ''}
            ${incident.campus_sent_at ? `<div>${new Date(incident.campus_sent_at).toLocaleTimeString()} — Campus security notified</div>` : ''}
            ${incident.acknowledged_at ? `<div>${new Date(incident.acknowledged_at).toLocaleTimeString()} — Owner acknowledged incident</div>
                                          <div style="color:#4FD1A1;">${new Date(incident.acknowledged_at).toLocaleTimeString()} — Escalation stopped</div>` : ''}
        </div>
    `;

    const card = document.createElement('div');
    card.id = 'tsukuyomi-escalation-card';
    card.style.cssText = `
        margin: 20px 0;
        background: rgba(15, 22, 38, 0.65);
        border: 1px solid rgba(150, 170, 255, 0.15);
        backdrop-filter: blur(16px);
        border-radius: 22px;
        padding: 22px;
        font-family: 'Geist', sans-serif;
        box-shadow: 0 20px 50px rgba(0,0,0,0.5);
    `;
    card.innerHTML = `
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:16px;">
            <span style="font-size:18px;">🚨</span>
            <span style="font-size:15px;font-weight:600;color:#F5F7FF;letter-spacing:0.02em;">Smart Safety Escalation</span>
            <span style="margin-left:auto;color:#8FA7FF;font-size:11px;text-transform:uppercase;letter-spacing:0.06em;background:rgba(143,167,255,0.1);padding:2px 8px;border-radius:999px;">Tsukuyomi</span>
        </div>
        <div style="display:flex; justify-content:space-between; margin-bottom:8px; font-size:13px;">
            <span style="color:#9CA8BE;">Primary Contact</span>
            <span style="color:#F5F7FF;font-weight:500;">${primaryText}</span>
        </div>
        <div style="display:flex; justify-content:space-between; margin-bottom:8px; font-size:13px;">
            <span style="color:#9CA8BE;">Owner Acknowledgement</span>
            <span style="color:${isAcknowledged ? '#4FD1A1' : '#F5F7FF'};font-weight:600;">${ackText}</span>
        </div>
        ${!isAcknowledged ? `
        <div style="display:flex; justify-content:space-between; margin-bottom:8px; font-size:13px;">
            <span style="color:#9CA8BE;">Secondary Contact</span>
            <span style="color:#F5F7FF;">${secondaryText}</span>
        </div>
        <div style="display:flex; justify-content:space-between; margin-bottom:8px; font-size:13px;">
            <span style="color:#9CA8BE;">Campus Security</span>
            <span style="color:#F5F7FF;">${campusText}</span>
        </div>
        ` : `
        <div style="display:flex; justify-content:space-between; margin-bottom:8px; font-size:13px;">
            <span style="color:#9CA8BE;">Escalation Status</span>
            <span style="color:#4FD1A1;font-weight:600;">Stopped (Owner Safe)</span>
        </div>
        `}
        ${timelineHtml}
        ${!isAcknowledged ? `
        <button id="ack-btn" style="margin-top:16px; width:100%; padding:12px; background:linear-gradient(135deg, #4FD1A1, #22A37C); color:#05070B; border:none; border-radius:14px; font-weight:700; font-size:14px; cursor:pointer; box-shadow:0 0 20px rgba(79,209,161,0.3); transition:all 0.2s ease;">
            I'm Safe — Acknowledge Alert
        </button>
        ` : ''}
    `;

    const main = document.querySelector('main') || document.body;
    main.appendChild(card);

    const ackBtn = document.getElementById('ack-btn');
    if (ackBtn) {
        ackBtn.addEventListener('click', async () => {
            ackBtn.textContent = 'Acknowledging...';
            ackBtn.disabled = true;
            try {
                await fetch(`${API}/api/incidents/${incident.id}/acknowledge`, { method: 'POST' });
                // reload view
                bindOwnerView();
            } catch (e) {
                console.error("Ack error:", e);
                ackBtn.textContent = 'Error - Retry';
                ackBtn.disabled = false;
            }
        });
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
            return `<span style="display:inline-block;padding:3px 12px;border-radius:999px;background:rgba(240,106,120,0.12);border:1px solid rgba(240,106,120,0.3);color:#F06A78;font-size:12px;font-weight:500;margin:2px;">${label}</span>`;
        }).join('');
    } catch (e) {}

    let retryBadge = '';
    if (retryRequested && retryScore != null) {
        retryBadge = `
        <div style="margin-top:14px;padding:12px 16px;background:rgba(79,209,161,0.08);border:1px solid rgba(79,209,161,0.25);border-radius:14px;">
            <div style="color:#4FD1A1;font-weight:700;font-size:13px;display:flex;align-items:center;gap:6px;">✦ Improved Automatically</div>
            <div style="color:#F5F7FF;font-size:12px;margin-top:4px;">Initial score: ${originalScore}/100 → Final score: ${retryScore}/100</div>
            <div style="color:#9CA8BE;font-size:11px;margin-top:4px;line-height:1.4;">Tsukuyomi AI detected initial capture issues and automatically captured a secondary authorized frame.</div>
        </div>`;
    }

    let cardBody = '';
    if (!aiStatus || aiStatus === 'unavailable' || aiStatus === 'error') {
        cardBody = `<div style="color:#9CA8BE;font-size:13px;">AI analysis unavailable for this incident.</div>`;
    } else {
        const usable = score >= 60;
        const scoreColor = usable ? '#4FD1A1' : '#F06A78';
        const statusLabel = usable ? 'Useful Evidence' : 'Limited Evidence';
        cardBody = `
            <div style="display:flex;align-items:baseline;gap:8px;margin-bottom:12px;">
                <span style="font-size:32px;font-weight:800;color:${scoreColor};">${score}</span>
                <span style="color:#9CA8BE;font-size:14px;">/ 100</span>
                <span style="margin-left:auto;padding:3px 12px;border-radius:999px;background:${usable ? 'rgba(79,209,161,0.12)' : 'rgba(240,106,120,0.12)'};border:1px solid ${usable ? 'rgba(79,209,161,0.3)' : 'rgba(240,106,120,0.3)'};color:${scoreColor};font-size:12px;font-weight:600;">${statusLabel}</span>
            </div>
            ${issuesHtml ? `<div style="margin-bottom:12px;">${issuesHtml}</div>` : ''}
            ${summary ? `<div style="color:#9CA8BE;font-size:13px;line-height:1.6;border-top:1px solid rgba(255,255,255,0.08);padding-top:12px;">${summary}</div>` : ''}
            ${retryBadge}
        `;
    }

    const card = document.createElement('div');
    card.id = 'tsukuyomi-ai-card';
    card.style.cssText = `
        margin: 20px 0;
        background: rgba(15, 22, 38, 0.65);
        border: 1px solid rgba(150, 170, 255, 0.15);
        backdrop-filter: blur(16px);
        border-radius: 22px;
        padding: 22px;
        font-family: 'Geist', sans-serif;
        box-shadow: 0 20px 50px rgba(0,0,0,0.5);
    `;
    card.innerHTML = `
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:16px;">
            <span style="font-size:18px;">🤖</span>
            <span style="font-size:15px;font-weight:600;color:#F5F7FF;letter-spacing:0.02em;">AI Evidence Intelligence</span>
            <span style="margin-left:auto;color:#8FA7FF;font-size:11px;text-transform:uppercase;letter-spacing:0.06em;background:rgba(143,167,255,0.1);padding:2px 8px;border-radius:999px;">Gemini</span>
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
