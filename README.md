# Corp Matrix

A secure corporate messenger built on the [Matrix](https://matrix.org) protocol. Provides end-to-end encrypted messaging with a modern, responsive UI that works across desktop and mobile browsers.

## Features

- End-to-end encrypted messaging (Rust crypto via WASM)
- Direct messages and group rooms
- Spaces for organizing rooms
- Message threads, reactions, editing, forwarding
- File sharing (images, videos, documents)
- Voice messages
- Polls
- User search and message search
- Device verification (SAS emoji)
- Key backup and recovery
- Push notifications (Web Notifications API)
- Dark and light themes
- Internationalization (English, Russian)
- PWA — installable on desktop and mobile

## Tech Stack

- **React 19** with React Compiler
- **TypeScript**
- **Vite** (bundler)
- **matrix-js-sdk** + **matrix-sdk-crypto-wasm** (Rust E2EE)
- **Zustand** (state management)
- **SCSS Modules** (styling)
- **react-virtuoso** (virtualized lists)
- **Lucide** (icons)

## Getting Started

### Prerequisites

- Node.js 20+
- npm 10+

### Installation

```bash
git clone https://github.com/altumus/corp-matrix-web.git
cd corp-matrix-web
npm install
```

### Development

```bash
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) in your browser.

### Build

```bash
npm run build
```

The production build will be output to the `dist/` directory.

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `VITE_MATRIX_HOMESERVER_URL` | Default homeserver URL | *(empty — user enters manually)* |

Create a `.env` file in the project root:

```
VITE_MATRIX_HOMESERVER_URL=https://matrix.example.com
```

## Deployment

### Netlify

The project includes a `public/_redirects` file for SPA routing on Netlify. Simply connect the repository to Netlify and it will build and deploy automatically.

### Any Static Hosting

1. Run `npm run build`
2. Deploy the `dist/` directory
3. Configure the server to redirect all routes to `index.html` (SPA fallback)

## PWA (Progressive Web App)

Corp Matrix is a PWA — it can be installed as a standalone app on any platform.

### Desktop (Chrome / Edge)

1. Open the app in Chrome or Edge
2. Click the install icon in the address bar (or Menu → "Install Corp Matrix")
3. The app will open in its own window with a taskbar icon

### Android

1. Open the app in Chrome
2. Tap "Add to Home Screen" from the browser menu
3. The app will appear on the home screen and launch in fullscreen

### iOS (Safari)

1. Open the app in Safari
2. Tap the Share button → "Add to Home Screen"
3. The app will appear on the home screen

## Project Structure

```
src/
├── app/              # App shell, router, layouts
├── features/
│   ├── auth/         # Login, registration, session management
│   ├── encryption/   # E2EE, key backup, device verification
│   ├── media/        # File uploads, image preview, lightbox
│   ├── messaging/    # Composer, message service, mentions
│   ├── notifications/# Web push notifications
│   ├── room/         # Room view, timeline, messages
│   ├── room-list/    # Room list, search
│   ├── settings/     # User settings, devices, encryption
│   └── spaces/       # Spaces sidebar
├── shared/
│   ├── hooks/        # Shared hooks
│   ├── i18n/         # Internationalization (en, ru)
│   ├── lib/          # Matrix client wrapper
│   └── ui/           # Reusable UI components
└── workers/          # Web workers
```

## License

MIT
