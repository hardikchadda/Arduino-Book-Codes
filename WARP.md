# WARP.md

This file provides guidance to WARP (warp.dev) when working with code in this repository.

## Repository Overview

This is an Arduino Code Manager project that serves as a web-based library for Arduino example codes. It's a dual-purpose repository containing both Arduino sketch files (.ino) organized by chapters and a web application that displays these files with syntax highlighting, QR code generation for sharing, and GitHub integration.

## Architecture

### Core Components

**Web Application Layer:**
- `index.html` - Main dashboard showing Arduino file cards with QR codes
- `file.html` - Individual file viewer with syntax highlighting and sharing features  
- `script.js` - Single JavaScript file containing all application logic (~460 lines)
- `style.css` - Minimal custom styles (Tailwind CSS handles most styling)

**Arduino Code Organization:**
- Files organized by chapter directories (`Chapter 1/`, `Chapter 2/`, etc.)
- Each directory contains `.ino` files for specific Arduino projects
- Supports `.ino`, `.cpp`, and `.h` file extensions

**Data Management:**
- `files.json` - Static manifest file listing all Arduino files, avoiding GitHub API rate limits
- GitHub API integration as fallback when manifest is unavailable
- Local caching system for GitHub tree data (5-minute TTL)

### Key Features

**GitHub Integration:**
- Auto-detects repository owner/repo from GitHub Pages URLs or manual configuration
- Fetches repository metadata and file trees via GitHub API
- Rate limit handling with cached fallback
- ETag-based conditional requests for efficiency

**File Management:**
- Real-time search/filtering of Arduino files
- File preview with Prism.js syntax highlighting for C/C++/Arduino
- Download functionality for individual files
- QR code generation for easy mobile sharing

**UI/UX:**
- Dark/light theme toggle with localStorage persistence  
- Responsive design with Tailwind CSS
- Chapter-based organization of Arduino projects
- Mobile-friendly sharing with Web Share API and QR code fallback
- Inline copy button for code blocks
- Enhanced search filtering across chapters and files
- Improved mobile experience with responsive layouts
- Status messages with better styling and animations

## Common Development Tasks

### Testing the Web Application
```bash
# Serve locally (requires Python 3)
python3 -m http.server 8000

# Or with Node.js
npx http-server

# Or with PHP
php -S localhost:8000
```

### Updating the File Manifest
```bash
# The files.json manifest should be updated when adding new Arduino files
# Current format:
{
  "generatedAt": "2025-09-22T09:07:48.140Z", 
  "branch": "main",
  "files": [
    "Chapter 1/01_Blink.ino",
    "Chapter 1/02_Pin9LED.ino", 
    // ... additional files
  ]
}
```

### Configuration
The web app uses `window.APP_CONFIG` in both HTML files:
- `owner`: GitHub username (currently "hardikchadda")
- `repo`: Repository name (currently "Arduino-Book-Codes")  
- `branch`: Target branch (currently "main")

### Arduino File Structure
Arduino files follow standard conventions:
- `.ino` files contain setup() and loop() functions
- Pin definitions typically use constants (e.g., `const int ledPin = 9;`)
- Comments explain functionality and timing
- Examples progress from basic LED blinking to more complex patterns

## Code Patterns

**JavaScript Module Pattern:**
The entire application is wrapped in an IIFE (Immediately Invoked Function Expression) with a centralized state object and utility functions.

**GitHub API Handling:**
- Conditional requests with ETag headers
- Graceful degradation when rate limited
- Caching strategy with timestamp-based TTL
- Raw file fetching via raw.githubusercontent.com

**Error Handling:**
- Try-catch blocks around all async operations  
- User-friendly error messages via setStatus() function
- Fallback behaviors (cached data, manifest over API)

**Theme Management:**
- CSS class-based dark mode (`dark` class on `<html>`)
- Dynamic Prism theme switching
- localStorage persistence of user preference

## File Extensions and Languages

- `.ino` files: Mapped to `cpp` language for syntax highlighting
- `.cpp` files: C++ syntax highlighting  
- `.h` files: C++ header file highlighting
- All Arduino files use Prism.js C/C++ syntax highlighting

## Dependencies

**External CDN Resources:**
- Tailwind CSS for styling framework
- Prism.js for syntax highlighting (core + C/C++ components)
- QRCode.js for QR code generation
- GitHub API for repository data

**No Build Process:**
The project intentionally avoids build tools and works directly with CDN resources for simplicity and portability.

## UI/UX Features

**Chapter-Based Organization:**
Arduino projects are now grouped by chapters on the main page, making it easier to navigate through the learning progression.

**Enhanced Sharing:**
- Web Share API integration for native mobile sharing
- QR code modal fallback for desktop users
- Copy link functionality

**Improved Code Viewing:**
- Inline copy button positioned in the top-right of code blocks
- Better syntax highlighting with Prism.js
- Responsive code display

**Smart Search:**
- Search across project names, file paths, and chapter names
- Real-time filtering with chapter visibility management
- Keyboard shortcut (/) to focus search
