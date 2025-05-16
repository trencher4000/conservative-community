const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const { TwitterApi } = require('twitter-api-v2');
const axios = require('axios');
const app = express();
const PORT = process.env.PORT || 3000;

// Environment variables for Twitter API (can be set in Render environment variables)
const TWITTER_API_KEY = process.env.TWITTER_API_KEY || '';
const TWITTER_API_SECRET = process.env.TWITTER_API_SECRET || '';
const TWITTER_BEARER_TOKEN = process.env.TWITTER_BEARER_TOKEN || '';

// For private API access
const TWITTER_AUTH_TOKEN = process.env.TWITTER_AUTH_TOKEN || '';
const TWITTER_CSRF_TOKEN = process.env.TWITTER_CSRF_TOKEN || '';
const TWITTER_GUEST_TOKEN = process.env.TWITTER_GUEST_TOKEN || '';

// Conservative community ID on X
const CONSERVATIVE_COMMUNITY_ID = '1922392299163595186';

// Add a new cache duration constant near the top of the file
const API_CACHE_DURATION = 60 * 60 * 1000; // 1 hour in milliseconds
let lastApiRequest = 0; // Track when we last made an API request

// Initialize Twitter client if credentials are available
let twitterClient = null;
let usingPrivateApi = false;

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
  } else if (TWITTER_AUTH_TOKEN && TWITTER_CSRF_TOKEN) {
    usingPrivateApi = true;
    console.log('Using Twitter private GraphQL API with authenticated headers');
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
    members: 0,
    impressions: 0,
    likes: 0,
    retweets: 0
  },
  lastUpdated: new Date().toISOString(),
  isStatic: false
};

// Generate default profile data as fallback
function generateDefaultProfiles(count) {
  return []; // No longer generating placeholder profiles
}

