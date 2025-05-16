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
        
        // Add a cache-busting parameter to avoid browser cache
        const cacheBuster = `?_t=${new Date().getTime()}`;
        
        console.log(`Fetching community data from: ${apiUrl}`);
        
        // Fetch data from the API with cache busting
        const response = await fetch(`${apiUrl}/api/community-data${cacheBuster}`);
        
        if (!response.ok) {
            throw new Error(`API responded with status: ${response.status}`);
        }
        
        const data = await response.json();
        console.log('Received community data:', data);
        
        // Preload all images before updating UI
        if (data.profiles && data.profiles.length > 0) {
            await preloadImages(data.profiles);
        }
        
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

// Preload images to ensure they're in browser cache
async function preloadImages(profiles) {
    // Create an array of image loading promises
    const imagePromises = profiles.map(profile => {
        return new Promise((resolve) => {
            if (profile.picture) {
                const img = new Image();
                
                // Always resolve (even on error) so we don't block rendering
                img.onload = () => resolve(true);
                img.onerror = () => {
                    // Try fallback if available
                    if (profile.fallbackPicture) {
                        const fallbackImg = new Image();
                        fallbackImg.onload = () => resolve(true);
                        fallbackImg.onerror = () => resolve(false);
                        fallbackImg.src = profile.fallbackPicture;
                    } else {
                        resolve(false);
                    }
                };
                
                img.src = profile.picture;
            } else {
                resolve(false);
            }
        });
    });
    
    // Wait for all images to finish loading (or failing)
    await Promise.all(imagePromises);
    console.log('Preloaded all profile images');
}

// Get the API URL based on the environment
function getApiUrl() {
    // For local development 
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
        return 'http://localhost:3000';
    }
    
    // REPLACE_WITH_RENDER_URL - DO NOT MODIFY THIS COMMENT
    // When deployed to Render, replace this line with your actual Render URL
    return 'https://conservativeog.onrender.com';
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
        console.log(`Displaying community member profiles`);
        
        // For display, keep the first 13 priority accounts in their original order
        // The accounts in server.js are already in the priority order
        const priorityProfiles = profiles.slice(0, 13);
        
        // Sort remaining profiles by follower count (highest first)
        const remainingProfiles = profiles.slice(13).sort((a, b) => 
            (b.followers_count || 0) - (a.followers_count || 0)
        );
        
        // Combine them back: priority accounts first, then sorted by follower count
        const displayProfiles = [...priorityProfiles, ...remainingProfiles].slice(0, 50);
        
        // Create profile elements for each member
        displayProfiles.forEach((profile, index) => {
            const profileImg = document.createElement('div');
            profileImg.className = 'profile-img';
            
            // Use the profile picture or a default if missing
            if (profile.picture) {
                console.log(`Loading image for ${profile.username}: ${profile.picture}`);
                
                // Create an actual image element to test loading
                const testImg = new Image();
                testImg.onload = function() {
                    console.log(`Successfully loaded image for ${profile.username}`);
                    profileImg.style.backgroundImage = `url('${profile.picture}')`;
                };
                testImg.onerror = function() {
                    console.error(`Failed to load image for ${profile.username}: ${profile.picture}`);
                    // Try fallback image if available
                    if (profile.fallbackPicture) {
                        console.log(`Trying fallback image for ${profile.username}: ${profile.fallbackPicture}`);
                        const fallbackImg = new Image();
                        fallbackImg.onload = function() {
                            console.log(`Successfully loaded fallback image for ${profile.username}`);
                            profileImg.style.backgroundImage = `url('${profile.fallbackPicture}')`;
                        };
                        fallbackImg.onerror = function() {
                            console.error(`Failed to load fallback image for ${profile.username}`);
                            profileImg.classList.add('no-image');
                        };
                        fallbackImg.src = profile.fallbackPicture;
                    } else {
                        profileImg.classList.add('no-image');
                    }
                };
                testImg.src = profile.picture;
                
                // Initially set to the main image (will be replaced if it fails)
                profileImg.style.backgroundImage = `url('${profile.picture}')`;
            } else {
                console.warn(`No image URL for ${profile.username}`);
                profileImg.classList.add('no-image');
            }
            
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
        andMoreProfile.innerHTML = '<span>AND<br>MORE</span>';
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