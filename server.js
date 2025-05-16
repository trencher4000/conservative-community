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

// Add a new cache duration constant near the top of the file
const API_CACHE_DURATION = 60 * 60 * 1000; // 1 hour in milliseconds
let lastApiRequest = 0; // Track when we last made an API request

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
  profiles: [],
  stats: {
    members: 900,
    impressions: 254789,
    likes: 12543,
    retweets: 3982
  },
  lastUpdated: new Date().toISOString(),
  isStatic: false
};

// Generate default profile data as fallback
function generateDefaultProfiles(count) {
  return []; // No longer generating placeholder profiles
}

// Add a function to generate a random avatar fallback URL
function getDefaultAvatarUrl(username) {
  // Create a deterministic number from the username
  let hash = 0;
  for (let i = 0; i < username.length; i++) {
    hash = username.charCodeAt(i) + ((hash << 5) - hash);
  }
  
  // Select from a set of reliable avatar URLs based on the hash
  const avatarOptions = [
    'https://i.imgur.com/q7vFAVm.png', // Default blue avatar
    'https://i.imgur.com/JnhnxJJ.png', // Patriotic themed
    'https://i.imgur.com/h5QR58N.png', // Conservative logo
    'https://i.imgur.com/fXDP1pA.png', // American flag
    'https://i.imgur.com/VEwEpKY.png'  // Red background
  ];
  
  const index = Math.abs(hash) % avatarOptions.length;
  return avatarOptions[index];
}

