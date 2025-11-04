# How to Add Your Own 3D Models

## Step 1: Get a 3D Model

You can get 3D models from:
- **Sketchfab**: https://sketchfab.com/feed (Free models with Creative Commons license)
- **Poly Pizza**: https://poly.pizza/ (Free low-poly models)
- **CGTrader**: https://www.cgtrader.com/free-3d-models (Free models)
- **TurboSquid**: https://www.turbosquid.com/Search/3D-Models/free (Free models)
- **Make your own**: Use Blender (free) to create custom models

## Step 2: Supported Formats

This app supports:
- ✅ `.glb` (recommended - single file, includes textures)
- ✅ `.gltf` (text format, good for debugging)
- ❌ `.obj`, `.fbx` need additional loaders (can be added)

## Step 3: Place Your Model

1. Download your `.glb` or `.gltf` file
2. Place it in this folder: `web/public/models/`
3. Rename it to something simple like `my-model.glb`

## Step 4: Update the Code

Open `web/src/app/page.tsx` and find this line (~line 195):

```typescript
loader.load(
  '/models/your-model.glb', // Put your .glb file in public/models/
```

Change `your-model.glb` to your actual filename:

```typescript
loader.load(
  '/models/my-model.glb', // Your file name here
```

## Step 5: Adjust Scale (if needed)

If your model is too big or too small, change the scale:

```typescript
newMesh.scale.set(0.5, 0.5, 0.5); // Make it smaller
// or
newMesh.scale.set(2, 2, 2); // Make it bigger
```

## Step 6: Test It!

1. Refresh the browser (F5)
2. Use the **Victory** gesture (✌️) to cycle through objects
3. Your custom model will appear when you reach "custom" in the cycle:
   - Sphere → Cube → Torus → Cone → **Your Model** → Sphere...

## Example Models to Try

Here are some free .glb models you can download and test:

1. **Low Poly Fox**: https://github.com/KhronosGroup/glTF-Sample-Models/blob/master/2.0/Fox/glTF-Binary/Fox.glb
2. **Avocado**: https://github.com/KhronosGroup/glTF-Sample-Models/blob/master/2.0/Avocado/glTF-Binary/Avocado.glb
3. **Duck**: https://github.com/KhronosGroup/glTF-Sample-Models/blob/master/2.0/Duck/glTF-Binary/Duck.glb

Download any of these and place in `public/models/` to test!

## Troubleshooting

**Model not showing?**
- Check browser console (F12) for errors
- Make sure file path is correct (`/models/filename.glb`)
- Try a different model - some models may have issues

**Model too dark?**
- Increase ambient light in code
- Add more directional lights

**Model upside down or wrong orientation?**
```typescript
newMesh.rotation.set(Math.PI / 2, 0, 0); // Rotate 90 degrees on X axis
```

**Model has no color/texture?**
- Make sure you're using `.glb` format (includes textures)
- Check if model came with separate texture files

## Need Help?

Check the console (F12) for error messages. Most issues are:
1. Wrong file path
2. Model format not supported
3. Model too large (scale it down)
