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