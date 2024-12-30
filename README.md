# URL Shortener

A simple URL shortening service with statistics tracking.

## Features

- Shorten long URLs
- Track access statistics
- Rate limiting
- Caching
- Error handling
- Responsive UI

## Setup

1. Install dependencies:

   ```bash
   npm install
   ```

2. Start the server:

   ```bash
   npm start
   ```

3. Open `index.html` in your browser to use the URL shortener.

## API Endpoints

- `POST /shorten`: Create a short URL.
- `GET /shorten/:shortCode`: Retrieve the original URL.
- `PUT /shorten/:shortCode`: Update the original URL.
- `DELETE /shorten/:shortCode`: Delete the short URL.
- `GET /shorten/:shortCode/stats`: Get statistics for the short URL.
- `GET /r/:shortCode`: Redirect to the original URL.

## License

This project is licensed under the MIT License.