// Function to fetch community data from Twitter API
async function fetchCommunityData() {
  console.log('Using hardcoded community data instead of API');
  
  try {
    // Use hardcoded data instead of API
    // Hardcoded data for key community members
    const profiles = [
      // First row - priority accounts
      {
        name: "Kevin Sorbo",
        username: "ksorbs",
        picture: "https://pbs.twimg.com/profile_images/1726403773184184320/LKD3yWIk_400x400.jpg",
        fallbackPicture: "https://i.imgur.com/bLlq6CJ.jpg",
        followers_count: 587000,
        description: "Actor, director, producer, author."
      },
      {
        name: "9mmSMG",
        username: "9mm_smg",
        picture: "https://media.x.com/1737894550523473920/Z44q4r__400x400.jpg",
        fallbackPicture: "https://i.imgur.com/q7vFAVm.png",
        followers_count: 152000,
        description: "Midlife crisis nomad just traveling around before the world ends."
      },
      {
        name: "Robert F. Kennedy Jr.",
        username: "RobertKennedyJc",
        picture: "https://pbs.twimg.com/profile_images/1698025296398221312/i9uY4RuU_400x400.jpg",
        fallbackPicture: "https://i.imgur.com/JnhnxJJ.png",
        followers_count: 245000,
        description: "#MAHA News/No affiliation to the real RFKJR/Satire"
      },
      {
        name: "Laura Loomer",
        username: "LauraLoomer",
        picture: "https://pbs.twimg.com/profile_images/1763607303050702848/7CAcw2xu_400x400.jpg",
        fallbackPicture: "https://i.imgur.com/h5QR58N.png",
        followers_count: 623000,
        description: "Investigative Journalist 🇺🇸 Free Spirit 🇺🇸 Founder of LOOMERED."
      },
      {
        name: "Not Jerome Powell",
        username: "alifarhat79",
        picture: "https://pbs.twimg.com/profile_images/1624136303553536000/azdvv7RM_400x400.jpg",
        fallbackPicture: "https://i.imgur.com/fXDP1pA.png",
        followers_count: 128000,
        description: "Not associated with the Federal Reserve. Financial Parody and sarcasm."
      },
      {
        name: "Liberty Cappy",
        username: "LibertyCappy",
        picture: "https://pbs.twimg.com/profile_images/1733590329378877726/0T_-Oy9e_400x400.jpg",
        fallbackPicture: "https://i.imgur.com/VEwEpKY.png",
        followers_count: 95000,
        description: "Declaration of Memes. Conservative meme creator."
      },
      {
        name: "MAGA Posts",
        username: "MAGAPosts",
        picture: "https://pbs.twimg.com/profile_images/1684599204132548609/onFjF9C7_400x400.jpg",
        fallbackPicture: "https://i.imgur.com/q7vFAVm.png",
        followers_count: 72000,
        description: "Supporting the MAGA movement."
      },
      {
        name: "AKA Face",
        username: "akafaceUS",
        picture: "https://pbs.twimg.com/profile_images/1718315538728312832/1TkPwImo_400x400.jpg",
        fallbackPicture: "https://i.imgur.com/JnhnxJJ.png",
        followers_count: 63000,
        description: "America First Patriot."
      },
      {
        name: "Antunes",
        username: "Antunes1",
        picture: "https://pbs.twimg.com/profile_images/1689666522700627971/yf4DrRnc_400x400.jpg",
        fallbackPicture: "https://i.imgur.com/h5QR58N.png",
        followers_count: 48000,
        description: "Conservative voice. Proud American."
      },
      {
        name: "Unlimited",
        username: "unlimited_ls",
        picture: "https://pbs.twimg.com/profile_images/1619731905317724162/sRJQEJrK_400x400.jpg",
        fallbackPicture: "https://i.imgur.com/fXDP1pA.png",
        followers_count: 52000,
        description: "America First Conservative."
      },
      {
        name: "ALX",
        username: "ALX",
        picture: "https://pbs.twimg.com/profile_images/1713949293223104512/E9lbMAG-_400x400.jpg",
        fallbackPicture: "https://i.imgur.com/VEwEpKY.png",
        followers_count: 923000,
        description: "Trump 2024. America First."
      },
      {
        name: "LP",
        username: "lporiginalg",
        picture: "https://pbs.twimg.com/profile_images/1588232170262278144/kPAFp1Mb_400x400.jpg",
        fallbackPicture: "https://i.imgur.com/q7vFAVm.png",
        followers_count: 212000,
        description: "Independent thought. Freedom lover."
      },
      {
        name: "Liberacrat",
        username: "Liberacrat",
        picture: "https://pbs.twimg.com/profile_images/1683575246796333058/SHyYZGmR_400x400.jpg",
        fallbackPicture: "https://i.imgur.com/JnhnxJJ.png",
        followers_count: 42000,
        description: "Liberacrat Media. Conservative values."
      },
      
      // Row 2 - core accounts
      {
        name: "CNSRV",
        username: "CNSRV_",
        picture: "https://pbs.twimg.com/profile_images/1707797390380593152/RQmfJWb2_400x400.jpg",
        fallbackPicture: "https://i.imgur.com/h5QR58N.png",
        followers_count: 32000,
        description: "Building the largest community of America-First Patriots on X."
      },
      {
        name: "Conservative OG",
        username: "ConservativeOG",
        picture: "https://pbs.twimg.com/profile_images/1733549004635267072/0Nx-0JbH_400x400.jpg",
        fallbackPicture: "https://i.imgur.com/fXDP1pA.png",
        followers_count: 20000,
        description: "Official account of the Conservative community"
      },
      {
        name: "Great Joey Jones",
        username: "GreatJoeyJones",
        picture: "https://pbs.twimg.com/profile_images/1754559548520837120/OZTLfE1X_400x400.jpg",
        fallbackPicture: "https://i.imgur.com/VEwEpKY.png",
        followers_count: 320000,
        description: "Thank you for the privilege of your time. Fox News Contributor & Host."
      },
      {
        name: "Raheem Kassam",
        username: "RaheemKassam",
        picture: "https://pbs.twimg.com/profile_images/1641882393725812738/cNHisq0E_400x400.jpg",
        fallbackPicture: "https://i.imgur.com/q7vFAVm.png",
        followers_count: 290000,
        description: "Editor-in-Chief of @thenationalpulse and host of The National Pulse podcast."
      },
      
      // Rows 3-5 - other verified community members from screenshot
      {
        name: "Dolphin Miharu",
        username: "DolphinMiharu",
        picture: "https://pbs.twimg.com/profile_images/1716158536659853312/gPFwtXh8_400x400.jpg",
        fallbackPicture: "https://i.imgur.com/JnhnxJJ.png",
        followers_count: 18000,
        description: "Conservative community member."
      },
      {
        name: "TrB1620",
        username: "undiavn",
        picture: "https://pbs.twimg.com/profile_images/1713949293223104512/E9lbMAG-_400x400.jpg",
        fallbackPicture: "https://i.imgur.com/h5QR58N.png",
        followers_count: 21000,
        description: "America First. Conservative values."
      },
      {
        name: "Giangkaito",
        username: "Giangkaito",
        picture: "https://pbs.twimg.com/profile_images/1702776361015648256/j6PyxbeX_400x400.jpg",
        fallbackPicture: "https://i.imgur.com/fXDP1pA.png",
        followers_count: 17000,
        description: "Web3 enthusiast. Conservative community."
      },
      {
        name: "Kevin",
        username: "lkevinw",
        picture: "https://pbs.twimg.com/profile_images/1738333088599375872/rKL1amSB_400x400.jpg",
        fallbackPicture: "https://i.imgur.com/VEwEpKY.png",
        followers_count: 12000,
        description: "Conservative voice. America First."
      },
      {
        name: "JenniLeighLou",
        username: "JLH091980",
        picture: "https://pbs.twimg.com/profile_images/1674116512273965056/MoH2QAVe_400x400.jpg",
        fallbackPicture: "https://i.imgur.com/q7vFAVm.png",
        followers_count: 8500,
        description: "Conservative community member. Proud American."
      },
      {
        name: "Charles R Downs",
        username: "TheCharlesDowns",
        picture: "https://pbs.twimg.com/profile_images/1704552443877257216/dRIkLM0E_400x400.jpg",
        fallbackPicture: "https://i.imgur.com/JnhnxJJ.png",
        followers_count: 9800,
        description: "Conservative voice. America First patriot."
      },
      {
        name: "Terraphyre",
        username: "Terraphyre",
        picture: "https://pbs.twimg.com/profile_images/1658929915366998018/5QgD7tDy_400x400.jpg",
        fallbackPicture: "https://i.imgur.com/h5QR58N.png",
        followers_count: 7500,
        description: "Conservative community member."
      },
      {
        name: "Tenekai",
        username: "NopticTO",
        picture: "https://pbs.twimg.com/profile_images/1676323523775229953/cDLYWTxJ_400x400.jpg",
        fallbackPicture: "https://i.imgur.com/fXDP1pA.png",
        followers_count: 6200,
        description: "Conservative voice in the community."
      },
      {
        name: "Why So Serious",
        username: "Why69Serious",
        picture: "https://pbs.twimg.com/profile_images/1606364047221739523/hxS7-H8r_400x400.jpg",
        fallbackPicture: "https://i.imgur.com/VEwEpKY.png",
        followers_count: 8900,
        description: "Conservative meme creator. Freedom lover."
      },
      {
        name: "Duncan Hicks",
        username: "HicksDunca20379",
        picture: "https://pbs.twimg.com/profile_images/1654234398160982016/h9fJ_7Ry_400x400.jpg",
        fallbackPicture: "https://i.imgur.com/q7vFAVm.png",
        followers_count: 4300,
        description: "Conservative community member."
      }
    ];
    
    // Create community data object
    communityData = {
      profiles: profiles,
      stats: {
        members: 903,
        impressions: 254789,
        likes: 12543,
        retweets: 3982
      },
      lastUpdated: new Date().toISOString(),
      isStatic: true
    };
    
    console.log(`Using ${profiles.length} hardcoded community profiles`);
    return true;
  } catch (error) {
    console.error('Error building hardcoded data:', error);
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
    
    // Use hardcoded data instead of API
    const success = await fetchCommunityData();
    
    if (success) {
      console.log('Data refreshed with hardcoded data');
      return res.json({ 
        success: true, 
        message: 'Data refreshed with community member data',
        isStatic: true
      });
    } else {
      return res.json({
        success: false,
        message: 'Could not refresh data. Using fallback.',
        isStatic: true
      });
    }
  } catch (error) {
    console.error('Error refreshing data:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message,
      isStatic: true
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
  
  // Initialize with hardcoded data on startup
  setTimeout(async () => {
    console.log('Loading initial hardcoded data...');
    try {
      await fetchCommunityData();
    } catch (error) {
      console.error('Initial data load failed:', error);
    }
  }, 1000); // Wait 1 second before first load
}); 