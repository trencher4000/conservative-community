const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const app = express();
const PORT = process.env.PORT || 3000;

// Dynamic puppeteer import to prevent startup failures
let puppeteer;
try {
  puppeteer = require('puppeteer');
  console.log('Puppeteer loaded successfully');
} catch (error) {
  console.warn('Puppeteer not available, using static data only:', error.message);
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

// Function to scrape X community data
async function scrapeXCommunity() {
  if (!puppeteer) {
    console.log('Puppeteer not available, skipping scrape');
    return false;
  }

  console.log('Starting scrape of X community...');
  let browser;
  try {
    browser = await puppeteer.launch({
      headless: 'new',
      args: [
        '--no-sandbox', 
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage', // Important for Render
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-zygote',
        '--single-process',
        '--disable-gpu'
      ]
    });
    
    const page = await browser.newPage();
    
    // Set viewport and user agent to mimic a normal browser
    await page.setViewport({ width: 1280, height: 800 });
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36');
    
    // Add a timeout to prevent hanging
    const maxOperationTime = 2 * 60 * 1000; // 2 minutes
    const operationTimeout = setTimeout(() => {
      console.error('Scraping operation timed out');
      if (browser) browser.close().catch(err => console.error('Error closing browser:', err));
    }, maxOperationTime);
    
    // Go to the X community page
    console.log('Navigating to community page...');
    await page.goto('https://x.com/i/communities/1922392299163595186', {
      waitUntil: 'networkidle2',
      timeout: 60000
    });
    
    // Wait for content to load
    console.log('Waiting for content to load...');
    await page.waitForSelector('img[src*="profile_images"]', { timeout: 60000 });
    
    console.log('Page loaded, extracting data...');
    
    // Extract member count
    const memberCount = await page.evaluate(() => {
      const memberElem = Array.from(document.querySelectorAll('span')).find(el => 
        el.textContent && el.textContent.includes('member'));
      if (memberElem) {
        const text = memberElem.textContent;
        const match = text.match(/(\d+(?:,\d+)*)/);
        return match ? match[0].replace(/,/g, '') : 0;
      }
      return 600; // Fallback value
    });
    
    console.log(`Found member count: ${memberCount}`);
    
    // Extract profile images
    const profiles = await page.evaluate(() => {
      const imgElements = document.querySelectorAll('img[src*="profile_images"]');
      return Array.from(imgElements).slice(0, 100).map(img => {
        const name = img.getAttribute('alt') || 'Community Member';
        // Get larger profile image by modifying URL
        let src = img.getAttribute('src');
        src = src.replace('_normal', '_400x400');
        
        return {
          name: name,
          picture: src,
          username: name.replace(/[^a-zA-Z0-9]/g, '').toLowerCase()
        };
      });
    });
    
    console.log(`Found ${profiles.length} profiles`);
    
    // Get engagement stats by aggregating from visible posts
    const stats = await page.evaluate(() => {
      const likeCountElements = document.querySelectorAll('[data-testid="like"]');
      const retweetCountElements = document.querySelectorAll('[data-testid="retweet"]');
      
      let likes = 0;
      let retweets = 0;
      
      likeCountElements.forEach(el => {
        const text = el.textContent;
        if (text) {
          const match = text.match(/(\d+)/);
          if (match) {
            likes += parseInt(match[0]);
          }
        }
      });
      
      retweetCountElements.forEach(el => {
        const text = el.textContent;
        if (text) {
          const match = text.match(/(\d+)/);
          if (match) {
            retweets += parseInt(match[0]);
          }
        }
      });
      
      // Estimate impressions based on typical engagement rates
      const impressions = (likes + retweets) * 50;
      
      return {
        impressions,
        likes,
        retweets
      };
    });
    
    // Clear the timeout since we're done
    clearTimeout(operationTimeout);
    
    // Update community data with real scraped data
    communityData = {
      profiles: profiles.length > 0 ? profiles : communityData.profiles,
      stats: {
        members: parseInt(memberCount) || communityData.stats.members,
        impressions: stats.impressions || communityData.stats.impressions,
        likes: stats.likes || communityData.stats.likes,
        retweets: stats.retweets || communityData.stats.retweets
      },
      lastUpdated: new Date().toISOString(),
      isStatic: false
    };
    
    console.log('Data scraped successfully');
    return true;
    
  } catch (error) {
    console.error('Error during scraping:', error);
    return false;
  } finally {
    if (browser) {
      await browser.close().catch(err => console.error('Error closing browser:', err));
    }
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
    
    if (puppeteer) {
      console.log('Attempting to scrape fresh data...');
      const success = await scrapeXCommunity();
      
      if (success) {
        console.log('Data refreshed with scraped data');
        return res.json({ 
          success: true, 
          message: 'Data refreshed with real community data',
          isStatic: false
        });
      }
    }
    
    // Fallback to static refresh if scraping fails or puppeteer isn't available
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

// Start the server and initial scrape
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Health check available at: http://localhost:${PORT}/health`);
  console.log(`API endpoint available at: http://localhost:${PORT}/api/community-data`);
  console.log(`Current directory: ${__dirname}`);
  console.log(`Node environment: ${process.env.NODE_ENV}`);
  
  // Try to scrape on startup
  if (puppeteer) {
    // Wait a bit for the server to be fully initialized
    setTimeout(async () => {
      console.log('Running initial scrape...');
      try {
        await scrapeXCommunity();
      } catch (error) {
        console.error('Initial scrape failed:', error);
      }
    }, 10000); // Wait 10 seconds before first scrape
  } else {
    console.log('Puppeteer not available, skipping initial scrape');
  }
}); 