document.addEventListener('DOMContentLoaded', () => {
    // Set up video functionality
    setupVideo();
    
    // Set up copy button functionality
    setupCopyButton();
    
    // Set up refresh button
    setupRefreshButton();
    
    // Load real community data
    loadRealCommunityData();
    
    // Refresh data periodically (every 5 minutes)
    setInterval(loadRealCommunityData, 5 * 60 * 1000);
});

// Set up refresh button functionality
function setupRefreshButton() {
    // Create refresh button
    const refreshButton = document.createElement('button');
    refreshButton.className = 'refresh-btn';
    refreshButton.innerHTML = '🔄 Refresh Data';
    
    // Create data source indicator
    const dataSourceIndicator = document.createElement('div');
    dataSourceIndicator.id = 'data-source';
    dataSourceIndicator.className = 'data-source static';
    dataSourceIndicator.innerHTML = 'Using Static Data';
    
    // Create next update indicator
    const nextUpdateIndicator = document.createElement('div');
    nextUpdateIndicator.id = 'next-update';
    nextUpdateIndicator.className = 'next-update';
    nextUpdateIndicator.style.display = 'none';
    
    // Add all elements to the page
    const statsContainer = document.querySelector('.stats-container');
    statsContainer.insertAdjacentElement('afterend', refreshButton);
    statsContainer.insertAdjacentElement('afterend', dataSourceIndicator);
    statsContainer.insertAdjacentElement('afterend', nextUpdateIndicator);
    
    // Add click handler
    refreshButton.addEventListener('click', async () => {
        try {
            refreshButton.disabled = true;
            refreshButton.innerHTML = '⏳ Refreshing...';
            dataSourceIndicator.innerHTML = 'Refreshing Data...';
            
            const apiUrl = getApiUrl();
            const response = await fetch(`${apiUrl}/api/refresh-data`, {
                method: 'POST'
            });
            
            if (!response.ok) {
                throw new Error(`Failed to refresh: ${response.status}`);
            }
            
            const result = await response.json();
            console.log('Refresh result:', result);
            
            // Show success message
            refreshButton.innerHTML = result.success ? '✅ Refreshed!' : '⚠️ Rate Limited';
            
            // Update source indicator
            if (result.isStatic) {
                dataSourceIndicator.className = 'data-source static';
                dataSourceIndicator.innerHTML = 'Using Static Data';
            } else {
                dataSourceIndicator.className = 'data-source live';
                dataSourceIndicator.innerHTML = 'Using Live Data';
            }
            
            // Load the updated data
            await loadRealCommunityData();
            
            // Reset button after 2 seconds
            setTimeout(() => {
                refreshButton.disabled = false;
                refreshButton.innerHTML = '🔄 Refresh Data';
            }, 2000);
            
        } catch (error) {
            console.error('Error refreshing data:', error);
            refreshButton.innerHTML = '❌ Failed';
            
            // Reset button after 2 seconds
            setTimeout(() => {
                refreshButton.disabled = false;
                refreshButton.innerHTML = '🔄 Refresh Data';
            }, 2000);
        }
    });
}

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
        
        // Update data source indicator
        const dataSourceIndicator = document.getElementById('data-source');
        if (dataSourceIndicator) {
            if (data.isStatic) {
                dataSourceIndicator.className = 'data-source static';
                dataSourceIndicator.innerHTML = 'Using Static Data';
            } else {
                dataSourceIndicator.className = 'data-source live';
                dataSourceIndicator.innerHTML = 'Using Live Data';
            }
        }
        
        // Update next update indicator if available
        const nextUpdateIndicator = document.getElementById('next-update');
        if (nextUpdateIndicator && data.nextUpdateAvailable) {
            const nextUpdate = new Date(data.nextUpdateAvailable);
            const now = new Date();
            
            if (nextUpdate > now) {
                const timeDiff = nextUpdate - now;
                const minutes = Math.round(timeDiff / 1000 / 60);
                
                if (minutes > 0) {
                    nextUpdateIndicator.style.display = 'block';
                    nextUpdateIndicator.innerHTML = `Next update available in ~${minutes} minutes`;
                    
                    // Disable refresh button if there's a waiting period
                    const refreshButton = document.querySelector('.refresh-btn');
                    if (refreshButton) {
                        refreshButton.disabled = true;
                        
                        // Set a timer to re-enable the button
                        setTimeout(() => {
                            refreshButton.disabled = false;
                            nextUpdateIndicator.style.display = 'none';
                        }, timeDiff);
                    }
                } else {
                    nextUpdateIndicator.style.display = 'none';
                }
            } else {
                nextUpdateIndicator.style.display = 'none';
            }
        } else if (nextUpdateIndicator) {
            nextUpdateIndicator.style.display = 'none';
        }
        
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
        
        // Update data source indicator
        const dataSourceIndicator = document.getElementById('data-source');
        if (dataSourceIndicator) {
            dataSourceIndicator.className = 'data-source static';
            dataSourceIndicator.innerHTML = 'Using Static Data';
        }
        
        // Hide next update indicator
        const nextUpdateIndicator = document.getElementById('next-update');
        if (nextUpdateIndicator) {
            nextUpdateIndicator.style.display = 'none';
        }
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
    
    // Use the real profiles from API
    if (profiles && profiles.length > 0) {
        // Limit to a reasonable number of profiles for display
        const displayProfiles = profiles.slice(0, 20); 
        
        displayProfiles.forEach(profile => {
            const profileImg = document.createElement('div');
            profileImg.className = 'profile-img';
            
            // Handle image loading issues
            const imgUrl = profile.picture || `https://via.placeholder.com/400?text=${profile.username?.slice(0,1) || 'X'}`;
            profileImg.style.backgroundImage = `url('${imgUrl}')`;
            
            // Add name as title
            profileImg.setAttribute('title', profile.name || profile.username || 'Conservative Member');
            
            // Add a link to their X profile if username is available
            if (profile.username) {
                profileImg.addEventListener('click', () => {
                    window.open(`https://x.com/${profile.username}`, '_blank');
                });
                profileImg.style.cursor = 'pointer';
            }
            
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