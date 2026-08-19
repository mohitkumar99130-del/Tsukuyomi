const express = require('express');
const path = require('path');
const http = require('http');
const https = require('https');
const app = express();
const port = process.env.PORT || 3000;
const BACKEND_HOST = process.env.BACKEND_HOST || '127.0.0.1';
const BACKEND_PORT = process.env.BACKEND_PORT || 8000;

app.use(express.static(path.join(__dirname, 'public')));
app.use('/views', express.static(path.join(__dirname, 'public', 'views')));

// Transparent proxy for /api and /media to FastAPI backend
app.use(['/api', '/media'], (req, res) => {
    const backendUrl = process.env.BACKEND_URL;
    if (backendUrl) {
        try {
            const targetUrl = new URL(req.originalUrl, backendUrl);
            const client = targetUrl.protocol === 'https:' ? https : http;
            const headers = { ...req.headers, host: targetUrl.host };
            
            const proxyReq = client.request(targetUrl, { method: req.method, headers }, (proxyRes) => {
                res.writeHead(proxyRes.statusCode, proxyRes.headers);
                proxyRes.pipe(res, { end: true });
            });

            proxyReq.on('error', (err) => {
                console.error('[Proxy Error]', err.message);
                res.status(502).json({ error: 'Backend service unreachable' });
            });

            req.pipe(proxyReq, { end: true });
            return;
        } catch (e) {
            console.error('[Proxy Exception]', e);
        }
    }

    const options = {
        hostname: BACKEND_HOST,
        port: BACKEND_PORT,
        path: req.originalUrl,
        method: req.method,
        headers: { ...req.headers, host: `${BACKEND_HOST}:${BACKEND_PORT}` }
    };

    const proxyReq = http.request(options, (proxyRes) => {
        res.writeHead(proxyRes.statusCode, proxyRes.headers);
        proxyRes.pipe(res, { end: true });
    });

    proxyReq.on('error', (err) => {
        console.error('[Proxy Error]', err.message);
        res.status(502).json({ error: 'Backend service unreachable' });
    });

    req.pipe(proxyReq, { end: true });
});

app.use((req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

if (require.main === module) {
    app.listen(port, () => {
        console.log(`Tsukuyomi UI listening at http://localhost:${port}`);
    });
}

module.exports = app;
