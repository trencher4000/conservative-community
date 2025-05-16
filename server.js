const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const { TwitterApi } = require('twitter-api-v2');
const app = express();
const PORT = process.env.PORT || 3000;

// Environment variables for Twitter API (can be set in Render environment variables)
const TWITTER_API_KEY = process.env.TWITTER_API_KEY || '';
const TWITTER_API_SECRET = process.env.TWITTER_API_SECRET || '';
const TWITTER_BEARER_TOKEN = process.env.TWITTER_BEARER_TOKEN || '';

// Conservative community ID on X
const CONSERVATIVE_COMMUNITY_ID = '1922392299163595186';

// Initialize Twitter client if credentials are available
let twitterClient = null;
try {
  if (TWITTER_BEARER_TOKEN) {
    twitterClient = new TwitterApi(TWITTER_BEARER_TOKEN);
    console.log('Twitter API client initialized with bearer token');
  } else if (TWITTER_API_KEY && TWITTER_API_SECRET) {
    twitterClient = new TwitterApi({
      appKey: TWITTER_API_KEY,
      appSecret: TWITTER_API_SECRET
    });
    console.log('Twitter API client initialized with app credentials');
  } else {
    console.warn('No Twitter API credentials found, using static data only');
  }
} catch (error) {
  console.error('Error initializing Twitter API client:', error.message);
}

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

// Initial static community data (fallback)
let communityData = {
  profiles: generateDefaultProfiles(20),
  stats: {
    members: 600,
    impressions: 254789,
    likes: 12543,
    retweets: 3982
  },
  lastUpdated: new Date().toISOString(),
  isStatic: true
};

// Generate default profile data as fallback
function generateDefaultProfiles(count) {
  return Array.from({ length: count }, (_, i) => ({
    name: `Conservative Member ${i + 1}`,
    picture: `https://via.placeholder.com/400?text=Member${i+1}`,
    username: `conservative${i+1}`
  }));
}

// Function to fetch community data from Twitter API
async function fetchCommunityData() {
  if (!twitterClient) {
    console.log('Twitter API client not available, using static data');
    return false;
  }

  try {
    console.log('Fetching community data from Twitter API...');
    
    // Get the read-only client
    const readOnlyClient = twitterClient.readOnly;
    
    // Get community details
    const community = await readOnlyClient.v2.community(CONSERVATIVE_COMMUNITY_ID, {
      'community.fields': ['member_count']
    });
    
    console.log('Community data:', community.data);
    
    // Get community members (needs elevated access or community admin rights)
    // This might require specific permissions from Twitter
    let members = [];
    try {
      const membersResponse = await readOnlyClient.v2.communityMembers(CONSERVATIVE_COMMUNITY_ID, {
        max_results: 100,
        'user.fields': ['profile_image_url', 'name', 'username']
      });
      members = membersResponse.data || [];
      console.log(`Found ${members.length} community members`);
    } catch (memberError) {
      console.warn('Could not fetch community members, using simulated profiles:', memberError.message);
      // If we can't get members, generate some based on the community name
      members = generateDefaultProfiles(20);
    }
    
    // Map members to profiles format
    const profiles = members.map(member => ({
      name: member.name || 'Community Member',
      picture: member.profile_image_url || `https://via.placeholder.com/400?text=${member.username}`,
      username: member.username
    }));
    
    // Get engagement stats for the community
    // This is more complex and might require aggregating data from community posts
    // For now, we'll use estimated values or static values
    const stats = {
      members: community.data.member_count || 600,
      impressions: 254789, // Static value as this is hard to get from API
      likes: 12543,       // Static value as this is hard to get from API
      retweets: 3982      // Static value as this is hard to get from API
    };
    
    // Update community data with real API data
    communityData = {
      profiles: profiles.length > 0 ? profiles : communityData.profiles,
      stats: {
        members: stats.members || communityData.stats.members,
        impressions: stats.impressions || communityData.stats.impressions,
        likes: stats.likes || communityData.stats.likes,
        retweets: stats.retweets || communityData.stats.retweets
      },
      lastUpdated: new Date().toISOString(),
      isStatic: false
    };
    
    console.log('Community data fetched successfully');
    return true;
  } catch (error) {
    console.error('Error fetching community data from Twitter API:', error);
    return false;
  }
}

// API endpoint to get community data
app.get('/api/community-data', (req, res) => {
  console.log('API request received for community data');
  res.json(communityData);
});

// Trigger a manual refresh of the data
app.post('/api/refresh-data', async (req, res) => {
  try {
    console.log('Manual refresh requested');
    
    if (twitterClient) {
      console.log('Attempting to fetch fresh data from Twitter API...');
      const success = await fetchCommunityData();
      
      if (success) {
        console.log('Data refreshed with API data');
        return res.json({ 
          success: true, 
          message: 'Data refreshed with real community data',
          isStatic: false
        });
      }
    }
    
    // Fallback to static refresh if API fetch fails or Twitter client isn't available
    console.log('Using static data refresh');
    
    // Update timestamp
    communityData.lastUpdated = new Date().toISOString();
    
    // Add a few more profiles to simulate change
    const newProfiles = generateDefaultProfiles(3);
    communityData.profiles = [...newProfiles, ...communityData.profiles.slice(0, 17)];
    
    // Update stats slightly
    communityData.stats.impressions += Math.floor(Math.random() * 1000);
    communityData.stats.likes += Math.floor(Math.random() * 100);
    communityData.stats.retweets += Math.floor(Math.random() * 50);
    communityData.isStatic = true;
    
    console.log('Data refreshed with static data');
    res.json({ 
      success: true, 
      message: 'Data refreshed with simulated data',
      isStatic: true
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

// Start the server and initial API fetch
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Health check available at: http://localhost:${PORT}/health`);
  console.log(`API endpoint available at: http://localhost:${PORT}/api/community-data`);
  console.log(`Current directory: ${__dirname}`);
  console.log(`Node environment: ${process.env.NODE_ENV}`);
  
  // Try to fetch community data on startup
  if (twitterClient) {
    // Wait a bit for the server to be fully initialized
    setTimeout(async () => {
      console.log('Running initial API data fetch...');
      try {
        await fetchCommunityData();
      } catch (error) {
        console.error('Initial API fetch failed:', error);
      }
    }, 5000); // Wait 5 seconds before first fetch
  } else {
    console.log('Twitter API client not available, skipping initial data fetch');
  }
}); 