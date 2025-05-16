# Conservative X Community Website

A website showcasing members of a Conservative community on X (formerly Twitter).

## Features

- Displays community members sorted by follower count
- Shows community statistics
- Responsive design
- Auto-playing promotional video

## Setup

1. Clone this repository
2. Install dependencies:
   ```
   npm install
   ```
3. Create a `.env` file based on `.env.example`:
   ```
   TWITTER_BEARER_TOKEN=your_bearer_token_here
   PORT=3000
   ```
4. Obtain a Twitter bearer token from the [Twitter Developer Portal](https://developer.twitter.com)
5. Start the server:
   ```
   npm start
   ```

## Twitter API Requirements

This application requires Twitter API v2 access to fetch community data. Without API credentials, the application will show an empty state.

To set up API credentials:
1. Apply for a developer account at [developer.twitter.com](https://developer.twitter.com)
2. Create a new project and app
3. Generate a bearer token
4. Add the bearer token to your `.env` file

## Deployment

This application can be deployed to platforms like Render or Heroku.

### Environment Variables

- `TWITTER_BEARER_TOKEN`: Your Twitter API bearer token
- `PORT`: The port to run the server on (optional, defaults to 3000)

## License

This project is for a specific Conservative community on X.
