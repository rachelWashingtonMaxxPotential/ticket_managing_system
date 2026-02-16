// server.js - Backend Express server
const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 2222;

app.use(cors());
app.use(express.json());

// Serve static files from the frontend folder
app.use(express.static(path.join(__dirname, '../frontend')));

// API endpoint for health check
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    server: 'express', 
    port: PORT, 
    time: new Date().toISOString() 
  });
});

// API endpoint for processing CSV data (future endpoint)
app.post('/api/upload-csv', (req, res) => {
  // This endpoint can be expanded to handle CSV processing on the backend
  res.json({ 
    message: 'CSV upload endpoint ready',
    received: true 
  });
});

// Fallback to index.html for SPA routing
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/index.html'));
});

app.listen(PORT, () => {
  console.log(`✓ Backend server running at http://127.0.0.1:${PORT}`);
  console.log(`✓ Serving frontend from: ${path.join(__dirname, '../frontend')}`);
});
