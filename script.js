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
    
    // Use the community video URL - if this doesn't work, we'll revert to the placeholder
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
    
    // REPLACE_WITH_RENDER_URL - DO NOT MODIFY THIS COMMENT
    // When deployed to Render, replace this line with your actual Render URL
    return 'https://conservative-community-scraper.onrender.com';
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
        // Sort profiles by follower count (highest first)
        const sortedProfiles = [...profiles].sort((a, b) => 
            (b.followers_count || 0) - (a.followers_count || 0)
        );
        
        console.log(`Displaying ${sortedProfiles.length} verified community member profiles`);
        
        // Limit to 50 profiles (5 rows of 10)
        const displayLimit = 50;
        const displayProfiles = sortedProfiles.slice(0, displayLimit);
        
        // Create profile elements for each member
        displayProfiles.forEach((profile, index) => {
            const profileImg = document.createElement('div');
            profileImg.className = 'profile-img';
            
            // Force clear any default background image
            profileImg.style.backgroundImage = 'none';
            
            // Process the profile image
            loadProfileImage(profileImg, profile);
            
            // Add tooltip with name and username
            profileImg.setAttribute('title', `${profile.name} (@${profile.username})`);
            
            // Optional: make profiles clickable to their X profiles
            if (profile.username && profile.username !== 'more_patriots') {
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
        andMoreProfile.innerHTML = '<span>MORE</span>';
        andMoreProfile.addEventListener('click', () => {
            window.open('https://x.com/i/communities/1922392299163595186', '_blank');
        });
        andMoreProfile.style.cursor = 'pointer';
        profileGrid.appendChild(andMoreProfile);
    } else {
        // Fallback to basic grid if no profiles
        generateBasicProfileGrid();
    }
}

// Handle loading of profile images with proper error handling
function loadProfileImage(element, profile) {
    if (!profile || !profile.picture || profile.picture.includes('imgur.com')) {
        // Invalid image or imgur placeholder detected
        console.warn(`Invalid or placeholder image detected for ${profile?.username || 'unknown'}`);
        element.classList.add('no-image');
        return;
    }
    
    // Clean and validate the URL
    let imageUrl = profile.picture.trim();
    
    // Force HTTPS
    if (imageUrl.startsWith('http:')) {
        imageUrl = imageUrl.replace('http:', 'https:');
    }
    
    // Ensure maximum size for Twitter images
    if (imageUrl.includes('twimg.com') && imageUrl.includes('_normal.')) {
        imageUrl = imageUrl.replace('_normal', '_400x400');
    }
    
    console.log(`Loading image for ${profile.username}: ${imageUrl}`);
    
    // Pre-load the image to verify it works
    const img = new Image();
    
    img.onload = function() {
        // Image loaded successfully
        element.style.backgroundImage = `url(${imageUrl})`;
    };
    
    img.onerror = function() {
        // Image failed to load
        console.error(`Failed to load image for ${profile.username}: ${imageUrl}`);
        element.classList.add('no-image');
    };
    
    // Start loading
    img.src = imageUrl;
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

// Copy coin ID to clipboard
function setupCopyButton() {
    const copyBtn = document.querySelector('.copy-btn');
    const coinId = document.querySelector('.coin-id').textContent;
    
    copyBtn.addEventListener('click', () => {
        navigator.clipboard.writeText(coinId)
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