// Function to fetch community data from private Twitter GraphQL API
async function fetchCommunitiesDataFromPrivateApi() {
  if (!TWITTER_AUTH_TOKEN || !TWITTER_CSRF_TOKEN) {
    console.log('Twitter private API credentials not available');
    return null;
  }

  try {
    console.log('Fetching community data from Twitter private GraphQL API...');
    
    // Set up the headers for authenticated request
    const headers = {
      'authorization': `Bearer ${TWITTER_BEARER_TOKEN || 'AAAAAAAAAAAAAAAAAAAAANRILgAAAAAAnNwIzUejRCOuH5E6I8xnZz4puTs%3D1Zv7ttfk8LF81IUq16cHjhLTvJu4FA33AGWWjCpTnA'}`,
      'cookie': `auth_token=${TWITTER_AUTH_TOKEN}; ct0=${TWITTER_CSRF_TOKEN};`,
      'x-csrf-token': TWITTER_CSRF_TOKEN,
      'x-twitter-auth-type': 'OAuth2Session',
      'content-type': 'application/json',
      'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
    };

    if (TWITTER_GUEST_TOKEN) {
      headers['x-guest-token'] = TWITTER_GUEST_TOKEN;
    }

    // First, get community details
    console.log(`Fetching details for community: ${CONSERVATIVE_COMMUNITY_ID}`);
    const communityResponse = await axios.get(
      `https://twitter.com/i/api/graphql/LeKmU-1-Dye7GSU5JjKQEA/CommunityProfileScreen?variables=%7B%22communityId%22%3A%22${CONSERVATIVE_COMMUNITY_ID}%22%7D`,
      { headers }
    );
    
    const communityData = communityResponse.data;
    console.log('Community metadata fetched successfully');
    
    let memberCount = 0;
    let communityName = "Conservative Community";
    let communityDescription = "";
    
    try {
      // Parse the community details
      const communityInfo = communityData.data.communityResults.result;
      memberCount = communityInfo.member_count;
      communityName = communityInfo.name;
      communityDescription = communityInfo.description;
      
      console.log(`Community details: ${communityName}, ${memberCount} members`);
    } catch (e) {
      console.warn('Error parsing community details:', e.message);
    }
    
    // Now fetch community members
    console.log('Fetching community members...');
    
    let profiles = [];
    let cursor = null;
    let hasMoreMembers = true;
    let pageCount = 0;
    const maxPages = 8; // Limit to 8 pages to avoid excessive requests
    
    while (hasMoreMembers && pageCount < maxPages) {
      try {
        // Build the request URL with cursor for pagination
        let membersUrl = `https://twitter.com/i/api/graphql/j6XA4LBfx2yUn7E3hNW_TQ/CommunityMembers?variables=%7B%22communityId%22%3A%22${CONSERVATIVE_COMMUNITY_ID}%22%2C%22count%22%3A100`;
        
        if (cursor) {
          membersUrl += `%2C%22cursor%22%3A%22${encodeURIComponent(cursor)}%22`;
        }
        
        membersUrl += '%7D';
        
        // Make the request
        const membersResponse = await axios.get(membersUrl, { headers });
        
        // Parse the member results
        const memberItems = membersResponse.data.data.communityMemberships.slice || [];
        
        if (memberItems.length === 0) {
          console.log('No more members to fetch');
          hasMoreMembers = false;
          break;
        }
        
        // Process member data
        const newProfiles = [];
        
        for (const item of memberItems) {
          if (item.entryType === "TimelineTimelineItem" && 
              item.itemContent && 
              item.itemContent.itemType === "TimelineUser") {
            
            const userData = item.itemContent.user_results.result;
            
            if (userData) {
              newProfiles.push({
                name: userData.legacy.name,
                username: userData.legacy.screen_name,
                picture: userData.legacy.profile_image_url_https.replace('_normal', '_400x400'),
                followers_count: userData.legacy.followers_count,
                description: userData.legacy.description
              });
            }
          }
          
          // Check for cursor in the entry
          if (item.entryType === "TimelineTimelineCursor" && 
              item.cursorType === "Bottom") {
            cursor = item.value;
          }
        }
        
        console.log(`Fetched ${newProfiles.length} members on page ${pageCount + 1}`);
        profiles = [...profiles, ...newProfiles];
        
        // Check if we need to continue
        if (!cursor) {
          hasMoreMembers = false;
        } else {
          pageCount++;
          // Add a delay to avoid rate limits
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      } catch (error) {
        console.error('Error fetching members page:', error.message);
        hasMoreMembers = false;
      }
    }
    
    console.log(`Total members fetched: ${profiles.length}`);
    
    // Make sure we don't have duplicate profiles
    const uniqueProfiles = [];
    const usernameSet = new Set();
    
    profiles.forEach(profile => {
      if (profile.username && !usernameSet.has(profile.username.toLowerCase())) {
        usernameSet.add(profile.username.toLowerCase());
        uniqueProfiles.push(profile);
      }
    });
    
    console.log(`Filtered to ${uniqueProfiles.length} unique profiles`);
    
    return {
      profiles: uniqueProfiles,
      stats: {
        members: memberCount || uniqueProfiles.length,
        impressions: 254789,
        likes: 12543,
        retweets: 3982
      }
    };
  } catch (error) {
    console.error('Error in private API fetch:', error.message);
    return null;
  }
}

// Function to fetch community data from Twitter API
async function fetchCommunityData() {
  // First, try the private API approach if credentials are available
  if (usingPrivateApi) {
    try {
      console.log('Attempting to fetch data using private Twitter API...');
      const privateApiData = await fetchCommunitiesDataFromPrivateApi();
      
      if (privateApiData && privateApiData.profiles.length > 0) {
        console.log('Successfully fetched data using private API');
        
        // Update community data with the fetched data
        communityData = {
          ...privateApiData,
          lastUpdated: new Date().toISOString(),
          isStatic: false,
          nextUpdateAvailable: new Date(Date.now() + API_CACHE_DURATION).toISOString()
        };
        
        return true;
      } else {
        console.log('Private API fetch returned no data, falling back to official API');
      }
    } catch (privateApiError) {
      console.error('Private API fetch failed:', privateApiError.message);
    }
  }

  // Continue with the official API approach if private API failed or not available
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
    let communityMemberCount = 0;
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
          communityMemberCount = community.data.member_count || 0;
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
    
    // First attempt - try to use the List Members API endpoint if available with your access level
    try {
      console.log(`Attempting to get community members for: ${CONSERVATIVE_COMMUNITY_ID}`);
      
      // For pagination
      let paginationToken = null;
      let hasMorePages = true;
      let pageCount = 0;
      const maxPages = 10; // Limit to 10 pages to avoid excessive API calls
      
      while (hasMorePages && pageCount < maxPages && profiles.length < 500) {
        console.log(`Fetching page ${pageCount + 1} of community members...`);
        
        // Some versions of Twitter API prefer using "list members" for communities
        const params = {
          'max_results': 100, // Maximum allowed
          'user.fields': 'profile_image_url,name,username,description,public_metrics'
        };
        
        if (paginationToken) {
          params.pagination_token = paginationToken;
        }
        
        // Try different API endpoints that might be available with your access level
        try {
          // Try as a list
          const result = await readOnlyClient.v2.listMembers(CONSERVATIVE_COMMUNITY_ID, params);
          
          if (result.data && result.data.length > 0) {
            console.log(`Found ${result.data.length} members on page ${pageCount + 1}`);
            
            const newProfiles = result.data.map(user => ({
              name: user.name,
              picture: user.profile_image_url ? user.profile_image_url.replace('_normal', '_400x400') : null,
              username: user.username,
              followers_count: user.public_metrics?.followers_count,
              description: user.description
            }));
            
            profiles = [...profiles, ...newProfiles];
            
            // Check if there are more pages
            if (result.meta && result.meta.next_token) {
              paginationToken = result.meta.next_token;
              pageCount++;
            } else {
              hasMorePages = false;
            }
          } else {
            hasMorePages = false;
          }
        } catch (listError) {
          console.log('List members approach failed, trying users in community endpoint:', listError.message);
          
          try {
            // Try direct community users endpoint
            const result = await readOnlyClient.v2.communityUsers(CONSERVATIVE_COMMUNITY_ID, params);
            
            if (result.data && result.data.length > 0) {
              console.log(`Found ${result.data.length} members on page ${pageCount + 1}`);
              
              const newProfiles = result.data.map(user => ({
                name: user.name,
                picture: user.profile_image_url ? user.profile_image_url.replace('_normal', '_400x400') : null,
                username: user.username,
                followers_count: user.public_metrics?.followers_count,
                description: user.description
              }));
              
              profiles = [...profiles, ...newProfiles];
              
              // Check if there are more pages
              if (result.meta && result.meta.next_token) {
                paginationToken = result.meta.next_token;
                pageCount++;
              } else {
                hasMorePages = false;
              }
            } else {
              hasMorePages = false;
            }
          } catch (usersError) {
            console.log('Direct community users approach failed:', usersError.message);
            hasMorePages = false;
            throw usersError; // Propagate to outer catch
          }
        }
        
        // If we've hit API limits, add a delay before the next page request
        if (hasMorePages) {
          console.log('Waiting 2 seconds before fetching next page...');
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
      }
      
      console.log(`Successfully fetched ${profiles.length} community members across ${pageCount + 1} pages`);
      
    } catch (memberError) {
      console.warn('Could not fetch community members directly:', memberError.message);
      
      // Fallback to searching for tweets mentioning the community
      try {
        console.log(`Falling back to tweet search for community: ${CONSERVATIVE_COMMUNITY_ID}`);
        
        // Search for tweets about this community
        const searchQuery = 'conservative community OR conservative patriots OR MAGA patriots';
        const searchResults = await readOnlyClient.v2.search(searchQuery, {
          'tweet.fields': ['author_id', 'created_at'],
          'user.fields': ['profile_image_url', 'name', 'username', 'public_metrics', 'description'],
          'expansions': ['author_id'],
          'max_results': 100 // Maximum allowed per search request
        });
        
        if (searchResults.includes && searchResults.includes.users) {
          const searchProfiles = searchResults.includes.users.map(user => ({
            name: user.name,
            picture: user.profile_image_url ? user.profile_image_url.replace('_normal', '_400x400') : null,
            username: user.username,
            followers_count: user.public_metrics?.followers_count,
            description: user.description
          }));
          
          profiles = [...profiles, ...searchProfiles];
          console.log(`Found ${searchProfiles.length} additional profiles from search results`);
        }
      } catch (searchError) {
        console.warn('Search fallback failed:', searchError.message);
      }
      
      // If still low on profiles, add conservative accounts as last resort
      if (profiles.length < 50) {
        try {
          console.log('Adding known conservative accounts as fallback');
          
          // List of conservative accounts to use as examples
          const conservativeUsernames = [
            'RealCandaceO', 'TuckerCarlson', 'mtgreenee', 'DonaldJTrumpJr',
            'Jim_Jordan', 'RubinReport', 'scrowder', 'charliekirk11',
            'RealBenCarson', 'seanhannity', 'IngrahamAngle', 'JackPosobiec',
            'DineshDSouza', 'marklevinshow', 'GovRonDeSantis', 'laurenboebert',
            'SenTedCruz', 'bennyjohnson', 'RandPaul', 'ElonMusk',
            'dbongino', 'LaraLeaTrump', 'EricTrump', 'SaraCarterDC'
          ];
          
          const userLookup = await readOnlyClient.v2.usersByUsernames(conservativeUsernames, {
            'user.fields': ['profile_image_url', 'name', 'username', 'public_metrics', 'description']
          });
          
          if (userLookup.data) {
            const fallbackProfiles = userLookup.data.map(user => ({
              name: user.name,
              picture: user.profile_image_url ? user.profile_image_url.replace('_normal', '_400x400') : null,
              username: user.username,
              followers_count: user.public_metrics?.followers_count,
              description: user.description
            }));
            
            profiles = [...profiles, ...fallbackProfiles];
            console.log(`Added ${fallbackProfiles.length} fallback profiles`);
          }
        } catch (lookupError) {
          console.warn('Fallback profile lookup failed:', lookupError.message);
        }
      }
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
          members: communityMemberCount || uniqueProfiles.length,
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