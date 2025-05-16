document.addEventListener('DOMContentLoaded', () => {
    // Set up video functionality
    setupVideo();
    
    // Set up copy button functionality
    setupCopyButton();
    
    // Display the profiles directly (no API)
    displayProfiles();
    
    // Update members count
    updateMembersCount(903);
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

// Update patriots/members count
function updateMembersCount(count) {
    const patriotsCountEl = document.getElementById('patriots-count');
    patriotsCountEl.textContent = count;
    
    // Also update the join button text
    const joinButtons = document.querySelectorAll('.join-btn');
    joinButtons.forEach(btn => {
        btn.textContent = `Join ${count}+ Patriots`;
    });
}

// Display profile grid with hardcoded profiles
function displayProfiles() {
    const profileGrid = document.getElementById('profile-grid');
    profileGrid.innerHTML = ''; // Clear any existing profiles
    
    // Define our profiles directly here
    const profiles = [
        // Priority accounts
        {
            name: "Kevin Sorbo",
            username: "ksorbs",
            picture: "https://pbs.twimg.com/profile_images/1726403773184184320/LKD3yWIk_400x400.jpg",
            fallbackPicture: "https://i.imgur.com/bLlq6CJ.jpg"
        },
        {
            name: "9mmSMG",
            username: "9mm_smg",
            picture: "https://pbs.twimg.com/profile_images/1703048566199132160/Z44q4r__400x400.jpg",
            fallbackPicture: "https://i.imgur.com/q7vFAVm.png"
        },
        {
            name: "Robert F. Kennedy Jr.",
            username: "RobertKennedyJc",
            picture: "https://pbs.twimg.com/profile_images/1698025296398221312/i9uY4RuU_400x400.jpg",
            fallbackPicture: "https://i.imgur.com/JnhnxJJ.png"
        },
        {
            name: "Laura Loomer",
            username: "LauraLoomer",
            picture: "https://pbs.twimg.com/profile_images/1763607303050702848/7CAcw2xu_400x400.jpg",
            fallbackPicture: "https://i.imgur.com/h5QR58N.png"
        },
        {
            name: "Ali",
            username: "alifarhat79",
            picture: "https://pbs.twimg.com/profile_images/1624136303553536000/azdvv7RM_400x400.jpg",
            fallbackPicture: "https://i.imgur.com/fXDP1pA.png"
        },
        {
            name: "Liberty Cappy",
            username: "LibertyCappy",
            picture: "https://pbs.twimg.com/profile_images/1733590329378877726/0T_-Oy9e_400x400.jpg",
            fallbackPicture: "https://i.imgur.com/VEwEpKY.png"
        },
        {
            name: "MAGA Posts",
            username: "MAGAPosts",
            picture: "https://pbs.twimg.com/profile_images/1684599204132548609/onFjF9C7_400x400.jpg",
            fallbackPicture: "https://i.imgur.com/q7vFAVm.png"
        },
        {
            name: "AKA Face",
            username: "akafaceUS",
            picture: "https://pbs.twimg.com/profile_images/1718315538728312832/1TkPwImo_400x400.jpg",
            fallbackPicture: "https://i.imgur.com/JnhnxJJ.png"
        },
        {
            name: "Antunes",
            username: "Antunes1",
            picture: "https://pbs.twimg.com/profile_images/1689666522700627971/yf4DrRnc_400x400.jpg",
            fallbackPicture: "https://i.imgur.com/h5QR58N.png"
        },
        {
            name: "Unlimited",
            username: "unlimited_ls",
            picture: "https://pbs.twimg.com/profile_images/1619731905317724162/sRJQEJrK_400x400.jpg",
            fallbackPicture: "https://i.imgur.com/fXDP1pA.png"
        },
        {
            name: "ALX",
            username: "ALX",
            picture: "https://pbs.twimg.com/profile_images/1713949293223104512/E9lbMAG-_400x400.jpg",
            fallbackPicture: "https://i.imgur.com/VEwEpKY.png"
        },
        {
            name: "LP",
            username: "lporiginalg",
            picture: "https://pbs.twimg.com/profile_images/1588232170262278144/kPAFp1Mb_400x400.jpg",
            fallbackPicture: "https://i.imgur.com/q7vFAVm.png"
        },
        {
            name: "Liberacrat",
            username: "Liberacrat",
            picture: "https://pbs.twimg.com/profile_images/1683575246796333058/SHyYZGmR_400x400.jpg",
            fallbackPicture: "https://i.imgur.com/JnhnxJJ.png"
        },
        
        // Additional profiles
        {
            name: "Preston Alfonso Parra",
            username: "ThePrestonParra",
            picture: "https://pbs.twimg.com/profile_images/1767310033969258496/YuJoEH6__400x400.jpg",
            fallbackPicture: "https://i.imgur.com/h5QR58N.png"
        },
        {
            name: "Cj 🌕🐷",
            username: "degencj",
            picture: "https://pbs.twimg.com/profile_images/1752116219140857856/1XZw-W4f_400x400.jpg",
            fallbackPicture: "https://i.imgur.com/fXDP1pA.png"
        },
        {
            name: "Shield",
            username: "Baban08719633",
            picture: "https://pbs.twimg.com/profile_images/1751283473724203008/TgB-uU5q_400x400.jpg",
            fallbackPicture: "https://i.imgur.com/VEwEpKY.png"
        },
        {
            name: "BOREALIS",
            username: "B0REALISMAX",
            picture: "https://pbs.twimg.com/profile_images/1727759183320121344/wdJj8d1H_400x400.jpg",
            fallbackPicture: "https://i.imgur.com/q7vFAVm.png"
        },
        {
            name: "Princess",
            username: "DotCatSui",
            picture: "https://pbs.twimg.com/profile_images/1751334621551517696/PcmQtQWq_400x400.jpg",
            fallbackPicture: "https://i.imgur.com/JnhnxJJ.png"
        },
        {
            name: "0x404777",
            username: "0x404777",
            picture: "https://pbs.twimg.com/profile_images/1689666522700627971/yf4DrRnc_400x400.jpg",
            fallbackPicture: "https://i.imgur.com/h5QR58N.png"
        },
        {
            name: "Johnny Man",
            username: "Man996006Man",
            picture: "https://pbs.twimg.com/profile_images/1704552443877257216/dRIkLM0E_400x400.jpg",
            fallbackPicture: "https://i.imgur.com/fXDP1pA.png"
        },
        {
            name: "GMCL",
            username: "AbraTrade1",
            picture: "https://pbs.twimg.com/profile_images/1658929915366998018/5QgD7tDy_400x400.jpg",
            fallbackPicture: "https://i.imgur.com/VEwEpKY.png"
        },
        {
            name: "Cem",
            username: "Cmz2703",
            picture: "https://pbs.twimg.com/profile_images/1676323523775229953/cDLYWTxJ_400x400.jpg",
            fallbackPicture: "https://i.imgur.com/q7vFAVm.png"
        },
        {
            name: "King Hoz",
            username: "KingHozCalls",
            picture: "https://pbs.twimg.com/profile_images/1606364047221739523/hxS7-H8r_400x400.jpg",
            fallbackPicture: "https://i.imgur.com/JnhnxJJ.png"
        },
        {
            name: "sixcart",
            username: "sixcart",
            picture: "https://pbs.twimg.com/profile_images/1654234398160982016/h9fJ_7Ry_400x400.jpg",
            fallbackPicture: "https://i.imgur.com/h5QR58N.png"
        },
        {
            name: "Biony",
            username: "dtreeoy",
            picture: "https://pbs.twimg.com/profile_images/1733549004635267072/0Nx-0JbH_400x400.jpg",
            fallbackPicture: "https://i.imgur.com/fXDP1pA.png"
        },
        {
            name: "Febitir",
            username: "febitir",
            picture: "https://pbs.twimg.com/profile_images/1702776361015648256/j6PyxbeX_400x400.jpg",
            fallbackPicture: "https://i.imgur.com/VEwEpKY.png"
        },
        {
            name: "Sherlock Holmes",
            username: "HolmesNFTs",
            picture: "https://pbs.twimg.com/profile_images/1738333088599375872/rKL1amSB_400x400.jpg",
            fallbackPicture: "https://i.imgur.com/q7vFAVm.png"
        },
        {
            name: "yo",
            username: "cryptaloo",
            picture: "https://pbs.twimg.com/profile_images/1674116512273965056/MoH2QAVe_400x400.jpg",
            fallbackPicture: "https://i.imgur.com/JnhnxJJ.png"
        },
        {
            name: "NightWriter",
            username: "16Cnazty86312",
            picture: "https://pbs.twimg.com/profile_images/1704552443877257216/dRIkLM0E_400x400.jpg",
            fallbackPicture: "https://i.imgur.com/h5QR58N.png"
        },
        {
            name: "Turnip",
            username: "FrancesJim91666",
            picture: "https://pbs.twimg.com/profile_images/1658929915366998018/5QgD7tDy_400x400.jpg",
            fallbackPicture: "https://i.imgur.com/fXDP1pA.png"
        },
        {
            name: "RVasilis",
            username: "RVasillis",
            picture: "https://pbs.twimg.com/profile_images/1676323523775229953/cDLYWTxJ_400x400.jpg",
            fallbackPicture: "https://i.imgur.com/VEwEpKY.png"
        },
        {
            name: "Crypto Memes",
            username: "cryptomemes100k",
            picture: "https://pbs.twimg.com/profile_images/1606364047221739523/hxS7-H8r_400x400.jpg",
            fallbackPicture: "https://i.imgur.com/q7vFAVm.png"
        },
        {
            name: "Don",
            username: "doncaarbon",
            picture: "https://pbs.twimg.com/profile_images/1654234398160982016/h9fJ_7Ry_400x400.jpg",
            fallbackPicture: "https://i.imgur.com/JnhnxJJ.png"
        },
        {
            name: "0xBrook",
            username: "0xBrook7",
            picture: "https://pbs.twimg.com/profile_images/1716158536659853312/gPFwtXh8_400x400.jpg",
            fallbackPicture: "https://i.imgur.com/h5QR58N.png"
        },
        {
            name: "Gabriel Andrade",
            username: "Gabriel68187029",
            picture: "https://pbs.twimg.com/profile_images/1702776361015648256/j6PyxbeX_400x400.jpg",
            fallbackPicture: "https://i.imgur.com/fXDP1pA.png"
        },
        {
            name: "𝕽𝖆𝖆𝖍1𝖒",
            username: "raah1million",
            picture: "https://pbs.twimg.com/profile_images/1738333088599375872/rKL1amSB_400x400.jpg",
            fallbackPicture: "https://i.imgur.com/VEwEpKY.png"
        },
        {
            name: "Up 📈",
            username: "Up69pump",
            picture: "https://pbs.twimg.com/profile_images/1674116512273965056/MoH2QAVe_400x400.jpg",
            fallbackPicture: "https://i.imgur.com/q7vFAVm.png"
        },
        {
            name: "Rugnar",
            username: "gamabutokichiri",
            picture: "https://pbs.twimg.com/profile_images/1704552443877257216/dRIkLM0E_400x400.jpg",
            fallbackPicture: "https://i.imgur.com/JnhnxJJ.png"
        },
        {
            name: "trippincuz",
            username: "bhahn977905",
            picture: "https://pbs.twimg.com/profile_images/1658929915366998018/5QgD7tDy_400x400.jpg",
            fallbackPicture: "https://i.imgur.com/h5QR58N.png"
        },
        {
            name: "alex",
            username: "alexx4ndre",
            picture: "https://pbs.twimg.com/profile_images/1676323523775229953/cDLYWTxJ_400x400.jpg",
            fallbackPicture: "https://i.imgur.com/fXDP1pA.png"
        },
        {
            name: "S.O.L.O.M.O.N",
            username: "AnyalorAriwa",
            picture: "https://pbs.twimg.com/profile_images/1606364047221739523/hxS7-H8r_400x400.jpg",
            fallbackPicture: "https://i.imgur.com/VEwEpKY.png"
        },
        {
            name: "Udin Kecil002",
            username: "UKecil00282770",
            picture: "https://pbs.twimg.com/profile_images/1654234398160982016/h9fJ_7Ry_400x400.jpg",
            fallbackPicture: "https://i.imgur.com/q7vFAVm.png"
        },
        {
            name: "Art",
            username: "ArtCryptoz",
            picture: "https://pbs.twimg.com/profile_images/1707797390380593152/RQmfJWb2_400x400.jpg",
            fallbackPicture: "https://i.imgur.com/JnhnxJJ.png"
        },
        {
            name: "captain",
            username: "ccaptinn",
            picture: "https://pbs.twimg.com/profile_images/1702776361015648256/j6PyxbeX_400x400.jpg",
            fallbackPicture: "https://i.imgur.com/h5QR58N.png"
        },
        {
            name: "Polky",
            username: "BobaTea82958967",
            picture: "https://pbs.twimg.com/profile_images/1738333088599375872/rKL1amSB_400x400.jpg",
            fallbackPicture: "https://i.imgur.com/fXDP1pA.png"
        },
        {
            name: "Robinson",
            username: "AntanVu4867",
            picture: "https://pbs.twimg.com/profile_images/1674116512273965056/MoH2QAVe_400x400.jpg",
            fallbackPicture: "https://i.imgur.com/VEwEpKY.png"
        },
        {
            name: "i have a lot of motion",
            username: "mquangt_",
            picture: "https://pbs.twimg.com/profile_images/1704552443877257216/dRIkLM0E_400x400.jpg",
            fallbackPicture: "https://i.imgur.com/q7vFAVm.png"
        }
    ];
    
    // Limit to a maximum of 50 accounts (5 rows of 10)
    const displayProfiles = profiles.slice(0, 50);
    
    // Create profile elements
    displayProfiles.forEach(profile => {
        const profileDiv = document.createElement('div');
        profileDiv.className = 'profile-img';
        
        // Set title for tooltip on hover
        profileDiv.setAttribute('title', `${profile.name} (@${profile.username})`);
        
        // Try to preload the image to check if it's valid
        const img = new Image();
        
        img.onload = function() {
            // If image loads successfully, use it
            profileDiv.style.backgroundImage = `url('${profile.picture}')`;
        };
        
        img.onerror = function() {
            // If main image fails, try the fallback
            if (profile.fallbackPicture) {
                profileDiv.style.backgroundImage = `url('${profile.fallbackPicture}')`;
            } else {
                // If no fallback, add a class for styling
                profileDiv.classList.add('no-image');
            }
        };
        
        // Start loading the image
        img.src = profile.picture;
        
        // Initially set the background to the main image
        // (it will be replaced if loading fails)
        profileDiv.style.backgroundImage = `url('${profile.picture}')`;
        
        // Make clickable to X/Twitter profile
        profileDiv.addEventListener('click', () => {
            window.open(`https://x.com/${profile.username}`, '_blank');
        });
        profileDiv.style.cursor = 'pointer';
        
        // Add to grid
        profileGrid.appendChild(profileDiv);
    });
    
    // Add "AND MORE" bubble at the end
    const andMoreDiv = document.createElement('div');
    andMoreDiv.className = 'profile-img and-more';
    andMoreDiv.innerHTML = '<span>AND<br>MORE</span>';
    andMoreDiv.setAttribute('title', 'Join to see all community members!');
    andMoreDiv.addEventListener('click', () => {
        window.open('https://x.com/i/communities/1922392299163595186', '_blank');
    });
    andMoreDiv.style.cursor = 'pointer';
    
    profileGrid.appendChild(andMoreDiv);
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