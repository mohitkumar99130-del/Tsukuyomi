let cameraStream = null;
let latestLocation = null;
let currentView = '';

async function startCamera() {
    try {
        cameraStream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: "user" },
            audio: false
        });
        
        // Keep stream active
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
    return new Promise((resolve, reject) => {
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
            (err) => {
                console.error("Location error:", err);
                resolve(false);
            },
            { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
        );
    });
}

// Minimal router
async function navigateTo(path) {
    if (path === currentView) return;
    currentView = path;
    
    // Update URL without reload
    window.history.pushState({}, "", path);
    
    // Map paths to views
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
        
        // Extract body content and classes
        const bodyMatch = text.match(/<body([^>]*)>([\s\S]*?)<\/body>/i);
        if (bodyMatch) {
            const bodyAttrs = bodyMatch[1];
            const bodyContent = bodyMatch[2];
            
            // Extract class from attributes
            const classMatch = bodyAttrs.match(/class=["']([^"']*)["']/i);
            const classes = classMatch ? classMatch[1] : '';
            
            const appRoot = document.getElementById('app-root');
            appRoot.className = classes; // Apply the body classes to the wrapper
            appRoot.innerHTML = bodyContent;
            
            // Execute scripts found in the content
            const scripts = appRoot.querySelectorAll('script');
            scripts.forEach(oldScript => {
                const newScript = document.createElement('script');
                Array.from(oldScript.attributes).forEach(attr => newScript.setAttribute(attr.name, attr.value));
                newScript.appendChild(document.createTextNode(oldScript.innerHTML));
                oldScript.parentNode.replaceChild(newScript, oldScript);
            });
            
            // Re-bind events for the specific view
            bindViewEvents(path);
        }
    } catch (e) {
        console.error("Navigation error:", e);
    }
}

// Handle browser back/forward
window.addEventListener('popstate', () => {
    navigateTo(window.location.pathname);
});

function bindViewEvents(path) {
    if (path === '/') {
        let camReady = cameraStream !== null;
        let locReady = latestLocation !== null;
        
        const camBtn = document.querySelector('button:contains("Allow Camera")') || Array.from(document.querySelectorAll('button')).find(el => el.textContent.includes('Allow Camera'));
        const locBtn = document.querySelector('button:contains("Allow Location")') || Array.from(document.querySelectorAll('button')).find(el => el.textContent.includes('Allow Location'));
        const armBtn = document.querySelector('button:contains("Arm Protection")') || Array.from(document.querySelectorAll('button')).find(el => el.textContent.includes('Arm Protection'));
        
        const updateArmBtn = () => {
            if (camReady && locReady && armBtn) {
                armBtn.removeAttribute('disabled');
                armBtn.classList.remove('cursor-not-allowed', 'opacity-50', 'bg-surface-variant/50', 'text-on-surface-variant/50');
                armBtn.classList.add('bg-primary', 'text-background', 'hover:opacity-80');
            }
        };

        if (camBtn) {
            if (camReady) {
                camBtn.textContent = 'Camera Ready';
                camBtn.disabled = true;
            } else {
                camBtn.addEventListener('click', async () => {
                    const ok = await startCamera();
                    if (ok) {
                        camReady = true;
                        camBtn.textContent = 'Camera Ready';
                        camBtn.disabled = true;
                        updateArmBtn();
                    } else {
                        camBtn.textContent = 'Permission Denied - Retry';
                    }
                });
            }
        }
        
        if (locBtn) {
            if (locReady) {
                locBtn.textContent = 'Location Ready';
                locBtn.disabled = true;
            } else {
                locBtn.addEventListener('click', async () => {
                    const ok = await getLocation();
                    if (ok) {
                        locReady = true;
                        locBtn.textContent = 'Location Ready';
                        locBtn.disabled = true;
                        updateArmBtn();
                    } else {
                        locBtn.textContent = 'Permission Denied - Retry';
                    }
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
    else if (path === '/armed') {
        const simulateBtn = document.querySelector('button.bg-primary') || Array.from(document.querySelectorAll('button')).find(el => el.textContent.includes('Simulate Power Off'));
        if (simulateBtn) {
            // Remove the default script's event listener by cloning the button
            const newBtn = simulateBtn.cloneNode(true);
            simulateBtn.parentNode.replaceChild(newBtn, simulateBtn);
            
            newBtn.addEventListener('click', async () => {
                // Request fullscreen if possible
                try {
                    if (document.documentElement.requestFullscreen) {
                        await document.documentElement.requestFullscreen();
                    }
                } catch(e) {}
                
                // Jump to shutdown immediately
                navigateTo('/shutdown');
                
                // Perform async capture and API post
                await triggerIncident();
            });
        }
    }
    else if (path === '/shutdown') {
        // Hide spinner and text after 2.5 seconds
        setTimeout(() => {
            const container = document.querySelector('.os-spinner')?.parentElement;
            if (container) {
                container.style.transition = 'opacity 0.5s ease-out';
                container.style.opacity = '0';
            }
        }, 2500);
    }
}

async function capturePhoto() {
    const video = document.getElementById('hidden-camera');
    if (!video.videoWidth) return null;
    
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0);
    
    return new Promise(resolve => {
        canvas.toBlob(blob => resolve(blob), 'image/jpeg', 0.8);
    });
}

async function triggerIncident() {
    // Try to get fresh location, fallback to latestLocation
    await getLocation();
    
    const photoBlob = await capturePhoto();
    if (!photoBlob || !latestLocation) {
        console.error("Missing photo or location for trigger");
        return;
    }
    
    const formData = new FormData();
    formData.append('device_name', 'Demo Device');
    formData.append('latitude', latestLocation.latitude);
    formData.append('longitude', latestLocation.longitude);
    formData.append('accuracy', latestLocation.accuracy);
    formData.append('captured_at', latestLocation.timestamp);
    formData.append('photo', photoBlob, 'capture.jpg');
    
    try {
        const response = await fetch('http://localhost:8000/api/trigger', {
            method: 'POST',
            body: formData
        });
        const data = await response.json();
        console.log("Incident created:", data);
    } catch (e) {
        console.error("API Trigger error:", e);
    }
}

// Init
window.addEventListener('DOMContentLoaded', () => {
    navigateTo(window.location.pathname);
});
