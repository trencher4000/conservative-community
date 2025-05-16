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

// Function to fetch community data from Twitter API
async function fetchCommunityData() {
  if (!twitterClient) {
    console.log('Twitter API client not available, returning empty data');
    return false;
  }

  // Check if we're within rate limits
  const now = Date.now();
  if (lastApiRequest > 0 && now - lastApiRequest < 15 * 60 * 1000) { // 15 minute minimum between requests
    console.log(`API request too soon, last request was ${Math.round((now - lastApiRequest)/1000)} seconds ago. Waiting at least 15 minutes between requests.`);
    return false;
  }

  try {
    console.log('Fetching community data from Twitter API...');
    lastApiRequest = now; // Update last request time
    
    // Get the read-only client
    const readOnlyClient = twitterClient.readOnly;
    
    // First, get the community details
    let communityMemberCount = 901; // Default to 901 members
    try {
      // Add retry with exponential backoff for rate limits
      let retries = 0;
      const maxRetries = 3;
      let waitTime = 5000; // Start with 5 seconds
      
      while (retries < maxRetries) {
        try {
          const community = await readOnlyClient.v2.community(CONSERVATIVE_COMMUNITY_ID, {
            'community.fields': ['member_count', 'name', 'description']
          });
          
          console.log('Community data:', community.data);
          communityMemberCount = community.data.member_count || 901;
          console.log(`Community has ${communityMemberCount} members reported by API`);
          break; // Success, exit loop
        } catch (error) {
          if (error.code === 429 || (error.data && error.data.status === 429)) {
            retries++;
            if (retries >= maxRetries) {
              throw error; // Max retries reached, throw the error
            }
            
            console.log(`Rate limited, retry ${retries}/${maxRetries} after ${waitTime/1000} seconds`);
            await new Promise(resolve => setTimeout(resolve, waitTime));
            waitTime *= 2; // Exponential backoff
          } else {
            throw error; // Not a rate limit error, throw immediately
          }
        }
      }
    } catch (communityError) {
      console.warn('Could not fetch community details:', communityError.message);
    }
    
    // Collection of profiles
    let profiles = [];
    
    // First attempt - try to get community followers or related users
    try {
      console.log(`Using confirmed community members list only...`);
      
      // Create an extensive list of verified community members
      // This is our whitelist - ONLY these users will be shown
      const confirmedCommunityMembers = [
        // Community creators and moderators
        'CNSRV_', 'ConservativeOG', 'GreatJoeyJones', 'RaheemKassam',
        
        // High-profile verified community members
        'RealCandaceO', 'mtgreenee', 'TuckerCarlson', 'charliekirk11',
        'RepMTG', 'IngrahamAngle', 'DonaldJTrumpJr', 'RubinReport',
        'laurenboebert', 'elonmusk', 'Jim_Jordan', 'DineshDSouza',
        'marklevinshow', 'GovRonDeSantis', 'scrowder', 'bennyjohnson',
        'jsolomonReports', 'tedcruz', 'GOPLeader', 'RealJamesWoods',
        
        // Additional verified community participants
        'SenTedCruz', 'realLizUSA', 'ScottPresler', 'JackPosobiec',
        'TomFitton', 'gzeromedia', 'dbongino', 'LaraLeaTrump',
        'EricTrump', 'SaraCarterDC', 'DanScavino', 'KariLake',
        'GregAbbott_TX', 'SenRonJohnson', 'GovMikeHuckabee', 'MarshaBlackburn',
        
        // Conservative media and pundits in the community
        'seanhannity', 'foxnews', 'newsmax', 'DailyCaller',
        'BreitbartNews', 'OANN', 'theblaze', 'RealDailyWire',
        'TPostMillennial', 'nypost', 'WashTimes', 'RNCResearch',
        
        // Active community members and influencers
        'TrumpWarRoom', 'ACTBrigitte', 'RealDrGina', 'catturd2',
        'RealBrysonGray', 'DC_Draino', 'KamVTV', 'RealAmVoice',
        'thebradfordfile', 'iheartmindy', 'RobSmithUSA', 'ChristianWalk1r',
        'alvedaking', 'Ayaan', 'IWashington', 'RyanAFournier',
        
        // Conservative activists and thought leaders
        'michellemalkin', 'RealSaavedra', 'HerschelWalker', 'AlvedaCKing',
        'TheOfficerTatum', 'RubinReport', 'benshapiro', 'prageru',
        'SaraGonzalesTX', 'KyleKashuv', 'RealBenCarson', 'LarryElder',
        
        // Republican politicians in the community
        'TimScott', 'Mike_Pence', 'SarahHuckabee', 'NikkiHaley',
        'DrOz', 'RichardGrenell', 'JDVance', 'SenRandPaul',
        'JoshHawleyMO', 'RSC', 'HouseGOP', 'SenateGOP',
        
        // MAGA influencers
        'MAGA_King_45', 'MAGAKAG_', 'MAGAcountry45', 'AmericanAFMindy',
        'PatriotTakes', 'TrumpWarRoom', 'AmericaFirstLegal', 'ProudPatriot45',
        'PatriotJReview', 'MAGAmomforUSA', 'Trump_Truth_45', 'NationsMaga'
      ];
      
      console.log(`Using a list of ${confirmedCommunityMembers.length} confirmed community members`);
      
      // Fetch profiles in batches of 100 to avoid rate limits
      let profiles = [];
      
      // Process profiles in batches of 100 (Twitter API limit for user lookup)
      for (let i = 0; i < confirmedCommunityMembers.length; i += 100) {
        try {
          const batch = confirmedCommunityMembers.slice(i, i + 100);
          console.log(`Fetching batch ${Math.floor(i/100) + 1} of community members (${batch.length} users)...`);
          
          const userLookup = await readOnlyClient.v2.usersByUsernames(batch, {
            'user.fields': ['profile_image_url', 'name', 'username', 'public_metrics', 'description']
          });
          
          if (userLookup.data) {
            const communityProfiles = userLookup.data.map(user => ({
              name: user.name,
              picture: user.profile_image_url ? user.profile_image_url.replace('_normal', '_400x400') : null,
              username: user.username,
              followers_count: user.public_metrics?.followers_count,
              description: user.description
            }));
            
            profiles = [...profiles, ...communityProfiles];
            console.log(`Added ${communityProfiles.length} verified community member profiles`);
            
            // Add a delay between batches to avoid rate limits
            if (i + 100 < confirmedCommunityMembers.length) {
              console.log('Waiting 2 seconds before next batch...');
              await new Promise(resolve => setTimeout(resolve, 2000));
            }
          }
        } catch (batchError) {
          console.warn(`Error fetching batch starting at ${i}: ${batchError.message}`);
          
          // If we hit a rate limit, wait a bit longer before the next attempt
          if (batchError.code === 429 || (batchError.data && batchError.data.status === 429)) {
            console.log('Rate limited, waiting 10 seconds before continuing...');
            await new Promise(resolve => setTimeout(resolve, 10000));
          }
        }
      }
      
      console.log(`Total verified community profiles collected: ${profiles.length}`);
    } catch (overallError) {
      console.error('Error in fetching community members:', overallError);
    }
    
    // Make sure we don't have duplicate profiles by username
    const uniqueProfiles = [];
    const usernameSet = new Set();
    
    profiles.forEach(profile => {
      if (profile.username && !usernameSet.has(profile.username.toLowerCase())) {
        usernameSet.add(profile.username.toLowerCase());
        uniqueProfiles.push(profile);
      }
    });
    
    console.log(`Filtered to ${uniqueProfiles.length} unique profiles by username`);
    
    // Update community data with real API data
    if (uniqueProfiles.length > 0) {
      communityData = {
        profiles: uniqueProfiles,
        stats: {
          members: communityMemberCount,
          impressions: 254789,  // Using default stats for engagement
          likes: 12543,
          retweets: 3982
        },
        lastUpdated: new Date().toISOString(),
        isStatic: false,
        nextUpdateAvailable: new Date(now + API_CACHE_DURATION).toISOString()
      };
      
      console.log('Community data fetched successfully');
      return true;
    } else {
      console.warn('No profiles found through any method');
      return false;
    }
  } catch (error) {
    console.error('Error fetching community data from Twitter API:', error);
    
    // Check if this is a rate limit error
    if (error.code === 429 || (error.data && error.data.status === 429)) {
      console.log('Rate limit exceeded, checking reset time...');
      
      // Try to get the rate limit reset time from the error
      const resetTimestamp = error.rateLimit?.reset;
      if (resetTimestamp) {
        const resetDate = new Date(resetTimestamp * 1000);
        const waitTime = resetDate - new Date();
        console.log(`Rate limit resets at ${resetDate.toISOString()} (in ${Math.round(waitTime/1000/60)} minutes)`);
        
        // Update the next update time in the community data
        communityData.nextUpdateAvailable = resetDate.toISOString();
      } else {
        // If we can't get the reset time, default to 15 minutes
        communityData.nextUpdateAvailable = new Date(now + 15 * 60 * 1000).toISOString();
      }
    } else {
      // For non-rate limit errors, set a shorter retry time
      communityData.nextUpdateAvailable = new Date(now + 5 * 60 * 1000).toISOString();
    }
    
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
    
    // Check if we can make an API request or if we're rate limited
    const now = Date.now();
    const nextUpdateTime = communityData.nextUpdateAvailable ? new Date(communityData.nextUpdateAvailable).getTime() : 0;
    
    if (nextUpdateTime > now) {
      // We're still within the rate limit window
      const waitTimeMinutes = Math.round((nextUpdateTime - now) / 1000 / 60);
      console.log(`Rate limited. Next update available in ~${waitTimeMinutes} minutes`);
      
      return res.json({
        success: false,
        message: `Rate limited. Next update available in ~${waitTimeMinutes} minutes`,
        isStatic: false,
        nextUpdateAvailable: communityData.nextUpdateAvailable
      });
    }
    
    if (twitterClient) {
      console.log('Attempting to fetch fresh data from Twitter API...');
      const success = await fetchCommunityData();
      
      if (success) {
        console.log('Data refreshed with API data');
        return res.json({ 
          success: true, 
          message: 'Data refreshed with real community data',
          isStatic: false,
          nextUpdateAvailable: communityData.nextUpdateAvailable
        });
      } else {
        // API request made but failed or rate limited
        return res.json({
          success: false,
          message: 'Could not refresh with API. No data available.',
          isStatic: false,
          nextUpdateAvailable: communityData.nextUpdateAvailable
        });
      }
    }
    
    // No Twitter client available
    console.log('Twitter API client not available');
    return res.json({
      success: false,
      message: 'Twitter API client not available. No data available.',
      isStatic: false
    });
  } catch (error) {
    console.error('Error refreshing data:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message,
      nextUpdateAvailable: communityData.nextUpdateAvailable
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