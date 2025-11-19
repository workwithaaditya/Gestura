# Documentation

## Architecture

### Web App
- **Framework**: Next.js 14.2.33 with App Router
- **3D Rendering**: Three.js 0.168.0
- **Hand Tracking**: MediaPipe Tasks Vision 0.10.8
- **Language**: TypeScript

### Desktop App
- **Language**: Python 3.11
- **3D Rendering**: Open3D
- **Hand Tracking**: MediaPipe Hands
- **Computer Vision**: OpenCV

## Gesture Controls

### Web Version
| Gesture | Action |
|---------|--------|
| ✋ Open Palm | Rotate forward |
| ✊ Closed Fist | Rotate reverse |
| ✌️ Victory | Switch objects |
| 👍 Thumbs Up | Increase speed |
| 👎 Thumbs Down | Decrease speed |

### Desktop Version
| Gesture | Action |
|---------|--------|
| ✌️ Victory | Toggle rotation |
| ✊ Closed Fist | Switch objects |
| ✋ Open Palm | Reset view |

## 3D Objects

Available shapes:
1. **Earth** 🌍 - Sphere with optional day/night textures
2. **Crate** 📦 - Cube with brown material
3. **Donut** 🍩 - Torus with pink icing and colorful sprinkles
4. **Ice Cream** 🍦 - Cone with vanilla scoop
5. **Custom** ✨ - GLB model loader support

## API Reference

### Web Component (page.tsx)

#### State Management
```typescript
rotationActiveRef: RefObject<boolean>  // Rotation on/off
rotationSpeedRef: RefObject<number>    // Rotation speed
rotationDirRef: RefObject<number>      // Direction (1/-1/0)
objectIndexRef: RefObject<number>      // Current object (0-4)
```

#### Key Functions
- `createObject(index: number, scene: Scene)` - Creates themed 3D object
- `processGestures(gestures: array)` - Maps gestures to controls
- `objectLabel(index: number)` - Returns friendly object name

## Performance Tips

- Use optional textures only when needed
- Fallback meshes ensure smooth rendering
- Hand landmark drawing optimized for 60fps
- Proper cleanup prevents memory leaks

## Testing

Run tests:
```bash
cd tests
pytest test_create_object.py
pytest test_projection.py
```

## Deployment

Vercel automatically deploys from main branch:
- **Production**: https://gestura-o64z.vercel.app
- **Preview**: Generated for each PR

## Troubleshooting

### Web App
- Camera not starting → Check browser permissions
- Hand tracking not visible → Ensure good lighting
- Slow performance → Reduce texture quality

### Desktop App
- Import errors → Check requirements.txt installation
- Camera not found → Verify cv2.VideoCapture(0) device

---

For more help, open an issue on GitHub!
