const express = require('express');
const cors = require('cors');
const app = express();
const PORT = process.env.PORT || 3000;

// Enable CORS for all routes
app.use(cors());
app.use(express.json());

// Serve static files
app.use(express.static('public'));

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
  res.json(staticCommunityData);
});

// Trigger a manual refresh of the data (simulation)
app.post('/api/refresh-data', async (req, res) => {
  try {
    // Update timestamp to simulate refresh
    staticCommunityData.lastUpdated = new Date().toISOString();
    
    // Add a few more profiles to simulate change
    const newProfiles = generateProfiles(3);
    staticCommunityData.profiles = [...newProfiles, ...staticCommunityData.profiles.slice(0, 17)];
    
    // Update stats slightly
    staticCommunityData.stats.impressions += Math.floor(Math.random() * 1000);
    staticCommunityData.stats.likes += Math.floor(Math.random() * 100);
    staticCommunityData.stats.retweets += Math.floor(Math.random() * 50);
    
    res.json({ 
      success: true, 
      message: 'Data refreshed successfully' 
    });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// Start the server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Health check available at: http://localhost:${PORT}/health`);
  console.log(`API endpoint available at: http://localhost:${PORT}/api/community-data`);
}); 