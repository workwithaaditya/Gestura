# 3D Gesture Control Web App

A browser-based real-time 3D object manipulation app using hand gestures, powered by MediaPipe Tasks (Web) and Three.js. Fully deployable to Vercel.

## Features

- Real-time gesture recognition in the browser (no server processing)
- 3D object rendering (cube/sphere) with rotation, scaling, and axis switching
- Same gesture controls as the Python desktop app:
  - **Open_Palm**: Reset rotations
  - **Closed_Fist**: Toggle rotation on/off
  - **Victory**: Switch between cube and sphere
  - **Pointing_Up**: Cycle rotation axis (X/Y/Z)
  - **Thumb_Up / Thumb_Down**: Adjust rotation speed
- Webcam access via `getUserMedia` (HTTPS required; Vercel provides it automatically)
- On-screen overlay: gesture cheatsheet and current state

## Tech Stack

- **Next.js 14** (React, TypeScript)
- **MediaPipe Tasks Vision** (GestureRecognizer running in WASM)
- **Three.js** (3D rendering)
- **Vercel** (deployment)

## Local Development

1. **Install dependencies**

```bash
cd web
npm install
```

2. **Place the gesture model**

Download the `gesture_recognizer.task` file from the [MediaPipe documentation](https://developers.google.com/mediapipe/solutions/vision/gesture_recognizer) and put it in:

```
web/public/models/gesture_recognizer.task
```

3. **Run the dev server**

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Grant camera permissions when prompted.

## Deployment on Vercel

### Option 1: Vercel CLI

```bash
npm install -g vercel
cd web
vercel
```

Follow the prompts. Vercel will build and deploy your app.

### Option 2: GitHub Integration

1. Push this repo (including the `web/` folder) to GitHub.
2. Go to [vercel.com](https://vercel.com) and import your repo.
3. Set the **Root Directory** to `web` in the project settings.
4. Deploy.

Vercel automatically serves over HTTPS, which is required for camera access.

### Important: Model File

Ensure `public/models/gesture_recognizer.task` is committed or uploaded. Vercel will include files in `public/` in the deployment.

## How It Works

- **Camera**: `navigator.mediaDevices.getUserMedia` captures video.
- **Gesture Recognition**: MediaPipe Tasks (Web) GestureRecognizer processes each frame in the browser using WASM (no server latency).
- **3D Scene**: Three.js renders a sphere or cube and applies rotation/scaling based on detected gestures.
- **State Management**: React hooks manage rotation state, speed, axis, and object type; gestures trigger state updates with cooldowns to prevent rapid toggling.

## Browser Compatibility

- Chrome/Edge: Full support
- Firefox: Full support
- Safari (iOS/macOS): Ensure `playsInline` on video; test camera permissions
- Requires HTTPS for camera access (Vercel provides this)

## Troubleshooting

- **Camera not working**: Check browser permissions. HTTPS is required.
- **Model not loading**: Verify `public/models/gesture_recognizer.task` exists and is accessible at `/models/gesture_recognizer.task` in the dev server.
- **TypeScript errors before npm install**: Run `npm install` to install dependencies and generate types.

## License

Same as the parent project (GNU General Public Licence v3.0).

## Acknowledgments

- [MediaPipe](https://mediapipe.dev/) for gesture recognition
- [Three.js](https://threejs.org/) for 3D rendering
- [Next.js](https://nextjs.org/) and [Vercel](https://vercel.com/) for the web platform
