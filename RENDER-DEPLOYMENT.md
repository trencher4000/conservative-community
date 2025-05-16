# Render Deployment Guide

This guide will walk you through deploying the X community scraper on Render.com.

## Step 1: Sign Up for Render

1. Go to [Render.com](https://render.com/) and sign up for an account
2. Verify your email address and complete the signup process

## Step 2: Create a New Web Service

1. In your Render dashboard, click the "New +" button
2. Select "Web Service" from the dropdown menu

## Step 3: Deploy Your Code

You have two options:

### Option A: Deploy from GitHub (recommended)

1. Create a GitHub repository and upload your backend code (server.js, package.json)
2. In Render, select "Build and deploy from a Git repository"
3. Connect your GitHub account
4. Select the repository containing your code

### Option B: Deploy without Git

If you don't want to use Git:

1. In Render, select "Deploy from an existing image or upload your code"
2. Choose "Upload your code"
3. Create a ZIP file containing your backend code (server.js, package.json)
4. Upload the ZIP file (conservative-website-backend.zip) to Render

## Step 4: Configure Your Web Service

Fill in the following details:

- **Name**: conservative-community-scraper (or any name you prefer)
- **Region**: Choose a region closest to your target audience
- **Runtime**: Node
- **Build Command**: `npm install`
- **Start Command**: `node server.js`

## Step 5: Advanced Options (Important!)

Click on "Advanced" and add these configurations:

1. Under "Environment Variables", add:
   - No specific environment variables needed for this project

2. Under "Instance Type", select:
   - "Free" tier for testing (has limitations but works for basic use)
   - "Starter" or higher for production use (recommended for reliability)

3. Important note for Puppeteer:
   - In the start command section, change to: `node --unhandled-rejections=strict server.js`
   - This helps with Puppeteer stability on Render

## Step 6: Deploy

1. Click "Create Web Service"
2. Wait for the build and deployment to complete (this might take a few minutes)

## Step 7: Note Your API URL

1. After deployment completes, Render will assign a URL to your service
   (e.g., `https://conservative-community-scraper.onrender.com`)
2. Note this URL, as you'll need it for the frontend

## Step 8: Update Your Frontend

1. Open your `script.js` file
2. Update the `getApiUrl()` function with your Render URL:

```javascript
function getApiUrl() {
    // For local development 
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
        return 'http://localhost:3000';
    }
    
    // For production - your Render URL
    return 'https://conservative-community-scraper.onrender.com';
}
```

3. Save and redeploy your frontend to GoDaddy

## Common Issues with Render and Puppeteer

1. **Free tier limitations**: 
   - The free tier on Render has limited resources and may restart frequently
   - Consider upgrading to a paid plan for production use

2. **Puppeteer timeouts**: 
   - If scraping fails, you may need to increase timeout values in server.js
   - Add `args: ['--disable-dev-shm-usage']` to the Puppeteer launch options

3. **X blocking the scraper**:
   - X may block automated scraping
   - Consider adding random delays between requests
   - Use a rotating proxy service if necessary

## Monitoring Your Service

1. In your Render dashboard, click on your web service
2. View logs under the "Logs" tab to troubleshoot any issues
3. Monitor resource usage to ensure you're within your plan limits 