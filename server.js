const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const app = express();
const PORT = process.env.PORT || 3000;

// Enable CORS for all routes
app.use(cors());
app.use(express.json());

// Check if index.html exists in root directory
const indexInRoot = fs.existsSync(path.join(__dirname, 'index.html'));
console.log(`Index.html exists in root directory: ${indexInRoot}`);

// Check if public directory exists
const publicDirExists = fs.existsSync(path.join(__dirname, 'public'));
console.log(`Public directory exists: ${publicDirExists}`);

// If public directory exists, check if index.html exists there
if (publicDirExists) {
  const indexInPublic = fs.existsSync(path.join(__dirname, 'public', 'index.html'));
  console.log(`Index.html exists in public directory: ${indexInPublic}`);
}

// Serve static files from the public directory
app.use(express.static(path.join(__dirname, 'public')));

// Health check endpoint for Render
app.get('/health', (req, res) => {
  res.status(200).send('OK');
});

// Static community data
const staticCommunityData = {
  profiles: generateProfiles(20),
  stats: {
    members: 600,
    impressions: 254789,
    likes: 12543,
    retweets: 3982
  },
  lastUpdated: new Date().toISOString()
};

// Generate profile data
function generateProfiles(count) {
  return Array.from({ length: count }, (_, i) => ({
    name: `Conservative Member ${i + 1}`,
    picture: `https://via.placeholder.com/400?text=Member${i+1}`,
    username: `conservative${i+1}`
  }));
}

// API endpoint to get community data
app.get('/api/community-data', (req, res) => {
  console.log('API request received for community data');
  res.json(staticCommunityData);
});

// Trigger a manual refresh of the data (simulation)
app.post('/api/refresh-data', async (req, res) => {
  try {
    console.log('Manual refresh requested');
    // Update timestamp to simulate refresh
    staticCommunityData.lastUpdated = new Date().toISOString();
    
    // Add a few more profiles to simulate change
    const newProfiles = generateProfiles(3);
    staticCommunityData.profiles = [...newProfiles, ...staticCommunityData.profiles.slice(0, 17)];
    
    // Update stats slightly
    staticCommunityData.stats.impressions += Math.floor(Math.random() * 1000);
    staticCommunityData.stats.likes += Math.floor(Math.random() * 100);
    staticCommunityData.stats.retweets += Math.floor(Math.random() * 50);
    
    console.log('Data refreshed successfully');
    res.json({ 
      success: true, 
      message: 'Data refreshed successfully' 
    });
  } catch (error) {
    console.error('Error refreshing data:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// Handle root route - serve index.html
app.get('/', (req, res) => {
  console.log('Request for root path');
  
  // First try to serve from public directory
  const publicPath = path.join(__dirname, 'public', 'index.html');
  if (fs.existsSync(publicPath)) {
    console.log('Serving index.html from public directory');
    return res.sendFile(publicPath);
  }
  
  // If not in public, try root directory
  const rootPath = path.join(__dirname, 'index.html');
  if (fs.existsSync(rootPath)) {
    console.log('Serving index.html from root directory');
    return res.sendFile(rootPath);
  }
  
  // If neither exists, send a custom error page
  console.log('No index.html found, sending custom error page');
  res.status(404).send(`
    <html>
      <head>
        <title>Conservative Community</title>
        <style>
          body { font-family: Arial, sans-serif; text-align: center; padding: 50px; }
          h1 { color: #ff3b30; }
        </style>
      </head>
      <body>
        <h1>Conservative Community</h1>
        <p>The website is currently being updated. Please check back shortly.</p>
        <p>API endpoints are available at:</p>
        <ul style="list-style: none;">
          <li><a href="/api/community-data">/api/community-data</a></li>
          <li><a href="/health">/health</a></li>
        </ul>
      </body>
    </html>
  `);
});

// Catch-all route to handle SPA routing
app.get('*', (req, res, next) => {
  console.log(`Request for path: ${req.path}`);
  
  // If requesting a known API route or static file that doesn't exist, let it 404 normally
  if (req.path.startsWith('/api/') || req.path.includes('.')) {
    console.log(`Passing through for standard handling: ${req.path}`);
    return next();
  }
  
  // For other routes, try to serve the SPA
  const publicPath = path.join(__dirname, 'public', 'index.html');
  if (fs.existsSync(publicPath)) {
    console.log('Serving SPA from public directory');
    return res.sendFile(publicPath);
  }
  
  const rootPath = path.join(__dirname, 'index.html');
  if (fs.existsSync(rootPath)) {
    console.log('Serving SPA from root directory');
    return res.sendFile(rootPath);
  }
  
  // If SPA doesn't exist, send a 404
  console.log('SPA not found, sending 404');
  res.status(404).send('Not Found');
});

// Error handler
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).send('Something broke!');
});

// Start the server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Health check available at: http://localhost:${PORT}/health`);
  console.log(`API endpoint available at: http://localhost:${PORT}/api/community-data`);
  console.log(`Current directory: ${__dirname}`);
  console.log(`Node environment: ${process.env.NODE_ENV}`);
}); 