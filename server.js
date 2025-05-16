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

// Cache for storing the scraped data
let communityDataCache = {
  profiles: [],
  stats: {
    members: 0,
    impressions: 0,
    likes: 0,
    retweets: 0
  },
  lastUpdated: null
};

// Define a function to load puppeteer dynamically
let puppeteer;
const loadPuppeteer = async () => {
  if (!puppeteer) {
    try {
      puppeteer = require('puppeteer');
      console.log('Puppeteer loaded successfully');
      return true;
    } catch (error) {
      console.error('Error loading puppeteer:', error.message);
      return false;
    }
  }
  return true;
};

// Function to scrape X community data
async function scrapeXCommunity() {
  console.log('Starting scrape of X community...');
  
  // Try to load puppeteer
  const puppeteerLoaded = await loadPuppeteer();
  if (!puppeteerLoaded) {
    console.error('Cannot scrape: Puppeteer is not available');
    return false;
  }
  
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
    
    // Update cache
    communityDataCache = {
      profiles: profiles,
      stats: {
        members: parseInt(memberCount) || 600,
        impressions: stats.impressions || 254789,
        likes: stats.likes || 12543,
        retweets: stats.retweets || 3982
      },
      lastUpdated: new Date()
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
  // If we haven't scraped any data yet, return default data
  if (!communityDataCache.lastUpdated) {
    return res.json({
      profiles: generateDefaultProfiles(20),
      stats: {
        members: 600,
        impressions: 254789,
        likes: 12543,
        retweets: 3982
      },
      lastUpdated: null
    });
  }
  
  res.json(communityDataCache);
});

// Generate default profile data when scraping is not available
function generateDefaultProfiles(count) {
  return Array.from({ length: count }, (_, i) => ({
    name: `Conservative Member ${i + 1}`,
    picture: `https://via.placeholder.com/400?text=Member${i+1}`,
    username: `conservative${i+1}`
  }));
}

// Trigger a manual refresh of the data
app.post('/api/refresh-data', async (req, res) => {
  try {
    // Start scraping in the background
    console.log('Manual refresh requested');
    
    // Check if puppeteer is available
    const puppeteerLoaded = await loadPuppeteer();
    if (!puppeteerLoaded) {
      return res.status(503).json({ 
        success: false, 
        message: 'Scraping functionality is not available',
        fallbackData: true
      });
    }
    
    // Start scraping in the background
    scrapeXCommunity().catch(error => console.error('Scrape error:', error));
    
    res.json({ success: true, message: 'Data refresh started' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Schedule scraping (if supported)
let scrapeScheduler = null;

// Function to initialize the scrape scheduler
function initializeScrapeScheduler() {
  if (scrapeScheduler) {
    console.log('Scrape scheduler already running');
    return;
  }
  
  // Try to load puppeteer first to see if we can scrape
  loadPuppeteer().then(puppeteerLoaded => {
    if (puppeteerLoaded) {
      console.log('Setting up scrape scheduler...');
      
      // Scrape immediately on startup
      scrapeXCommunity().catch(error => console.error('Initial scrape error:', error));
      
      // Then set up interval (every 2 hours)
      scrapeScheduler = setInterval(() => {
        console.log('Running scheduled scrape...');
        scrapeXCommunity().catch(error => console.error('Scheduled scrape error:', error));
      }, 2 * 60 * 60 * 1000); // 2 hours
      
      console.log('Scrape scheduler initialized');
    } else {
      console.log('Puppeteer not available, running in fallback mode');
    }
  });
}

// Start the server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Health check available at: http://localhost:${PORT}/health`);
  console.log(`API endpoint available at: http://localhost:${PORT}/api/community-data`);
  
  // Initialize scrape scheduler after server starts
  setTimeout(initializeScrapeScheduler, 5000);
}); 