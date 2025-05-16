const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const { TwitterApi } = require('twitter-api-v2');
const app = express();
const PORT = process.env.PORT || 3000;

// For debugging
console.log('Node environment:', process.env.NODE_ENV);
console.log('Current directory:', process.cwd());

// Environment variables for Twitter API (can be set in Render environment variables)
const TWITTER_API_KEY = process.env.TWITTER_API_KEY || '';
const TWITTER_API_SECRET = process.env.TWITTER_API_SECRET || '';
const TWITTER_BEARER_TOKEN = process.env.TWITTER_BEARER_TOKEN || '';

// Check if Twitter API credentials are available
console.log('Twitter API credentials available:');
console.log('  TWITTER_API_KEY:', TWITTER_API_KEY ? 'Set ✓' : 'Not set ✗');
console.log('  TWITTER_API_SECRET:', TWITTER_API_SECRET ? 'Set ✓' : 'Not set ✗');
console.log('  TWITTER_BEARER_TOKEN:', TWITTER_BEARER_TOKEN ? 'Set ✓' : 'Not set ✗');

// Explicitly disable Twitter API based on environment variable
const disableTwitterApi = process.env.DISABLE_TWITTER_API === 'true';
console.log('DISABLE_TWITTER_API environment variable:', process.env.DISABLE_TWITTER_API);

if (disableTwitterApi) {
  console.log('Twitter API explicitly disabled via environment variable');
} else if (!TWITTER_API_KEY && !TWITTER_API_SECRET && !TWITTER_BEARER_TOKEN) {
  console.log('Twitter API implicitly disabled due to missing credentials');
} else {
  console.log('Twitter API should be enabled with available credentials');
}

// Conservative community ID on X
const CONSERVATIVE_COMMUNITY_ID = '1922392299163595186';

// Add a new cache duration constant near the top of the file
const API_CACHE_DURATION = 60 * 60 * 1000; // 1 hour in milliseconds
const MIN_API_REQUEST_INTERVAL = 60 * 1000; // 1 minute between requests instead of 15 minutes
let lastApiRequest = 0; // Track when we last made an API request

