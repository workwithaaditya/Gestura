'use client';

import { useEffect, useRef, useState } from 'react';
import { GestureRecognizer, FilesetResolver, GestureRecognizerResult } from '@mediapipe/tasks-vision';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

type ObjectType = 'sphere' | 'cube' | 'torus' | 'cone' | 'custom';

export default function Home() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const overlayCanvasRef = useRef<HTMLCanvasElement>(null);
  const [cameraReady, setCameraReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [needsUserClick, setNeedsUserClick] = useState(false);
  const [loadingStatus, setLoadingStatus] = useState<string>('Initializing...');

  // Gesture state
  const [rotationActive, setRotationActive] = useState(true); // Start with rotation ON
  const [rotationSpeed, setRotationSpeed] = useState(0.02);
  const [objectType, setObjectType] = useState<ObjectType>('sphere');
  const [lastGesture, setLastGesture] = useState<string | null>(null);
  const [lastScore, setLastScore] = useState<number | null>(null);

  // Three.js refs (preserve across renders)
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraThreeRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const meshRef = useRef<THREE.Mesh | THREE.Group | null>(null);
  const recognizerRef = useRef<GestureRecognizer | null>(null);
  const initializedRef = useRef(false);

  // Use refs for rotation state so loop always reads latest values
  const rotationActiveRef = useRef(true); // Initialize to true to match state
  const rotationSpeedRef = useRef(0.02); // Initialize to match state

  const gestureCooldownRef = useRef(0);
  const gestureHoldFramesRef = useRef(0);
  const lastGestureNameRef = useRef<string | null>(null);

  // Sync refs with state
  useEffect(() => {
    rotationActiveRef.current = rotationActive;
    console.log('🔄 Rotation active updated:', rotationActive);
  }, [rotationActive]);

  useEffect(() => {
    rotationSpeedRef.current = rotationSpeed;
    console.log('⚡ Speed updated:', rotationSpeed);
  }, [rotationSpeed]);

  useEffect(() => {
    // Prevent multiple initializations
    if (initializedRef.current) return;
    initializedRef.current = true;

    let stream: MediaStream | null = null;
    let animationFrameId: number;

    async function init() {
      try {
        setError(null);
        setLoadingStatus('Starting camera...');
        
        // 1) Setup camera
        const video = videoRef.current;
        if (!video) return;

        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } });
        video.srcObject = stream;
        video.muted = true;
        video.playsInline = true;
        
        // Try to play - if fails, show button
        try {
          await video.play();
          setNeedsUserClick(false);
          setLoadingStatus('Camera ready! Loading gesture AI...');
          setCameraReady(true);
        } catch (playError) {
          console.log('Autoplay blocked, need user interaction');
          setNeedsUserClick(true);
          // Don't return - still need to setup MediaPipe for when button is clicked
        }

        // 2) Setup MediaPipe GestureRecognizer
        console.log('Loading MediaPipe vision tasks...');
        setLoadingStatus('Loading MediaPipe WASM files...');
        const vision = await FilesetResolver.forVisionTasks(
          'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.8/wasm'
        );
        console.log('Vision tasks loaded, creating gesture recognizer...');
        
        setLoadingStatus('Loading gesture model (8MB)...');
        const recognizer = await GestureRecognizer.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/gesture_recognizer/gesture_recognizer/float16/1/gesture_recognizer.task',
          },
          runningMode: 'VIDEO',
          numHands: 1,
        });
        console.log('Gesture recognizer created successfully!');
        setLoadingStatus('Ready!');
        recognizerRef.current = recognizer;

        // 3) Setup Three.js
        const canvas = canvasRef.current;
        if (!canvas) return;

        const scene = new THREE.Scene();
        sceneRef.current = scene;

        const camera = new THREE.PerspectiveCamera(60, canvas.clientWidth / canvas.clientHeight, 0.1, 100);
        camera.position.z = 5;
        cameraThreeRef.current = camera;

        const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
        renderer.setSize(canvas.clientWidth, canvas.clientHeight);
        renderer.setPixelRatio(window.devicePixelRatio);
        rendererRef.current = renderer;

        // Initial object (sphere) with better 3D material
        const geometry = new THREE.SphereGeometry(1, 64, 64);
        const material = new THREE.MeshStandardMaterial({ 
          color: 0x66a3ff,
          metalness: 0.3,
          roughness: 0.4,
          wireframe: false,
        });
        const mesh = new THREE.Mesh(geometry, material);
        scene.add(mesh);
        meshRef.current = mesh;

        // Lighting
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
        scene.add(ambientLight);
        const dirLight = new THREE.DirectionalLight(0xffffff, 1.2);
        dirLight.position.set(2, 2, 2);
        scene.add(dirLight);

        // 4) Animation loop
        const loop = () => {
          // Gesture recognition
          if (recognizerRef.current && video && video.readyState >= 2) {
            const now = performance.now();
            const result = recognizerRef.current.recognizeForVideo(video, now);
            processGestures(result);
            drawHandLandmarks(result);
          }

          // Rotation - use refs to get latest values - rotate on all 3 axes for better effect
          if (rotationActiveRef.current && meshRef.current) {
            const speed = rotationSpeedRef.current;
            meshRef.current.rotation.x += speed * 0.5;
            meshRef.current.rotation.y += speed;
            meshRef.current.rotation.z += speed * 0.3;
          } else if (meshRef.current) {
            // Debug: log once when rotation is off
            if (!rotationActiveRef.current && Math.random() < 0.01) {
              console.log('⏸️ Rotation paused');
            }
          }

          // Render
          if (rendererRef.current && sceneRef.current && cameraThreeRef.current) {
            rendererRef.current.render(sceneRef.current, cameraThreeRef.current);
          }

          animationFrameId = requestAnimationFrame(loop);
        };
        loop();
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        console.error('Initialization error:', err);
        setError(`Failed to initialize: ${message}`);
      }
    }

    init();

    return () => {
      initializedRef.current = false;
      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
      }
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
      }
      if (rendererRef.current) {
        rendererRef.current.dispose();
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Re-apply rotation state changes from React state to the loop
  useEffect(() => {
    // No direct action needed; loop reads rotationActive, rotationSpeed, activeAxis directly via closure
  }, [rotationActive, rotationSpeed]);

  // Switch object geometry when objectType changes
  useEffect(() => {
    if (!meshRef.current || !sceneRef.current) return;
    const scene = sceneRef.current;
    const mesh = meshRef.current;
    
    // Remove old mesh/group and dispose resources
    if (mesh) {
      scene.remove(mesh);
      const disposeMesh = (m: THREE.Object3D) => {
        m.traverse((obj) => {
          const asMesh = obj as THREE.Mesh;
          if ((asMesh as any).geometry) {
            (asMesh as any).geometry.dispose?.();
          }
          if ((asMesh as any).material) {
            const mat = (asMesh as any).material as THREE.Material | THREE.Material[];
            if (Array.isArray(mat)) mat.forEach((mm) => mm.dispose?.());
            else mat.dispose?.();
          }
        });
      };
      disposeMesh(mesh);
    }
    
    let newMesh: THREE.Mesh | THREE.Group;
    const texLoader = new THREE.TextureLoader();
    const tryLoad = (url: string, onOk: (t: THREE.Texture) => void) => {
      try {
        texLoader.load(
          url,
          (t) => {
            t.wrapS = THREE.RepeatWrapping;
            t.wrapT = THREE.RepeatWrapping;
            onOk(t);
          },
          undefined,
          () => {
            // ignore if missing
          }
        );
      } catch (_) {/* noop */}
    };
    
    if (objectType === 'custom') {
      // Load custom 3D model (example: glTF file)
      const loader = new GLTFLoader();
      loader.load(
        '/models/your-model.glb', // Put your .glb file in public/models/
        (gltf) => {
          newMesh = gltf.scene;
          newMesh.scale.set(1, 1, 1); // Adjust scale
          scene.add(newMesh);
          meshRef.current = newMesh as any;
        },
        undefined,
        (error) => {
          console.error('Error loading model:', error);
          // Fallback to sphere
          const geometry = new THREE.SphereGeometry(1, 64, 64);
          const material = new THREE.MeshStandardMaterial({ color: 0x66a3ff, metalness: 0.3, roughness: 0.4 });
          newMesh = new THREE.Mesh(geometry, material);
          scene.add(newMesh);
          meshRef.current = newMesh;
        }
      );
      return;
    }
    
    // Built-in shapes with nicer looks/textures
    if (objectType === 'sphere') {
      // Earth
      const geometry = new THREE.SphereGeometry(1, 64, 64);
      const material = new THREE.MeshStandardMaterial({ color: 0x2266aa, roughness: 0.8, metalness: 0.0 });
      newMesh = new THREE.Mesh(geometry, material);
      // Try to load textures if present
      tryLoad('/textures/earth_daymap.jpg', (t) => {
        material.map = t; material.needsUpdate = true;
      });
      tryLoad('/textures/earth_normal.jpg', (t) => {
        material.normalMap = t; material.needsUpdate = true;
      });
      tryLoad('/textures/earth_specular.jpg', (t) => {
        material.metalnessMap = t; material.metalness = 0.2; material.needsUpdate = true;
      });
      scene.add(newMesh);
      meshRef.current = newMesh;
    } else if (objectType === 'cube') {
      // Crate-like cube
      const geometry = new THREE.BoxGeometry(2, 2, 2);
      const material = new THREE.MeshStandardMaterial({ color: 0x8b5a2b, roughness: 0.9, metalness: 0.05 });
      newMesh = new THREE.Mesh(geometry, material);
      tryLoad('/textures/crate_diffuse.jpg', (t) => { material.map = t; material.needsUpdate = true; });
      tryLoad('/textures/crate_normal.jpg', (t) => { material.normalMap = t; material.needsUpdate = true; });
      scene.add(newMesh);
      meshRef.current = newMesh;
    } else if (objectType === 'torus') {
      // Donut with icing and sprinkles
      const group = new THREE.Group();
      // Dough
      const doughGeo = new THREE.TorusGeometry(1, 0.4, 32, 96);
      const doughMat = new THREE.MeshStandardMaterial({ color: 0xC68642, roughness: 0.8, metalness: 0.05 });
      const doughMesh = new THREE.Mesh(doughGeo, doughMat);
      group.add(doughMesh);
      // Icing (slightly larger radius, smaller thickness, lifted up a bit)
      const icingGeo = new THREE.TorusGeometry(1.02, 0.28, 32, 96);
      const icingMat = new THREE.MeshStandardMaterial({ color: 0xFFC0CB, roughness: 0.6, metalness: 0.1 });
      const icingMesh = new THREE.Mesh(icingGeo, icingMat);
      icingMesh.position.y = 0.08;
      group.add(icingMesh);
      // Sprinkles
      const sprinkleColors = [0xff4d4f, 0x40c463, 0x36cfc9, 0xffe58f, 0x597ef7, 0xff85c0];
      const R = 1.0, r = 0.28;
      for (let i = 0; i < 120; i++) {
        const u = Math.random() * Math.PI * 2;
        const v = (Math.random() - 0.5) * Math.PI * 0.9; // concentrate on top
        const x = (R + r * Math.cos(v)) * Math.cos(u);
        const y = (R + r * Math.cos(v)) * Math.sin(u);
        const z = r * Math.sin(v) + 0.1;
        const geom = new THREE.BoxGeometry(0.06, 0.02, 0.02);
        const mat = new THREE.MeshStandardMaterial({ color: sprinkleColors[(Math.random() * sprinkleColors.length) | 0], roughness: 0.5 });
        const m = new THREE.Mesh(geom, mat);
        m.position.set(x, y, z);
        m.rotation.set(Math.random()*Math.PI, Math.random()*Math.PI, Math.random()*Math.PI);
        group.add(m);
      }
      scene.add(group);
      meshRef.current = group;
    } else if (objectType === 'cone') {
      // Ice cream cone: cone + scoop sphere
      const group = new THREE.Group();
      // Cone
      const coneGeo = new THREE.ConeGeometry(0.9, 2, 48);
      const coneMat = new THREE.MeshStandardMaterial({ color: 0xD2A679, roughness: 0.9, metalness: 0.05 });
      const coneMesh = new THREE.Mesh(coneGeo, coneMat);
      group.add(coneMesh);
      tryLoad('/textures/waffle.jpg', (t) => { coneMat.map = t; coneMat.needsUpdate = true; t.repeat.set(2, 4); });
      // Scoop
      const scoopGeo = new THREE.SphereGeometry(0.9, 48, 48);
      const scoopMat = new THREE.MeshStandardMaterial({ color: 0xE6F7FF, roughness: 0.7, metalness: 0.05 });
      const scoopMesh = new THREE.Mesh(scoopGeo, scoopMat);
      scoopMesh.position.y = 1.0; // sit on top
      group.add(scoopMesh);
      scene.add(group);
      meshRef.current = group;
    } else {
      // Fallback sphere
      const geometry = new THREE.SphereGeometry(1, 64, 64);
      const material = new THREE.MeshStandardMaterial({ color: 0x66a3ff, metalness: 0.3, roughness: 0.4 });
      newMesh = new THREE.Mesh(geometry, material);
      scene.add(newMesh);
      meshRef.current = newMesh;
    }
  }, [objectType]);

  // Friendly label for object
  const objectLabel = (t: ObjectType): string => {
    switch (t) {
      case 'sphere': return 'EARTH';
      case 'cube': return 'CRATE';
      case 'torus': return 'DONUT';
      case 'cone': return 'ICE CREAM';
      case 'custom': return 'CUSTOM MODEL';
    }
    return (t as string).toUpperCase();
  };

  function drawHandLandmarks(result: GestureRecognizerResult | undefined) {
    const canvas = overlayCanvasRef.current;
    const video = videoRef.current;
    if (!canvas || !video) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear previous frame
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw hand landmarks if detected
    if (result && result.landmarks && result.landmarks.length > 0) {
      for (const landmarks of result.landmarks) {
        // Draw connections (skeleton)
        ctx.strokeStyle = '#00FF00';
        ctx.lineWidth = 2;
        
        // Hand connections (MediaPipe hand model)
        const connections = [
          [0, 1], [1, 2], [2, 3], [3, 4], // Thumb
          [0, 5], [5, 6], [6, 7], [7, 8], // Index
          [0, 9], [9, 10], [10, 11], [11, 12], // Middle
          [0, 13], [13, 14], [14, 15], [15, 16], // Ring
          [0, 17], [17, 18], [18, 19], [19, 20], // Pinky
          [5, 9], [9, 13], [13, 17], // Palm
        ];

        for (const [start, end] of connections) {
          const startPoint = landmarks[start];
          const endPoint = landmarks[end];
          
          ctx.beginPath();
          ctx.moveTo(startPoint.x * canvas.width, startPoint.y * canvas.height);
          ctx.lineTo(endPoint.x * canvas.width, endPoint.y * canvas.height);
          ctx.stroke();
        }

        // Draw landmark points
        ctx.fillStyle = '#FF0000';
        for (const landmark of landmarks) {
          const x = landmark.x * canvas.width;
          const y = landmark.y * canvas.height;
          
          ctx.beginPath();
          ctx.arc(x, y, 4, 0, 2 * Math.PI);
          ctx.fill();
        }
      }
    }
  }

  function processGestures(result: GestureRecognizerResult | undefined) {
    if (gestureCooldownRef.current > 0) {
      gestureCooldownRef.current--;
    }

    let currentGesture: string | null = null;
    if (result && result.gestures && result.gestures.length > 0) {
      const topGesture = result.gestures[0][0];
      // Lower threshold even more for better detection
      if (topGesture && topGesture.score >= 0.3) {
        currentGesture = topGesture.categoryName;
      }
      // Update UI with last seen gesture label regardless of action trigger
      if (topGesture) {
        setLastGesture(`${topGesture.categoryName}`);
        setLastScore(topGesture.score);
        
        // Debug: log high confidence gestures
        if (topGesture.score > 0.5) {
          console.log(`Detected: ${topGesture.categoryName} (${topGesture.score.toFixed(2)})`);
        }
      }
    }

    if (currentGesture && currentGesture === lastGestureNameRef.current) {
      gestureHoldFramesRef.current++;
    } else {
      gestureHoldFramesRef.current = 0;
    }

    // Trigger action: reduced hold frames to 1, increased cooldown
    if (currentGesture && gestureHoldFramesRef.current > 1 && gestureCooldownRef.current === 0) {
      gestureCooldownRef.current = 15; // Longer cooldown to prevent spam
      handleGestureAction(currentGesture);
      console.log(`ACTION: ${currentGesture}`);
    }

    lastGestureNameRef.current = currentGesture;
  }

  function handleGestureAction(gesture: string) {
    switch (gesture) {
      case 'Open_Palm':
        // Reset rotations
        if (meshRef.current) {
          meshRef.current.rotation.set(0, 0, 0);
        }
        console.log('✋ ACTION: Reset rotations');
        break;
      case 'Closed_Fist':
        setRotationActive((prev) => {
          const newState = !prev;
          console.log(`✊ ACTION: Rotation ${newState ? 'ON' : 'OFF'}`);
          return newState;
        });
        break;
      case 'Victory':
        // Cycle through objects: sphere → cube → torus → cone → custom → sphere
        setObjectType((prev) => {
          const order: ObjectType[] = ['sphere', 'cube', 'torus', 'cone', 'custom'];
          const currentIndex = order.indexOf(prev);
          const newType = order[(currentIndex + 1) % order.length];
          console.log(`✌️ ACTION: Switched to ${newType}`);
          return newType;
        });
        break;
      case 'Thumb_Up':
        setRotationSpeed((prev) => {
          const newSpeed = Math.min(prev + 0.01, 0.1);
          console.log(`👍 ACTION: Speed increased to ${newSpeed.toFixed(3)}`);
          return newSpeed;
        });
        break;
      case 'Thumb_Down':
        setRotationSpeed((prev) => {
          const newSpeed = Math.max(prev - 0.01, 0.005);
          console.log(`👎 ACTION: Speed decreased to ${newSpeed.toFixed(3)}`);
          return newSpeed;
        });
        break;
      default:
        break;
    }
  }

  return (
    <div style={{ position: 'relative', width: '100vw', height: '100vh', overflow: 'hidden', background: '#111' }}>
      {/* Video feed - visible in corner with overlay */}
      <div style={{
        position: 'absolute',
        bottom: 10,
        right: 10,
        width: '240px',
        height: '180px',
        zIndex: 10,
      }}>
        <video 
          ref={videoRef}
          onLoadedMetadata={(e) => {
            const video = e.currentTarget;
            const canvas = overlayCanvasRef.current;
            if (canvas) {
              canvas.width = video.videoWidth;
              canvas.height = video.videoHeight;
            }
          }}
          style={{ 
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            border: '2px solid #4CAF50',
            borderRadius: '8px',
            transform: 'scaleX(-1)', // Mirror video
          }} 
        />
        <canvas
          ref={overlayCanvasRef}
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            transform: 'scaleX(-1)', // Mirror overlay
            pointerEvents: 'none',
          }}
        />
      </div>

      {/* Three.js canvas */}
      <canvas
        ref={canvasRef}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
        }}
      />

      {/* Overlay UI - Modern Design */}
      {cameraReady && (
        <div
          style={{
            position: 'absolute',
            top: 20,
            left: 20,
            background: 'linear-gradient(135deg, rgba(0,0,0,0.8) 0%, rgba(30,30,40,0.9) 100%)',
            color: '#fff',
            padding: '20px',
            borderRadius: '12px',
            fontSize: '14px',
            fontFamily: 'system-ui, -apple-system, sans-serif',
            maxWidth: '380px',
            boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
            border: '1px solid rgba(255,255,255,0.1)',
          }}
        >
          {/* Title */}
          <div style={{ 
            fontSize: '18px', 
            fontWeight: '600', 
            marginBottom: '16px',
            background: 'linear-gradient(90deg, #4CAF50, #2196F3)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
          }}>
            🎮 Gesture Controls
          </div>

          {/* Gesture Guide */}
          <div style={{ marginBottom: '16px', lineHeight: '1.8' }}>
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: '6px' }}>
              <span style={{ fontSize: '18px', marginRight: '8px' }}>✋</span>
              <span style={{ opacity: 0.9 }}>Open Palm → Reset rotation</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: '6px' }}>
              <span style={{ fontSize: '18px', marginRight: '8px' }}>✊</span>
              <span style={{ opacity: 0.9 }}>Closed Fist → Toggle ON/OFF</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: '6px' }}>
              <span style={{ fontSize: '18px', marginRight: '8px' }}>✌️</span>
              <span style={{ opacity: 0.9 }}>Victory → Switch object</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: '6px' }}>
              <span style={{ fontSize: '18px', marginRight: '8px' }}>👍</span>
              <span style={{ opacity: 0.9 }}>Thumbs Up → Speed up</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center' }}>
              <span style={{ fontSize: '18px', marginRight: '8px' }}>👎</span>
              <span style={{ opacity: 0.9 }}>Thumbs Down → Slow down</span>
            </div>
          </div>

          {/* Status Section */}
          <div style={{ 
            borderTop: '1px solid rgba(255,255,255,0.2)', 
            paddingTop: '12px',
            marginTop: '12px',
          }}>
            <div style={{ fontSize: '12px', fontWeight: '600', marginBottom: '8px', opacity: 0.7 }}>
              STATUS
            </div>
            
            {/* Rotation Status */}
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: '8px' }}>
              <div style={{ 
                width: '12px', 
                height: '12px', 
                borderRadius: '50%', 
                background: rotationActive ? '#4CAF50' : '#f44336',
                marginRight: '8px',
                boxShadow: rotationActive ? '0 0 8px #4CAF50' : '0 0 8px #f44336',
              }} />
              <span style={{ fontWeight: '500' }}>
                Rotation: {rotationActive ? '🟢 ON' : '🔴 OFF'}
              </span>
            </div>

            {/* Object Type */}
            <div style={{ marginBottom: '8px' }}>
              <span style={{ opacity: 0.7, fontSize: '12px' }}>Object: </span>
              <span style={{ 
                fontWeight: '600',
                background: 'rgba(33, 150, 243, 0.2)',
                padding: '2px 8px',
                borderRadius: '4px',
                fontSize: '12px',
              }}>
                {objectLabel(objectType)}
              </span>
            </div>

            {/* Speed */}
            <div style={{ marginBottom: '8px' }}>
              <span style={{ opacity: 0.7, fontSize: '12px' }}>Speed: </span>
              <span style={{ fontWeight: '600', fontFamily: 'monospace' }}>
                {rotationSpeed.toFixed(3)}
              </span>
              <div style={{ 
                width: '100%', 
                height: '4px', 
                background: 'rgba(255,255,255,0.1)',
                borderRadius: '2px',
                marginTop: '4px',
                overflow: 'hidden',
              }}>
                <div style={{ 
                  width: `${(rotationSpeed / 0.1) * 100}%`,
                  height: '100%',
                  background: 'linear-gradient(90deg, #FF6B6B, #4ECDC4)',
                  transition: 'width 0.3s ease',
                }} />
              </div>
            </div>

            {/* Last Gesture */}
            <div style={{ marginTop: '12px', paddingTop: '12px', borderTop: '1px solid rgba(255,255,255,0.1)' }}>
              <span style={{ opacity: 0.7, fontSize: '12px' }}>Detected: </span>
              {lastGesture ? (
                <span style={{ 
                  fontWeight: '600',
                  color: lastScore && lastScore > 0.7 ? '#4CAF50' : '#FFC107',
                }}>
                  {lastGesture} ({lastScore ? (lastScore * 100).toFixed(0) : 0}%)
                </span>
              ) : (
                <span style={{ opacity: 0.5, fontStyle: 'italic' }}>Waiting...</span>
              )}
            </div>
          </div>
        </div>
      )}

      {error && (
        <div
          style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            background: 'rgba(200,0,0,0.9)',
            color: '#fff',
            padding: '20px',
            borderRadius: '8px',
            maxWidth: '500px',
          }}
        >
          <strong>Error:</strong> {error}
        </div>
      )}

      {!cameraReady && !error && !needsUserClick && (
        <div
          style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            color: '#fff',
            fontSize: '18px',
            textAlign: 'center',
          }}
        >
          <div>{loadingStatus}</div>
          <div style={{ fontSize: '14px', marginTop: '10px', opacity: 0.7 }}>
            Please wait, downloading AI model...
          </div>
        </div>
      )}

      {needsUserClick && (
        <div
          style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            textAlign: 'center',
          }}
        >
          <button
            onClick={async () => {
              const video = videoRef.current;
              if (video && video.srcObject) {
                try {
                  await video.play();
                  setNeedsUserClick(false);
                  setCameraReady(true);
                  setLoadingStatus('Ready!');
                } catch (e) {
                  setError('Failed to start video: ' + (e as Error).message);
                }
              }
            }}
            style={{
              padding: '15px 30px',
              fontSize: '18px',
              background: '#4CAF50',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              cursor: 'pointer',
            }}
          >
            Click to Start Camera
          </button>
        </div>
      )}
    </div>
  );
}
