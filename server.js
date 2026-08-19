const express = require('express');
const path = require('path');
const http = require('http');
const app = express();
const port = process.env.PORT || 3000;
const BACKEND_HOST = process.env.BACKEND_HOST || '127.0.0.1';
const BACKEND_PORT = process.env.BACKEND_PORT || 8000;

app.use(express.static('public'));
app.use('/views', express.static('public/views'));

// Transparent proxy for /api and /media to FastAPI backend
app.use(['/api', '/media'], (req, res) => {
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

app.listen(port, () => {
    console.log(`Tsukuyomi UI listening at http://localhost:${port}`);
});

