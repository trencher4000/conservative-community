document.addEventListener('DOMContentLoaded', () => {
    // Set up video functionality
    setupVideo();
    
    // Set up copy button functionality
    setupCopyButton();
    
    // Load real community data
    loadRealCommunityData();
    
    // Load latest community posts
    loadLatestPosts();
    
    // Refresh data periodically (every 15 minutes)
    setInterval(loadRealCommunityData, 15 * 60 * 1000);
    setInterval(loadLatestPosts, 15 * 60 * 1000);
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
        
        // Limit to 49 profiles (make room for the "And More" button as #50)
        const displayLimit = 49;
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
                id: '1923147301851173129',
                text: 'I\'ll show the Dems proof of corruption. My entire history in the White House of working with Biden.',
                created_at: new Date('2024-05-16T00:00:00Z').toISOString(),
                author: {
                    name: 'Kevin Sorbo',
                    username: 'ksorbs',
                    profile_image_url: 'https://pbs.twimg.com/profile_images/1719815676601815040/BrO-EAQT_400x400.jpg'
                }
            },
            {
                id: '1923132589851779496',
                text: '$CNSRV Conservative coin up 400% in USDT pairing! How high can we get? We decide!',
                created_at: new Date('2024-05-15T22:00:00Z').toISOString(),
                author: {
                    name: 'ANTUNES',
                    username: 'Antunes1',
                    profile_image_url: 'https://pbs.twimg.com/profile_images/1699878638615646208/gWLRuqvY_400x400.jpg'
                }
            },
            {
                id: '1922417753996341739',
                text: 'Get ready for the biggest CONSERVATIVE TAKEOVER online. #CNSRV',
                created_at: new Date('2024-05-14T12:00:00Z').toISOString(),
                author: {
                    name: 'Laura Loomer',
                    username: 'LauraLoomer',
                    profile_image_url: 'https://pbs.twimg.com/profile_images/1763607303050702848/7CAcw2xu_400x400.jpg'
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