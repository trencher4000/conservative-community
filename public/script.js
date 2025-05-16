document.addEventListener('DOMContentLoaded', () => {
    // Set up video functionality
    setupVideo();
    
    // Set up copy button functionality
    setupCopyButton();
    
    // Load real community data
    loadRealCommunityData();
    
    // Refresh data periodically (every 15 minutes)
    setInterval(loadRealCommunityData, 15 * 60 * 1000);
});

// Set up video functionality
function setupVideo() {
    const video = document.getElementById('promo-video');
    const videoPlaceholder = document.querySelector('.video-placeholder');
    
    // Hide the placeholder by default
    videoPlaceholder.style.display = 'none';
    
    // Direct Dropbox URL with raw=1 parameter for direct access
    const videoUrl = "https://www.dropbox.com/scl/fi/ph6e98p8j58li2j3pkjws/CNSRV-2.mp4?rlkey=e9e8wkdnffcuehwmiylf5qxdu&raw=1";
    
    // Set the video source
    video.querySelector('source').src = videoUrl;
    
    // Ensure autoplay, loop, and muted attributes are set
    video.autoplay = true;
    video.loop = true;
    video.muted = true;
    video.playsInline = true;
    
    // Load the video
    video.load();
    
    // Try to play the video immediately
    video.play().catch(err => {
        console.error('Video autoplay failed:', err);
        // Some browsers require user interaction before autoplay works
    });
    
    // Handle video loading errors
    video.addEventListener('error', (e) => {
        console.error('Video failed to load:', e);
        // Show the placeholder if the video fails to load
        videoPlaceholder.style.display = 'block';
    });
    
    // Log when video starts playing
    video.addEventListener('playing', () => {
        console.log('Video is now playing');
    });
}

// Load real community data from the API
async function loadRealCommunityData() {
    try {
        // Show loading indicators
        document.getElementById('profile-grid').classList.add('loading');
        
        // The URL of your API
        const apiUrl = getApiUrl();
        
        // Fetch data from the API
        const response = await fetch(`${apiUrl}/api/community-data`);
        
        if (!response.ok) {
            throw new Error(`API responded with status: ${response.status}`);
        }
        
        const data = await response.json();
        
        // Update UI with the real data
        updateProfileGrid(data.profiles);
        updateStats(data.stats);
        
        // Hide loading indicators
        document.getElementById('profile-grid').classList.remove('loading');
        
    } catch (error) {
        console.error('Failed to load community data:', error);
        
        // Hide loading indicators
        document.getElementById('profile-grid').classList.remove('loading');
        
        // Fall back to basic profile grid if API fails
        generateBasicProfileGrid();
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

// Update the profile grid with real profiles
function updateProfileGrid(profiles) {
    const profileGrid = document.getElementById('profile-grid');
    profileGrid.innerHTML = ''; // Clear existing profiles
    
    // Use the real profiles from API
    if (profiles && profiles.length > 0) {
        // Sort profiles by follower count if available
        const sortedProfiles = [...profiles].sort((a, b) => {
            // If follower count is available, use it
            if (a.followers_count && b.followers_count) {
                return b.followers_count - a.followers_count;
            }
            // Otherwise, no specific order
            return 0;
        });
        
        // Limit to 50 profiles (5 rows of 10)
        const displayLimit = 50;
        const displayProfiles = sortedProfiles.slice(0, displayLimit);
        
        // Display all available profiles
        displayProfiles.forEach(profile => {
            const profileImg = document.createElement('div');
            profileImg.className = 'profile-img';
            
            // Handle image loading issues - BLOCK ALL IMGUR IMAGES
            const imgUrl = profile.picture || '';
            
            // Skip Imgur images entirely
            if (imgUrl && !imgUrl.includes('imgur.com')) {
                // Create a temporary image to test if the URL is valid
                const testImg = new Image();
                testImg.onload = function() {
                    profileImg.style.backgroundImage = `url('${imgUrl}')`;
                };
                testImg.onerror = function() {
                    profileImg.classList.add('no-image');
                };
                // Start loading the image
                testImg.src = imgUrl;
                
                // Set initial state
                profileImg.style.backgroundImage = 'none';
            } else {
                // Use default empty state
                profileImg.classList.add('no-image');
            }
            
            // Add name and username as title
            profileImg.setAttribute('title', `${profile.name || ''} (@${profile.username || ''})`);
            
            // Add a link to their X profile if username is available
            if (profile.username) {
                profileImg.addEventListener('click', () => {
                    window.open(`https://x.com/${profile.username}`, '_blank');
                });
                profileImg.style.cursor = 'pointer';
            }
            
            profileGrid.appendChild(profileImg);
        });
        
        // Add the "and more" indicator after the 5th row
        const andMoreProfile = document.createElement('div');
        andMoreProfile.className = 'profile-img and-more';
        andMoreProfile.setAttribute('title', 'Join to see all community members!');
        andMoreProfile.innerHTML = '<span>AND<br>MORE</span>';
        andMoreProfile.addEventListener('click', () => {
            window.open('https://x.com/i/communities/1922392299163595186', '_blank');
        });
        andMoreProfile.style.cursor = 'pointer';
        profileGrid.appendChild(andMoreProfile);
    } else {
        // Show empty state message
        const emptyMessage = document.createElement('div');
        emptyMessage.className = 'empty-state-message';
        emptyMessage.textContent = 'No community profiles available. Please set up Twitter API credentials.';
        profileGrid.appendChild(emptyMessage);
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
}

// Fallback to basic profile grid if API fails
function generateBasicProfileGrid() {
    const profileGrid = document.getElementById('profile-grid');
    profileGrid.innerHTML = ''; // Clear any existing profiles
    
    // Show empty state message
    const emptyMessage = document.createElement('div');
    emptyMessage.className = 'empty-state-message';
    emptyMessage.textContent = 'No community profiles available. Please set up Twitter API credentials.';
    profileGrid.appendChild(emptyMessage);
}

// Format numbers with commas for thousands
function formatNumber(num) {
    return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

// Copy coin ID to clipboard
function setupCopyButton() {
    const copyBtn = document.querySelector('.copy-btn');
    if (!copyBtn) return;
    
    const coinId = document.querySelector('.coin-id');
    if (!coinId) return;
    
    const coinIdText = coinId.textContent;
    
    copyBtn.addEventListener('click', () => {
        navigator.clipboard.writeText(coinIdText)
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