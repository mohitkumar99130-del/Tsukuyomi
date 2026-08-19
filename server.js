const express = require('express');
const path = require('path');
const app = express();
const port = 3000;

app.use(express.static('public'));
app.use('/views', express.static('public/views'));

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(port, () => {
  console.log(`Tsukuyomi UI listening at http://localhost:${port}`);
});
