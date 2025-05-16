# Conservative X Community Website

A website showcasing members of a Conservative community on X (formerly Twitter).

## Features

- Displays community members sorted by follower count
- Shows community statistics
- Responsive design
- Auto-playing promotional video

## API Options

This application supports two ways to fetch community data:

### 1. Official Twitter API v2 (Limited Access)

- Requires Twitter API v2 access
- Limited capabilities for fetching community members
- More stable but restricted access

### 2. Twitter Private GraphQL API (Full Access)

- Uses Twitter's internal GraphQL APIs
- Can fetch all community members
- Requires browser authentication tokens

## Setup

1. Clone this repository
2. Install dependencies:
   ```
   npm install
   ```
3. Choose your API approach and set up the corresponding environment variables

### Option 1: Using Official Twitter API

1. Create a `.env` file with your Twitter API bearer token:
   ```
   TWITTER_BEARER_TOKEN=your_bearer_token_here
   PORT=3000
   ```
2. Obtain a Twitter bearer token from the [Twitter Developer Portal](https://developer.twitter.com)

### Option 2: Using Twitter Private GraphQL API (Recommended)

To access Twitter's private GraphQL APIs, you'll need to extract authentication tokens from your browser:

1. Open DevTools in your browser (F12 or right-click > Inspect)
2. Go to the Network tab
3. Visit a Twitter community page: `https://twitter.com/i/communities/1922392299163595186`
4. Look for XHR/fetch requests to GraphQL endpoints
5. Find the authentication headers:
   - In the Request Headers, find `cookie` and extract the `auth_token` value
   - Also from cookies, extract the `ct0` value (CSRF token)
   - Optionally, look for `x-guest-token` in headers

6. Create a `.env` file with these values:
   ```
   TWITTER_AUTH_TOKEN=your_auth_token_from_cookie
   TWITTER_CSRF_TOKEN=your_ct0_value_from_cookie
   TWITTER_GUEST_TOKEN=your_guest_token_if_available
   PORT=3000
   ```

**Warning:** Using private APIs is against Twitter's Terms of Service. Use responsibly and at your own risk.

## Starting the Server

Start the server with:
```
npm start
```

## Deployment

This application can be deployed to platforms like Render or Heroku.

### Environment Variables

Set the appropriate environment variables based on your chosen API approach:

#### For Official API:
- `TWITTER_BEARER_TOKEN`: Your Twitter API bearer token

#### For Private GraphQL API:
- `TWITTER_AUTH_TOKEN`: Auth token from your browser cookies
- `TWITTER_CSRF_TOKEN`: CSRF token from your browser cookies
- `TWITTER_GUEST_TOKEN`: Guest token from your browser headers (optional)

- `PORT`: The port to run the server on (optional, defaults to 3000)

## License

This project is for a specific Conservative community on X.
