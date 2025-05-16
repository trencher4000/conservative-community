document.addEventListener('DOMContentLoaded', () => {
    // Set up video functionality
    setupVideo();
    
    // Set up copy button functionality
    setupCopyButton();
    
    // Load real community data
    loadRealCommunityData();
    
    // Load latest community posts
    loadLatestPosts();
    
    // Refresh data periodically (every 5 minutes)
    setInterval(loadRealCommunityData, 5 * 60 * 1000);
    setInterval(loadLatestPosts, 5 * 60 * 1000);
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
        
        // Limit to 49 profiles to make room for the "And More" button as #50
        const displayLimit = 49;
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
        
        // Add the "and more" indicator as the 50th profile
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

// Load latest posts from the community API
async function loadLatestPosts() {
    const postsContainer = document.getElementById('posts-container');
    if (!postsContainer) return;
    
    try {
        // Clear any error states
        postsContainer.innerHTML = '<div class="loading-message">Loading latest posts...</div>';
        
        // Get API URL
        const apiUrl = getApiUrl();
        
        // Try to fetch latest posts data
        try {
            const response = await fetch(`${apiUrl}/api/community-posts`);
            
            if (response.ok) {
                const data = await response.json();
                
                // If we have posts data, display them
                if (data && data.posts && data.posts.length > 0) {
                    displayPosts(data.posts);
                    return;
                }
            }
        } catch (err) {
            console.log('Could not fetch posts from API, using fallback data');
        }
        
        // If API fails or returns no posts, use sample data as fallback
        const samplePosts = [
            {
                id: '1',
                text: 'What will be the catalyst for $Cnsrv to soar?',
                created_at: new Date().toISOString(),
                author: {
                    name: 'BreezySwingEasy',
                    username: 'BreezySwingEasy',
                    profile_image_url: 'https://pbs.twimg.com/profile_images/1642193374073716737/ALg37upL_400x400.jpg'
                }
            },
            {
                id: '2',
                text: 'How much faith do you have in 3 letter agencies?',
                created_at: new Date(Date.now() - 86400000).toISOString(), // 1 day ago
                author: {
                    name: 'Kevin Sorbo',
                    username: 'ksorbs',
                    profile_image_url: 'https://pbs.twimg.com/profile_images/1719815676601815040/BrO-EAQT_400x400.jpg'
                }
            },
            {
                id: '3',
                text: 'Krassencuck over here isn\'t used to accountability, hopefully the 5 years in prison and 250,000 dollar fine gives him time to think about his actions',
                created_at: new Date(Date.now() - 172800000).toISOString(), // 2 days ago
                author: {
                    name: 'BlitzProd',
                    username: 'BlitzBrigadeNFL',
                    profile_image_url: 'https://pbs.twimg.com/profile_images/1527344684807376896/6M-eU3yI_400x400.jpg'
                }
            }
        ];
        
        displayPosts(samplePosts);
        
    } catch (error) {
        console.error('Failed to load community posts:', error);
        
        // Show fallback/error state
        postsContainer.innerHTML = `
            <div class="no-posts-message">
                <p>Could not load latest posts.</p>
                <p>Visit <a href="https://x.com/i/communities/1922392299163595186" target="_blank">our X community</a> to see all posts.</p>
            </div>
        `;
    }
}

// Display the posts in the posts container
function displayPosts(posts) {
    const postsContainer = document.getElementById('posts-container');
    
    // Clear the container
    postsContainer.innerHTML = '';
    
    if (!posts || posts.length === 0) {
        postsContainer.innerHTML = `
            <div class="no-posts-message">
                <p>No recent posts found.</p>
                <p>Visit <a href="https://x.com/i/communities/1922392299163595186" target="_blank">our X community</a> to see all posts.</p>
            </div>
        `;
        return;
    }
    
    // Limit to 3 most recent posts 
    const displayPosts = posts.slice(0, 3);
    
    // Create HTML for each post
    displayPosts.forEach(post => {
        const postCard = document.createElement('div');
        postCard.className = 'post-card';
        
        // Format the post date
        const postDate = new Date(post.created_at);
        const formattedDate = postDate.toLocaleDateString('en-US', {
            year: 'numeric', 
            month: 'short', 
            day: 'numeric'
        });
        
        // Build the post HTML
        let postHTML = `
            <div class="post-header">
                <div class="post-avatar" 
                     style="background-image: url('${post.author.profile_image_url || ''}')"></div>
                <div class="post-author">
                    <div class="post-name">${post.author.name || 'Community Member'}</div>
                    <div class="post-username">@${post.author.username || ''}</div>
                </div>
            </div>
            <div class="post-content">${post.text || ''}</div>
            <div class="post-date">${formattedDate}</div>
        `;
        
        // Add media if available
        if (post.media && post.media.length > 0) {
            const mediaUrl = post.media[0];
            postHTML += `
                <div class="post-media">
                    <img src="${mediaUrl}" alt="Post media" loading="lazy">
                </div>
            `;
        }
        
        // Set the HTML and add to container
        postCard.innerHTML = postHTML;
        
        // Make the post clickable to view on X
        if (post.id) {
            postCard.addEventListener('click', () => {
                window.open(`https://x.com/${post.author.username}/status/${post.id}`, '_blank');
            });
            postCard.style.cursor = 'pointer';
        }
        
        postsContainer.appendChild(postCard);
    });
} 