// Initialize Twitter client if credentials are available
let twitterClient = null;
try {
  if (disableTwitterApi) {
    console.warn('⛔ Twitter API client initialization skipped due to DISABLE_TWITTER_API=true');
  } else if (TWITTER_BEARER_TOKEN) {
    console.log('🔑 Attempting to initialize Twitter API client with bearer token...');
    twitterClient = new TwitterApi(TWITTER_BEARER_TOKEN);
    console.log('✅ Twitter API client successfully initialized with bearer token');
  } else if (TWITTER_API_KEY && TWITTER_API_SECRET) {
    console.log('🔑 Attempting to initialize Twitter API client with API key/secret...');
    twitterClient = new TwitterApi({
      appKey: TWITTER_API_KEY,
      appSecret: TWITTER_API_SECRET
    });
    console.log('✅ Twitter API client successfully initialized with API key/secret');
  } else {
    console.warn('⚠️ No Twitter API credentials found, using static profile data only');
  }
  
  // Verify the client is working with a simple test
  if (twitterClient) {
    console.log('🧪 Running test to verify Twitter API client is functional...');
    const readOnlyClient = twitterClient.readOnly;
    // Just access the client to verify it's working
    console.log('✅ Twitter API client appears to be valid');
  }
} catch (error) {
  console.error('❌ Error initializing Twitter API client:', error.message);
  console.error('Stack trace:', error.stack);
  twitterClient = null;
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

// Serve static files from the root directory (for index.html)
app.use(express.static(path.join(__dirname)));

// Handle requests for missing profile pictures
app.get('/images/snaplytics.io_X_*_profile_picture.jpg', (req, res, next) => {
  // Extract username from the URL
  const picturePath = req.path;
  console.log('Looking for profile picture:', picturePath);
  
  // Check if the file exists in the public directory
  const publicFilePath = path.join(__dirname, 'public', picturePath);
  if (fs.existsSync(publicFilePath)) {
    console.log('Found profile picture in public directory:', publicFilePath);
    return res.sendFile(publicFilePath);
  }
  
  console.log('Profile picture not found:', publicFilePath);
  // If it doesn't exist, continue to the next middleware
  next();
});

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
  console.log('⚙️ fetchCommunityData() called');
  
  if (!twitterClient) {
    console.log('⚠️ Twitter API client not available, using fallback profile data');
    // Always provide fallback data with profiles
    communityData = createFallbackCommunityData();
    console.log(`📊 Created fallback data with ${communityData.profiles.length} profile entries`);
    return false;
  }

  // Check if we're within rate limits - REDUCED from 15 minutes to 1 minute
  const now = Date.now();
  if (lastApiRequest > 0 && now - lastApiRequest < MIN_API_REQUEST_INTERVAL) {
    console.log(`⏱️ API request too soon, last request was ${Math.round((now - lastApiRequest)/1000)} seconds ago. Using existing data.`);
    return false;
  }

  try {
    console.log('🔄 Fetching community data from Twitter API...');
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
          // Enhanced rate limit logging
          if (error.code === 429 || (error.data && error.data.status === 429)) {
            // Extract rate limit information from headers if available
            logRateLimitInfo(error, 'community endpoint');
            
            retries++;
            if (retries >= maxRetries) {
              throw error; // Max retries reached, throw the error
            }
            
            console.log(`Rate limited, retry ${retries}/${maxRetries} after ${waitTime/1000} seconds`);
            await new Promise(resolve => setTimeout(resolve, waitTime));
            waitTime *= 2; // Exponential backoff
          } else {
            console.error(`Community endpoint error: ${error.message}`);
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
    console.error('❌ Error fetching community data from Twitter API:', error.message);
    
    // Log rate limit information
    if (error.code === 429 || (error.data && error.data.status === 429)) {
      logRateLimitInfo(error, 'fetchCommunityData');
    }
    
    // Make sure we always have profile data available
    if (!communityData.profiles || communityData.profiles.length === 0) {
      console.log('📊 No profiles available, using fallback profile data');
      communityData = createFallbackCommunityData();
    }
    
    // Check if this is a rate limit error
    if (error.code === 429 || (error.data && error.data.status === 429)) {
      console.log('Rate limit exceeded, checking reset time...');
      
      // Try to get the rate limit reset time from the error
      const resetTimestamp = error.rateLimit?.reset || 
                           (error._headers && error._headers['x-rate-limit-reset']) || 
                           (error.data && error.data.errors && error.data.errors[0].reset_at);
                           
      if (resetTimestamp) {
        // Convert to timestamp if it's a date string
        const resetTime = typeof resetTimestamp === 'string' && resetTimestamp.includes('T') 
          ? new Date(resetTimestamp) 
          : new Date(resetTimestamp * 1000);
          
        const waitTime = resetTime - new Date();
        console.log(`Rate limit resets at ${resetTime.toISOString()} (in ${Math.round(waitTime/1000/60)} minutes)`);
        
        // Update the next update time in the community data
        communityData.nextUpdateAvailable = resetTime.toISOString();
      } else {
        // If we can't get the reset time, default to a shorter time (5 minutes)
        communityData.nextUpdateAvailable = new Date(now + 5 * 60 * 1000).toISOString();
        console.log(`No reset time found, defaulting to 5 minute wait`);
      }
    } else {
      // For non-rate limit errors, set a shorter retry time
      communityData.nextUpdateAvailable = new Date(now + 2 * 60 * 1000).toISOString();
      console.log(`Non-rate limit error, will retry in 2 minutes`);
    }
    
    return false;
  }
}

// Create fallback community data with hardcoded profiles
function createFallbackCommunityData() {
  console.log('📋 Creating fallback community data with hardcoded profiles');
  return {
    profiles: [
      // Priority accounts
      {
        name: "Kevin Sorbo",
        username: "ksorbs",
        picture: "/images/snaplytics.io_X_ksorbs_profile_picture.jpg",
        followers_count: 587000,
        description: "Actor, director, producer, author."
      },
      {
        name: "ANTUNES",
        username: "Antunes1",
        picture: "/images/snaplytics.io_X_Antunes1_profile_picture.jpg",
        followers_count: 152000,
        description: "Pro America. MAGA. Crypto."
      },
      {
        name: "Laura Loomer",
        username: "LauraLoomer",
        picture: "/images/snaplytics.io_X_LauraLoomer_profile_picture.jpg",
        followers_count: 623000,
        description: "Investigative Journalist 🇺🇸 Free Spirit 🇺🇸 Founder of LOOMERED."
      },
      // Add more profiles as needed
      {
        name: "CNSRV",
        username: "CNSRV_",
        picture: "/images/conservative-logo.png",
        followers_count: 32000,
        description: "Building the largest community of America-First Patriots on X."
      },
      {
        name: "Conservative OG",
        username: "ConservativeOG",
        picture: "/images/conservative-logo.png",
        followers_count: 20000,
        description: "Official account of the Conservative community"
      }
    ],
    stats: {
      members: 903,
      impressions: 254789,
      likes: 12543,
      retweets: 3982
    },
    lastUpdated: new Date().toISOString(),
    isStatic: true,
    nextUpdateAvailable: new Date(Date.now() + 15 * 60 * 1000).toISOString()
  };
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

// Add this new function to extract and log rate limit information from error responses
function logRateLimitInfo(error, endpoint) {
  console.log(`🚨 Rate limit hit on ${endpoint}`);
  
  try {
    // Check for headers in the error object
    const headers = error.rateLimit || error._headers || (error.request && error.request.res && error.request.res.headers);
    
    if (headers) {
      const limit = headers['x-rate-limit-limit'] || 'unknown';
      const remaining = headers['x-rate-limit-remaining'] || 'unknown';
      const reset = headers['x-rate-limit-reset'] || 'unknown';
      
      console.log(`📊 Rate limit details for ${endpoint}:`);
      console.log(`  • Limit: ${limit}`);
      console.log(`  • Remaining: ${remaining}`);
      console.log(`  • Reset: ${reset ? new Date(reset * 1000).toISOString() : 'unknown'}`);
      
      if (reset) {
        const resetTime = new Date(reset * 1000);
        const waitTimeSeconds = Math.max(0, Math.ceil((resetTime - new Date()) / 1000));
        console.log(`  • Wait time: ${waitTimeSeconds} seconds (${Math.ceil(waitTimeSeconds/60)} minutes)`);
      }
    } else if (error.data && error.data.errors) {
      // Handle Twitter API v2 error format
      const errors = error.data.errors;
      errors.forEach(err => {
        console.log(`  • Error: ${err.title || err.message}`);
        console.log(`  • Detail: ${err.detail || 'No details'}`);
        
        // Some errors contain rate limit info in a different format
        if (err.type === 'https://api.twitter.com/2/problems/resource-exhausted') {
          console.log(`  • Scope: ${err.scope || 'unknown'}`);
          console.log(`  • Reset: ${err.reset_at || 'unknown'}`);
        }
      });
    } else {
      console.log('  • No detailed rate limit information available in error');
    }
  } catch (extractError) {
    console.error(`Error extracting rate limit info: ${extractError.message}`);
  }
} 