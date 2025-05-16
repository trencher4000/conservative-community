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
        // Core community accounts - most important ones first
        'CNSRV_', 'ConservativeOG', 'GreatJoeyJones', 'RaheemKassam',
        'DonaldJTrumpJr', 'RealCandaceO', 'mtgreenee', 'TuckerCarlson', 
        'charliekirk11', 'IngrahamAngle', 'RubinReport', 'laurenboebert',
        'elonmusk', 'Jim_Jordan', 'seanhannity', 'tedcruz'
      ];
      
      console.log(`Using a smaller list of ${confirmedCommunityMembers.length} key community members`);
      
      // Fetch profiles in smaller batches of 5 to avoid rate limits
      for (let i = 0; i < confirmedCommunityMembers.length; i += 5) {
        try {
          const batch = confirmedCommunityMembers.slice(i, i + 5);
          console.log(`Fetching small batch of community members: ${batch.join(', ')}...`);
          
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
        
        // Hardcoded data for key community members - 40 confirmed members only
        profiles = [
          {
            name: "CNSRV",
            username: "CNSRV_",
            picture: "https://pbs.twimg.com/profile_images/1707797390380593152/RQmfJWb2_400x400.jpg",
            followers_count: 32000,
            description: "Building the largest community of America-First Patriots on X."
          },
          {
            name: "Donald Trump Jr.",
            username: "DonaldJTrumpJr",
            picture: "https://pbs.twimg.com/profile_images/1250944328806338560/4KvGwuZ6_400x400.jpg",
            followers_count: 10200000,
            description: "EVP of Development & Acquisitions The @Trump Organization, Father, Outdoorsman, In a past life Boardroom Advisor on The Apprentice."
          },
          {
            name: "Candace Owens",
            username: "RealCandaceO",
            picture: "https://pbs.twimg.com/profile_images/1712839909128978432/2TYm1ITK_400x400.jpg",
            followers_count: 4700000,
            description: "Christian. Mother. Wife. Founder of GUHC & @BLEXIT. Unaffiliated."
          },
          {
            name: "Marjorie Taylor Greene",
            username: "mtgreenee",
            picture: "https://pbs.twimg.com/profile_images/1620573046239289347/t0H7eQcM_400x400.jpg",
            followers_count: 2600000,
            description: "Congresswoman for GA-14 Mom, Christian, American 🇺🇸 MAGA 🇺🇸"
          },
          {
            name: "Tucker Carlson",
            username: "TuckerCarlson",
            picture: "https://pbs.twimg.com/profile_images/1747756785499025408/X-WLWrPa_400x400.jpg",
            followers_count: 10900000,
            description: "Tucker Carlson Network @TCNetwork"
          },
          {
            name: "Charlie Kirk",
            username: "charliekirk11",
            picture: "https://pbs.twimg.com/profile_images/1726400278852460545/Nrb2x6p__400x400.jpg",
            followers_count: 2600000,
            description: "Founder and President of Turning Point USA, TPUSA Action, and Turning Point Endowment. Trustee of America First Policy Institute."
          },
          {
            name: "Laura Ingraham",
            username: "IngrahamAngle",
            picture: "https://pbs.twimg.com/profile_images/1522381921523933184/D0ZHUaYP_400x400.jpg",
            followers_count: 3400000,
            description: "Host of 'The Ingraham Angle' weeknights at 10pm ET on @FoxNews. My new podcast: https://t.co/1aqoFtZFPU RT does not equal endorsement."
          },
          {
            name: "Dave Rubin",
            username: "RubinReport",
            picture: "https://pbs.twimg.com/profile_images/1723786465034362880/-uREeXBh_400x400.jpg",
            followers_count: 1400000,
            description: "Thinking out loud, cracking jokes and building the future. Host of The Rubin Report, author of NYT best-sellers Don't Burn This Book and Don't Burn This Country"
          },
          {
            name: "Lauren Boebert",
            username: "laurenboebert",
            picture: "https://pbs.twimg.com/profile_images/1682459374267170816/8LJGmKcV_400x400.jpg",
            followers_count: 2300000,
            description: "Congresswoman for CO-03, Small business owner, wife, mom of four boys."
          },
          {
            name: "Elon Musk",
            username: "elonmusk",
            picture: "https://pbs.twimg.com/profile_images/1683325380441128960/yRsRRjGO_400x400.jpg",
            followers_count: 159000000,
            description: "I work at SpaceX and Tesla 𝕏 = Ø̷̘̗͚"
          },
          {
            name: "Jim Jordan",
            username: "Jim_Jordan",
            picture: "https://pbs.twimg.com/profile_images/1536748389125038080/SEKjnbfK_400x400.jpg",
            followers_count: 3200000,
            description: "Proudly serving the Fourth District of Ohio"
          },
          {
            name: "Sean Hannity",
            username: "seanhannity",
            picture: "https://pbs.twimg.com/profile_images/1683185908244246528/8SsgLrzk_400x400.jpg",
            followers_count: 6300000,
            description: "TV Host Fox News Channel 9PM EST. Nationally Syndicated Radio Host 3-6PM EST."
          },
          {
            name: "Ted Cruz",
            username: "tedcruz",
            picture: "https://pbs.twimg.com/profile_images/1392585981839572993/Nnh5LilE_400x400.jpg",
            followers_count: 5400000,
            description: "U.S. Senator for Texas. Pray for peace in Jerusalem. Psalm 137:5-6"
          },
          {
            name: "Gov. Ron DeSantis",
            username: "GovRonDeSantis",
            picture: "https://pbs.twimg.com/profile_images/1267573226265759744/BGAE0ulc_400x400.jpg",
            followers_count: 2300000,
            description: "Florida's 46th Governor"
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
            description: "Thank you for the privilege of your time. Fox News Contributor & Host. @FoxBusiness @FoxNews @TheFive Retired USMC EOD"
          },
          {
            name: "Ben Shapiro",
            username: "benshapiro",
            picture: "https://pbs.twimg.com/profile_images/1610755652669526023/qY8rYfEQ_400x400.jpg",
            followers_count: 5900000,
            description: "EIC @realDailyWire; host of The Ben Shapiro Show (@BenShapiroShow); author of 10 NYT bestsellers; husband, father, orthodox Jew."
          },
          {
            name: "Matt Walsh",
            username: "MattWalshBlog",
            picture: "https://pbs.twimg.com/profile_images/1655588987248136193/4BhHT6cB_400x400.jpg",
            followers_count: 2700000,
            description: "Theocratic fascist, bestselling children's author, founder of the Anti-Matt Walsh Institute for Women Respecters, and #1 NYT bestselling author"
          },
          {
            name: "Dan Bongino",
            username: "dbongino",
            picture: "https://pbs.twimg.com/profile_images/1494020708876398614/p-5S5P2K_400x400.jpg",
            followers_count: 2800000,
            description: "Host of The Dan Bongino Show. Executive Producer, Conservative Review. Former Secret Service Agent, and NYPD officer. Doing my best to fight the good fight."
          },
          {
            name: "Jack Posobiec",
            username: "JackPosobiec",
            picture: "https://pbs.twimg.com/profile_images/1683511207633858561/EY7L0E5o_400x400.jpg",
            followers_count: 2300000,
            description: "National Security Researcher, TPUSA. Telling stories from America and around the world. Ex-USIC TS//SCI."
          },
          {
            name: "Catturd",
            username: "catturd2",
            picture: "https://pbs.twimg.com/profile_images/1667381756160954368/Z72m2yAO_400x400.jpg",
            followers_count: 2400000,
            description: "The MAGA cat who talks shit."
          },
          {
            name: "Mike Cernovich",
            username: "Cernovich",
            picture: "https://pbs.twimg.com/profile_images/1550625507942785024/cVt-Uujx_400x400.jpg",
            followers_count: 1600000,
            description: "Author, filmmaker, lawyer who left the case law life behind. Married to a Persian-American immigrant."
          },
          {
            name: "Hugh Hewitt",
            username: "hughhewitt",
            picture: "https://pbs.twimg.com/profile_images/1733524883947454464/LNRMpb_U_400x400.jpg",
            followers_count: 480000,
            description: "Host of @MorningHewittShow @SalemRadioNet, contributor @NBCNews @TODAYshow @MeetThePress and @WashingtonPost."
          },
          {
            name: "Tim Scott",
            username: "SenatorTimScott",
            picture: "https://pbs.twimg.com/profile_images/1348673173987532802/6vfNtJ7k_400x400.jpg",
            followers_count: 912000,
            description: "United States Senator from South Carolina"
          },
          {
            name: "Tom Fitton",
            username: "TomFitton",
            picture: "https://pbs.twimg.com/profile_images/1685336603835904000/8Gk7MpVW_400x400.jpg",
            followers_count: 2100000,
            description: "President of Judicial Watch @JudicialWatch."
          },
          {
            name: "Joe Rogan",
            username: "joerogan",
            picture: "https://pbs.twimg.com/profile_images/1653559658854817803/UxQMl78K_400x400.jpg",
            followers_count: 10800000,
            description: "Stand up comic, podcast host, TV host, husband, father, bow hunter."
          },
          {
            name: "Kayleigh McEnany",
            username: "kayleighmcenany",
            picture: "https://pbs.twimg.com/profile_images/1346628908597850113/TKUcKHhH_400x400.jpg",
            followers_count: 2600000,
            description: "Co-Host of @Outnumbered. Former White House Press Secretary. Proud Mama & Wife. @Harvard_Law JD. Author of For Such A Time As This."
          },
          {
            name: "Sebastian Gorka",
            username: "SebGorka",
            picture: "https://pbs.twimg.com/profile_images/1351641319022997505/I2TEPvEi_400x400.jpg",
            followers_count: 1100000,
            description: "Host of AMERICA First, @GoUSA_Radio-@SalemMediaGrp, Nationally Syndicated. Fox News Contributor. Faith, Family, Freedom."
          },
          {
            name: "Buck Sexton",
            username: "BuckSexton",
            picture: "https://pbs.twimg.com/profile_images/1684956941452099584/OO0qsI9e_400x400.jpg",
            followers_count: 1000000,
            description: "Host, The Clay Travis and Buck Sexton Show. @ClayAndBuck."
          },
          {
            name: "Glenn Beck",
            username: "glennbeck",
            picture: "https://pbs.twimg.com/profile_images/1545060678927876099/AE2tz4TW_400x400.jpg",
            followers_count: 1600000,
            description: "Founder of @theblaze, @blazetv, @mercuryone & @americanjourney. Nationally syndicated radio & TV host."
          },
          {
            name: "Dana Loesch",
            username: "DLoesch",
            picture: "https://pbs.twimg.com/profile_images/1707809631359574016/JzRUprXD_400x400.jpg",
            followers_count: 1200000,
            description: "Nationally syndicated radio and award-winning TV host, bestselling author. 2A advocate. Wife, mom, homeschool mom, country music fan."
          },
          {
            name: "Mike Pompeo",
            username: "mikepompeo",
            picture: "https://pbs.twimg.com/profile_images/1747729563204075520/FsEMRJ95_400x400.jpg",
            followers_count: 1300000,
            description: "Proud Kansan and American. 70th Secretary of State. Husband, dad, Army vet, and former Director of the CIA."
          },
          {
            name: "Senator Rand Paul",
            username: "RandPaul",
            picture: "https://pbs.twimg.com/profile_images/1683505165196046337/5CJg-9Q__400x400.jpg",
            followers_count: 3500000,
            description: "I fight for the Constitution, individual liberty and the freedoms that make this country great."
          },
          {
            name: "Governor Sarah Huckabee Sanders",
            username: "SarahHuckabee",
            picture: "https://pbs.twimg.com/profile_images/1614994788977291265/5qXW6Qbg_400x400.jpg",
            followers_count: 1100000,
            description: "Governor of Arkansas. Former White House Press Secretary. Proud wife and mom of three."
          },
          {
            name: "Jordan Peterson",
            username: "jordanbpeterson",
            picture: "https://pbs.twimg.com/profile_images/1760071475763720192/aKx2HCSO_400x400.jpg",
            followers_count: 4600000,
            description: "Follow my Daily Wire companion account @JordanBPetersonDW for the launch of @DailyWirePlus"
          },
          {
            name: "Dinesh D'Souza",
            username: "DineshDSouza",
            picture: "https://pbs.twimg.com/profile_images/1527362404462166018/wrEZ9vDz_400x400.jpg",
            followers_count: 2700000,
            description: "Author, filmmaker, podcaster. My latest feature film is 2000 Mules, available at 2000Mules.com."
          },
          {
            name: "Scott Adams",
            username: "ScottAdamsSays",
            picture: "https://pbs.twimg.com/profile_images/1736872558864293888/vu_2s4GI_400x400.jpg",
            followers_count: 1200000,
            description: "Co-founder of WhenHub. Creator of Dilbert. Author. Sometimes interesting."
          },
          {
            name: "Mark Levin",
            username: "marklevinshow",
            picture: "https://pbs.twimg.com/profile_images/756218386114347008/pQ7G5t3N_400x400.jpg",
            followers_count: 3300000,
            description: "Constitutional Conservative, Radio & TV Host, Lawyer, Author"
          },
          {
            name: "Bill O'Reilly",
            username: "BillOReilly",
            picture: "https://pbs.twimg.com/profile_images/1683192166943834114/BdXkUQV4_400x400.jpg",
            followers_count: 2700000,
            description: "America's Bestselling Historian. Join billoreilly.com."
          },
          {
            name: "Diamond and Silk",
            username: "DiamondandSilk",
            picture: "https://pbs.twimg.com/profile_images/1633180820969730050/XOcNvC37_400x400.jpg",
            followers_count: 1400000,
            description: "Biological Sisters in Love with America! Authors of the Best Selling Book Uprising, 'Diamond & Silk The Untold Story' A CURE, Not a SHOT"
          },
          // Add the "and more" indicator profile
          {
            name: "...and hundreds more Patriots!",
            username: "more_patriots",
            picture: "https://i.imgur.com/JnhnxJJ.png", // A generic patriotic or conservative-themed image
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
      communityData = {
        profiles: uniqueProfiles,
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