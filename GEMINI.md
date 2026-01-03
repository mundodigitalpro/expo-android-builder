# GEMINI.md

This document provides guidance for interacting with the **Expo Android Builder** project.

## Project Overview

This is a full-stack mobile development environment designed to create, manage, and build Expo (React Native) applications directly from an Android device using Termux, or on a VPS. It consists of two main components:

*   **Frontend (`/app`):** A React Native application built with Expo, providing a user interface to manage projects, interact with an AI assistant (Claude), and monitor application builds.
*   **Backend (`/server`):** A Node.js server using Express.js and Socket.io. It handles project creation, file management, and executes command-line tools like `expo`, `eas`, and `claude`.

The system is designed to be deployed on a VPS using Docker for production, with Nginx as a reverse proxy.

## Architecture

*   **Frontend:** React Native (Expo)
*   **Backend:** Node.js, Express.js, Socket.io
*   **Database:** Filesystem for project storage.
*   **Deployment:** Docker, Docker Compose, Nginx
*   **CI/CD:** GitHub Actions for building Android APKs.

### Request Flow (Production)

```
Internet → Cloudflare DNS/CDN → Hetzner Cloud Firewall (80,443)
  → VPS (Ubuntu 24.04)
    ├─ UFW Firewall
    ├─ Nginx (reverse proxy with SSL termination)
    └─ Docker containers (app on localhost:3001)
```

## Building and Running

### Development (Termux)

1.  **Install Dependencies:**
    ```bash
    # Server
    cd server
    npm install

    # App
    cd ../app
    npm install
    ```

2.  **Start Services:**
    ```bash
    cd server
    ./start-all-services.sh
    ```
    This script starts the backend server and the Expo development server.

### Production (VPS with Docker)

The application is deployed using Docker. The `server/deploy.sh` script handles the deployment process.

*   **Deploy:**
    ```bash
    ./deploy.sh
    ```
    This script, located in the root of the project, delegates to `server/deploy.sh`, which:
    1.  Pulls the latest changes from the `main` branch.
    2.  Stops the running Docker containers.
    3.  Rebuilds the Docker image.
    4.  Starts the containers in detached mode.

*   **View Logs:**
    ```bash
    cd server
    docker-compose logs -f
    ```

*   **Restart:**
    ```bash
    cd server
    docker-compose restart
    ```

## Key Files

*   `app/App.js`: The main entry point for the React Native application.
*   `server/server.js`: The entry point for the Node.js backend server.
*   `README.md`: Provides a detailed overview of the project.
*   `docs/DEPLOYMENT_VPS.md`: Contains comprehensive instructions for deploying the application to a production VPS.
*   `.github/workflows/gradle-build-android.yml`: GitHub Actions workflow for building Android APKs.
*   `server/start-all-services.sh`: Script for starting the application in a development environment.
*   `deploy.sh` and `server/deploy.sh`: Scripts for deploying the application to a production environment.
*   `server/src/services/ProjectService.js`: Core logic for managing Expo projects.
*   `server/src/services/ClaudeService.js`: Handles interaction with the Claude AI assistant.

## Development Conventions

*   The backend follows a service-oriented architecture, with services like `ProjectService` and `ClaudeService` encapsulating business logic.
*   The frontend uses React Navigation for screen management and `axios` for API communication.
*   Real-time communication between the frontend and backend is handled using Socket.io.
*   Authentication is managed via a bearer token.
*   The project uses `dotenv` for environment variable management.
