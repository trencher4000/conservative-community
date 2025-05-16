document.addEventListener('DOMContentLoaded', () => {
    // Set up video functionality
    setupVideo();
    
    // Set up copy button functionality
    setupCopyButton();
    
    // Update static member count
    updateStaticMemberCount();
    
    // No need to load community data or posts - they're hardcoded now
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

// Update static member count
function updateStaticMemberCount() {
    const memberCount = 903; // Static member count
    
    // Update count display
    const patriotsCountEl = document.getElementById('patriots-count');
    if (patriotsCountEl) {
        patriotsCountEl.textContent = memberCount;
    }
    
    // Update button texts
    const joinButtons = document.querySelectorAll('.join-btn');
    joinButtons.forEach(btn => {
        btn.textContent = `Join ${memberCount}+ Patriots`;
    });
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