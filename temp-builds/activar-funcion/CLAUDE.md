# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a React Native mobile application built with Expo SDK 54. The project uses React 19 and React Native 0.81.5, with the new React Native architecture enabled (`newArchEnabled: true` in app.json).

**App identifiers:**
- Android package: `com.josejordandev.activarfuncion`
- Expo owner: `josejordandev`

## Development Commands

```bash
# Start development server
npm start

# Run on Android device/emulator
npm run android

# Run in web browser
npm run web
```

## Building and Deployment

This project uses EAS (Expo Application Services) for builds and deployment. Configuration is in `eas.json`.

**Build profiles:**
- `development`: Development client with internal distribution
- `preview`: APK build for internal testing (no credentials required)
- `production`: App bundle for Google Play Store submission

```bash
# Build for specific profile
eas build --profile [development|preview|production] --platform android

# Submit to Google Play Store
eas submit --platform android
```

## Project Structure

- `index.js`: Entry point that registers the root component with `registerRootComponent`
- `App.js`: Main application component (currently a starter template)
- `app.json`: Expo configuration including app metadata, icons, splash screens, and platform-specific settings
- `eas.json`: EAS Build and Submit configuration
- `assets/`: Application assets including icons and splash screens

## Key Configuration Details

- **React Native New Architecture**: Enabled in app.json, which means this project uses the new renderer (Fabric) and TurboModules
- **Platform support**: Configured for Android and web only
- **Edge-to-edge**: Enabled for Android (requires handling system insets properly)
- **Portrait orientation**: App is locked to portrait mode
