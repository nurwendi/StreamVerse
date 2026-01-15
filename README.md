# StreamVerse 🎥

**StreamVerse** is a modern, self-hosted live streaming server and VOD management system. It allows you to broadcast RTMP streams, view them via HLS (HTTP Live Streaming) on a custom-branded web player, and manage your content through a comprehensive Admin Panel.

## Features ✨

*   **Live Streaming Server**: Built-in Node Media Server (RTMP -> HLS).
*   **Web Player**: Adaptive HLS player with a customizable modern UI.
*   **Branding Customization**:
    *   Change App Name, Logo, and Favicon via Admin Panel.
    *   Dynamic themes (e.g., Yellow/Blue).
*   **VOD Manager**: Upload, categorize, and manage Video On Demand content.
*   **Multi-Restreaming**: Relay your live stream to multiple destinations (YouTube, Facebook, Twitch, etc.) simultaneously.
*   **Admin Panel**:
    *   Dashboard for server stats.
    *   Settings configuration (Stream Key, OBS details).
    *   User management (Admin password).
*   **Public API**: Secure endpoints for public branding (No auth required for viewers).

## Prerequisites 🛠️

*   **Node.js** (v14 or higher recommended)
*   **FFmpeg**: Included via `ffmpeg-static`, but system installation is recommended for advanced performance.

## Installation 📦

1.  **Clone the repository**:
    ```bash
    git clone https://github.com/nurwendi/StreamVerse.git
    cd StreamVerse
    ```

2.  **Install dependencies**:
    ```bash
    npm install
    ```

## Usage 🚀

1.  **Start the server**:
    ```bash
    # Development mode (with nodemon)
    npm run dev

    # Production mode (Standard)
    npm start

    # Production mode (with PM2)
    pm2 start ecosystem.config.js
    ```

2.  **Access the Application**:
    *   **Player & VOD**: `http://localhost:8000`
    *   **Admin Panel**: `http://localhost:8000/admin.html`
        *   *Default Credentials*: `admin` / `admin`

3.  **Start Streaming**:
    *   Open your streaming software (e.g., OBS Studio).
    *   **Server**: `rtmp://localhost/live`
    *   **Stream Key**: `stream` (or check/generate a new one in the Admin Panel).

## Project Structure 📂

*   `server.js`: Main application entry point (Express + Node Media Server).
*   `public/`: Static frontend files (`index.html`, `admin.html`).
*   `data/`: Configuration files (`settings.json`).
*   `media/`: HLS fragments and VOD storage.

## Contributing 🤝

Contributions are welcome! Please fork the repository and submit a pull request.

## License 📄

This project is licensed under the ISC License.
