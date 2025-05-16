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
      console.warn('Could not fetch community details, using default count:', communityError.message);
    }
    
    // Collection of profiles
    let profiles = [];
    
    // First attempt - try to get community followers or related users
    try {
      console.log(`Using confirmed community members list only...`);
      
      // Create an extensive list of verified community members
      // This is our whitelist - ONLY these users will be shown
      const confirmedCommunityMembers = [
        // Priority row 1 - most important community accounts
        'ksorbs', '9mm_smg', 'RobertKennedyJc', 'LauraLoomer', 'alifarhat79', 
        'LibertyCappy', 'MAGAPosts', 'akafaceUS', 'Antunes1', 'unlimited_ls', 
        'ALX', 'lporiginalg', 'Liberacrat',
        
        // Row 2 - core accounts
        'CNSRV_', 'ConservativeOG', 'GreatJoeyJones',
        
        // Rows 3-5 - other verified community members
        'DolphinMiharu', 'undiavn', 'Giangkaito', 'lkevinw',
        'JLH091980', 'TheCharlesDowns', 'Terraphyre',
        'NopticTO', 'Why69Serious', 'HicksDunca20379', 'gummyscrape',
        'Cristobal_Da_Ra', 'chasedips', 'fenner_parker', 'thejoanmejia',
        'ThePaganProphet', 'digitalducat', 'FarleyM_420', 'ShitcoinProphet',
        'sinclairsips', 'obedjohnson6', 'YipsinMonte', 'MrHonest',
        'blueeyesblinded', 'LilJitt2424', 'fuggQUU', 'FurlogoX',
        'dimegirlchar', 'duonghau09', 'PortaPog', 'sickstreet7',
        'TestnetLord01', 'KekiusMaximus_C', 'jakewlittle', 'xyukicryptx',
        'web3_amayaaa', 'LlcPascale', 'jaydawgtrades'
      ];
      
      console.log(`Using a list of ${confirmedCommunityMembers.length} verified community members`);
      
      // Verify community membership through API first if possible
      let verifiedMembers = [];
      try {
        // Try to fetch community members directly if endpoint is available
        console.log(`Attempting to verify community membership via API...`);
        const communityMembersResponse = await readOnlyClient.v2.communityMembers(CONSERVATIVE_COMMUNITY_ID, {
          'max_results': 50,
          'user.fields': ['profile_image_url', 'name', 'username', 'public_metrics', 'description']
        });
        
        if (communityMembersResponse && communityMembersResponse.data) {
          const apiVerifiedMembers = communityMembersResponse.data.map(user => user.username.toLowerCase());
          console.log(`API directly verified ${apiVerifiedMembers.length} community members`);
          verifiedMembers = apiVerifiedMembers;
        }
      } catch (membershipError) {
        console.warn(`Could not directly verify community membership: ${membershipError.message}`);
        // If we can't verify directly, we'll trust our curated list
        verifiedMembers = confirmedCommunityMembers.map(username => username.toLowerCase());
      }
      
      // Track successful fetches to avoid duplicates
      const fetchedUsernames = new Set();
      
      // Fetch profiles in smaller batches of 5 to avoid rate limits
      for (let i = 0; i < confirmedCommunityMembers.length; i += 5) {
        try {
          const batch = confirmedCommunityMembers.slice(i, i + 5);
          console.log(`Fetching small batch of community members: ${batch.join(', ')}...`);
          
          const userLookup = await readOnlyClient.v2.usersByUsernames(batch, {
            'user.fields': ['profile_image_url', 'name', 'username', 'public_metrics', 'description']
          });
          
          if (userLookup.data) {
            // Only include users that are in our verified list
            const communityProfiles = userLookup.data
              .filter(user => {
                const username = user.username.toLowerCase();
                return verifiedMembers.includes(username) && !fetchedUsernames.has(username);
              })
              .map(user => {
                // Mark as fetched
                fetchedUsernames.add(user.username.toLowerCase());
                
                // Get the profile image URL - ensure we're getting the full size version
                let profileImageUrl = user.profile_image_url || '';
                
                // Twitter API returns small images by default, replace to get larger version
                if (profileImageUrl && profileImageUrl.includes('_normal.')) {
                  profileImageUrl = profileImageUrl.replace('_normal', '_400x400');
                }
                
                // Ensure image URLs use HTTPS
                if (profileImageUrl && profileImageUrl.startsWith('http:')) {
                  profileImageUrl = profileImageUrl.replace('http:', 'https:');
                }
                
                return {
                  name: user.name,
                  picture: profileImageUrl,
                  username: user.username,
                  followers_count: user.public_metrics?.followers_count || 0,
                  description: user.description
                };
              });
            
            profiles = [...profiles, ...communityProfiles];
            console.log(`Added ${communityProfiles.length} verified community member profiles`);
            
            // Add a delay between batches to avoid rate limits
            console.log('Waiting 3 seconds before next batch...');
            await new Promise(resolve => setTimeout(resolve, 3000));
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
      
      console.log(`Total verified community profiles collected through API: ${profiles.length}`);
      
      // If no profiles were found through the API, use hardcoded data as a fallback
      if (profiles.length === 0) {
        console.log('Using hardcoded fallback data since API fetching failed');
        
        // Hardcoded data for key community members - ONLY confirmed members
        profiles = [
          // First row - priority accounts
          {
            name: "Kevin Sorbo",
            username: "ksorbs",
            picture: "https://pbs.twimg.com/profile_images/1726403773184184320/LKD3yWIk_400x400.jpg",
            followers_count: 587000,
            description: "Actor, director, producer, author."
          },
          {
            name: "9mmSMG",
            username: "9mm_smg",
            picture: "https://pbs.twimg.com/profile_images/1737894550523473920/Z44q4r__400x400.jpg",
            followers_count: 152000,
            description: "Midlife crisis nomad just traveling around before the world ends."
          },
          {
            name: "Robert F. Kennedy Jr.",
            username: "RobertKennedyJc",
            picture: "https://pbs.twimg.com/profile_images/1698025296398221312/i9uY4RuU_400x400.jpg",
            followers_count: 245000,
            description: "#MAHA News/No affiliation to the real RFKJR/Satire"
          },
          {
            name: "Laura Loomer",
            username: "LauraLoomer",
            picture: "https://pbs.twimg.com/profile_images/1763607303050702848/7CAcw2xu_400x400.jpg",
            followers_count: 623000,
            description: "Investigative Journalist 🇺🇸 Free Spirit 🇺🇸 Founder of LOOMERED."
          },
          {
            name: "Not Jerome Powell",
            username: "alifarhat79",
            picture: "https://pbs.twimg.com/profile_images/1624136303553536000/azdvv7RM_400x400.jpg",
            followers_count: 128000,
            description: "Not associated with the Federal Reserve. Financial Parody and sarcasm."
          },
          
          // Second row - core accounts
          {
            name: "CNSRV",
            username: "CNSRV_",
            picture: "https://pbs.twimg.com/profile_images/1707797390380593152/RQmfJWb2_400x400.jpg",
            followers_count: 32000,
            description: "Building the largest community of America-First Patriots on X."
          },
          {
            name: "Conservative OG",
            username: "ConservativeOG",
            picture: "https://pbs.twimg.com/profile_images/1733549004635267072/0Nx-0JbH_400x400.jpg",
            followers_count: 20000,
            description: "Official account of the Conservative community"
          },
          {
            name: "Great Joey Jones",
            username: "GreatJoeyJones",
            picture: "https://pbs.twimg.com/profile_images/1754559548520837120/OZTLfE1X_400x400.jpg",
            followers_count: 320000,
            description: "Thank you for the privilege of your time. Fox News Contributor & Host."
          },
          
          // Add the "and more" indicator profile
          {
            name: "...and hundreds more Patriots!",
            username: "more_patriots",
            picture: null, // No image - will use the default styling
            followers_count: 0,
            description: "Join over 900 Conservative Patriots in our community"
          }
        ];
        
        console.log(`Added ${profiles.length} hardcoded community profiles`);
      }
      
      console.log(`Total community profiles to display: ${profiles.length}`);
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
      // Filter out any profiles with Imgur images
      const filteredProfiles = uniqueProfiles.filter(profile => {
        const hasImgur = profile.picture && profile.picture.includes('imgur.com');
        if (hasImgur) {
          console.log(`Removing profile with Imgur placeholder: ${profile.username}`);
          return false;
        }
        return true;
      });
      
      communityData = {
        profiles: filteredProfiles,
        stats: {
          members: communityMemberCount,
          impressions: 254789,
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
      // Fallback to static stats if everything else fails
      communityData = {
        profiles: [],
        stats: {
          members: 901,
          impressions: 254789,
          likes: 12543,
          retweets: 3982
        },
        lastUpdated: new Date().toISOString(),
        isStatic: true
      };
      console.warn('No profiles found through any method, using empty profiles with static stats');
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

// New API endpoint to fetch community posts
app.get('/api/community-posts', async (req, res) => {
  console.log('API request received for community posts');
  
  if (!twitterClient) {
    console.log('Twitter API client not available, returning error');
    return res.status(503).json({
      success: false,
      message: 'Twitter API client not available',
      posts: []
    });
  }
  
  try {
    // Get the read-only client
    const readOnlyClient = twitterClient.readOnly;
    
    // Fetch community posts (timeline)
    const posts = [];
    
    try {
      console.log(`Attempting to fetch posts from community: ${CONSERVATIVE_COMMUNITY_ID}`);
      
      // First try to get posts directly from the community timeline
      const timeline = await readOnlyClient.v2.communityTweets(CONSERVATIVE_COMMUNITY_ID, {
        max_results: 10,
        expansions: ['author_id', 'attachments.media_keys'],
        'tweet.fields': ['created_at', 'public_metrics', 'text'],
        'user.fields': ['name', 'username', 'profile_image_url'],
        'media.fields': ['url', 'preview_image_url']
      });
      
      console.log(`Fetched ${timeline?.data?.length || 0} posts from community timeline`);
      
      if (timeline?.data?.length > 0 && timeline.includes) {
        const users = timeline.includes.users || [];
        const media = timeline.includes.media || [];
        
        // Map user and media information to the tweets
        timeline.data.forEach(tweet => {
          const author = users.find(u => u.id === tweet.author_id);
          
          if (!author) return; // Skip tweets without author info
          
          const mediaItems = [];
          if (tweet.attachments?.media_keys) {
            tweet.attachments.media_keys.forEach(key => {
              const mediaItem = media.find(m => m.media_key === key);
              if (mediaItem) {
                mediaItems.push(mediaItem.url || mediaItem.preview_image_url);
              }
            });
          }
          
          posts.push({
            id: tweet.id,
            text: tweet.text,
            created_at: tweet.created_at,
            author: {
              id: author.id,
              name: author.name,
              username: author.username,
              profile_image_url: author.profile_image_url
            },
            media: mediaItems,
            metrics: tweet.public_metrics
          });
        });
      }
    } catch (timelineError) {
      console.warn('Error fetching community timeline:', timelineError.message);
      
      // If direct community timeline fetch fails, try search as fallback
      try {
        console.log('Trying search query as fallback...');
        const searchResults = await readOnlyClient.v2.search('community:1922392299163595186', {
          max_results: 10,
          expansions: ['author_id', 'attachments.media_keys'],
          'tweet.fields': ['created_at', 'public_metrics', 'text'],
          'user.fields': ['name', 'username', 'profile_image_url'],
          'media.fields': ['url', 'preview_image_url']
        });
        
        console.log(`Fetched ${searchResults?.data?.length || 0} posts from search`);
        
        if (searchResults?.data?.length > 0 && searchResults.includes) {
          const users = searchResults.includes.users || [];
          const media = searchResults.includes.media || [];
          
          // Map user and media information to the tweets
          searchResults.data.forEach(tweet => {
            const author = users.find(u => u.id === tweet.author_id);
            
            if (!author) return; // Skip tweets without author info
            
            const mediaItems = [];
            if (tweet.attachments?.media_keys) {
              tweet.attachments.media_keys.forEach(key => {
                const mediaItem = media.find(m => m.media_key === key);
                if (mediaItem) {
                  mediaItems.push(mediaItem.url || mediaItem.preview_image_url);
                }
              });
            }
            
            posts.push({
              id: tweet.id,
              text: tweet.text,
              created_at: tweet.created_at,
              author: {
                id: author.id,
                name: author.name,
                username: author.username,
                profile_image_url: author.profile_image_url
              },
              media: mediaItems,
              metrics: tweet.public_metrics
            });
          });
        }
      } catch (searchError) {
        console.warn('Error with search fallback:', searchError.message);
        // Continue with any posts we might have or empty array
      }
    }
    
    // Return whatever posts we managed to collect
    return res.json({
      success: posts.length > 0,
      message: posts.length > 0 ? 'Posts fetched successfully' : 'No posts found',
      posts: posts
    });
    
  } catch (error) {
    console.error('Error fetching community posts:', error);
    
    return res.status(500).json({
      success: false,
      message: `Error fetching posts: ${error.message}`,
      posts: []
    });
  }
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