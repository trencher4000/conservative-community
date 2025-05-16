document.addEventListener('DOMContentLoaded', () => {
    // Set up video functionality
    setupVideo();
    
    // Set up copy button functionality
    setupCopyButton();
    
    // Load real community data
    loadRealCommunityData();
    
    // Refresh data periodically (every 5 minutes)
    setInterval(loadRealCommunityData, 5 * 60 * 1000);
});

// Set up video functionality
function setupVideo() {
    const video = document.getElementById('promo-video');
    
    // Replace this URL with your actual video URL
    // Note: For this example, we're using the Dropbox URL from the user query
    // In a real implementation, you should host the video on your own server or a CDN
    const videoUrl = "https://www.dropbox.com/scl/fi/ph6e98p8j58li2j3pkjws/CNSRV-2.mp4?rlkey=e9e8wkdnffcuehwmiylf5qxdu&raw=1";
    
    // Set the video source
    video.querySelector('source').src = videoUrl;
    
    // Load the video
    video.load();
    
    // Handle video loading errors
    video.addEventListener('error', () => {
        console.error('Video failed to load');
        // Show the placeholder if the video fails to load
        document.querySelector('.video-placeholder').style.display = 'block';
    });
}

// Load real community data from the scraper API
async function loadRealCommunityData() {
    try {
        // Show loading indicators
        showLoadingState();
        
        // The URL of your scraper API
        // Change this to your actual API URL when deployed
        const apiUrl = getApiUrl();
        
        console.log(`Fetching community data from: ${apiUrl}`);
        
        // Fetch data from the API
        const response = await fetch(`${apiUrl}/api/community-data`);
        
        if (!response.ok) {
            throw new Error(`API responded with status: ${response.status}`);
        }
        
        const data = await response.json();
        console.log('Received community data:', data);
        
        // Update UI with the real data
        updateProfileGrid(data.profiles);
        updateStats(data.stats);
        
        // Hide loading indicators
        hideLoadingState();
        
    } catch (error) {
        console.error('Failed to load community data:', error);
        
        // Hide loading indicators
        hideLoadingState();
        
        // Fall back to basic profile grid if API fails
        generateBasicProfileGrid();
        
        // Show error message
        showErrorMessage('Could not load real community data. Using placeholders instead.');
    }
}

// Get the API URL based on the environment
function getApiUrl() {
    // For local development 
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
        return 'http://localhost:3000';
    }
    
    // For production environment
    return window.location.origin;
}

// Show loading indicators
function showLoadingState() {
    // Add loading class to profile grid
    document.getElementById('profile-grid').classList.add('loading');
    
    // You could add more loading indicators here
}

// Hide loading indicators
function hideLoadingState() {
    // Remove loading class from profile grid
    document.getElementById('profile-grid').classList.remove('loading');
    
    // Remove any other loading indicators
}

// Show error message
function showErrorMessage(message) {
    console.error(message);
    
    // You could add a UI element to show the error message
    // For now just log to console
}

// Update the profile grid with real profiles
function updateProfileGrid(profiles) {
    const profileGrid = document.getElementById('profile-grid');
    profileGrid.innerHTML = ''; // Clear existing profiles
    
    // Use the real profiles from scraper
    if (profiles && profiles.length > 0) {
        profiles.forEach(profile => {
            const profileImg = document.createElement('div');
            profileImg.className = 'profile-img';
            profileImg.style.backgroundImage = `url('${profile.picture}')`;
            profileImg.setAttribute('title', profile.name);
            profileGrid.appendChild(profileImg);
        });
    } else {
        // Fallback to basic grid if no profiles
        generateBasicProfileGrid();
    }
}

// Update stats with real data
function updateStats(stats) {
    if (!stats) return;
    
    // Update patriots/members count
    const patriotsCountEl = document.getElementById('patriots-count');
    if (stats.members) {
        patriotsCountEl.textContent = stats.members;
        
        // Also update the join button text
        const joinButtons = document.querySelectorAll('.join-btn');
        joinButtons.forEach(btn => {
            btn.textContent = `Join ${stats.members}+ Patriots`;
        });
    }
    
    // Update engagement stats
    const impressionsEl = document.querySelector('#impressions .stat-value');
    const likesEl = document.querySelector('#likes .stat-value');
    const retweetsEl = document.querySelector('#retweets .stat-value');
    
    if (stats.impressions) {
        impressionsEl.textContent = formatNumber(stats.impressions);
    }
    
    if (stats.likes) {
        likesEl.textContent = formatNumber(stats.likes);
    }
    
    if (stats.retweets) {
        retweetsEl.textContent = formatNumber(stats.retweets);
    }
}

// Fallback to basic profile grid if API fails
function generateBasicProfileGrid() {
    const profileGrid = document.getElementById('profile-grid');
    profileGrid.innerHTML = ''; // Clear any existing profiles
    
    const totalProfiles = 80;
    for (let i = 0; i < totalProfiles; i++) {
        const profileImg = document.createElement('div');
        profileImg.className = 'profile-img';
        profileGrid.appendChild(profileImg);
    }
}

// Format numbers with commas for thousands
function formatNumber(num) {
    return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

// Copy flag emoji to clipboard
function setupCopyButton() {
    const copyBtn = document.querySelector('.copy-btn');
    const flag = document.querySelector('.flag').textContent;
    
    copyBtn.addEventListener('click', () => {
        navigator.clipboard.writeText(flag)
            .then(() => {
                const originalText = copyBtn.textContent;
                copyBtn.textContent = 'Copied!';
                
                setTimeout(() => {
                    copyBtn.textContent = originalText;
                }, 2000);
            })
            .catch(err => {
                console.error('Could not copy text: ', err);
            });
    });
} 