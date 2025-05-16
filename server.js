const express = require('express');
const puppeteer = require('puppeteer');
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

// Function to scrape X community data
async function scrapeXCommunity() {
  console.log('Starting scrape of X community...');
  const browser = await puppeteer.launch({
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
  
  try {
    const page = await browser.newPage();
    
    // Set viewport and user agent to mimic a normal browser
    await page.setViewport({ width: 1280, height: 800 });
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36');
    
    // Add a timeout to prevent hanging
    const maxOperationTime = 2 * 60 * 1000; // 2 minutes
    const operationTimeout = setTimeout(() => {
      console.error('Scraping operation timed out');
      browser.close().catch(err => console.error('Error closing browser:', err));
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
    
  } catch (error) {
    console.error('Error during scraping:', error);
  } finally {
    await browser.close().catch(err => console.error('Error closing browser:', err));
  }
}

// API endpoint to get community data
app.get('/api/community-data', (req, res) => {
  // If we haven't scraped any data yet, return default data
  if (!communityDataCache.lastUpdated) {
    return res.json({
      profiles: [],
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

// Trigger a manual refresh of the data
app.post('/api/refresh-data', async (req, res) => {
  try {
    // Start scraping in the background
    console.log('Manual refresh requested');
    scrapeXCommunity().catch(error => console.error('Scrape error:', error));
    
    res.json({ success: true, message: 'Data refresh started' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Start the server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  
  // Initial scrape on server start
  console.log('Scheduling initial scrape...');
  
  // Wait 10 seconds before initial scrape to allow server to fully initialize
  setTimeout(() => {
    scrapeXCommunity().catch(error => console.error('Initial scrape error:', error));
  }, 10000);
  
  // Set up periodic scraping (every 30 minutes)
  // Using setInterval might cause problems on Render free tier, so we use a recursive setTimeout pattern
  let scrapeScheduler = () => {
    const thirtyMinutes = 30 * 60 * 1000;
    console.log(`Scheduling next scrape in ${thirtyMinutes/1000/60} minutes`);
    
    setTimeout(() => {
      console.log('Executing scheduled scrape');
      scrapeXCommunity()
        .catch(error => console.error('Scheduled scrape error:', error))
        .finally(() => {
          scrapeScheduler(); // Schedule next scrape
        });
    }, thirtyMinutes);
  };
  
  // Start the scheduling
  scrapeScheduler();
}); 