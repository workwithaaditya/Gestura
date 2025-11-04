'use client';

import { useEffect, useRef, useState } from 'react';
import { GestureRecognizer, FilesetResolver, GestureRecognizerResult } from '@mediapipe/tasks-vision';
import * as THREE from 'three';

type ObjectType = 'sphere' | 'cube';

export default function Home() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [cameraReady, setCameraReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Gesture state
  const [rotationActive, setRotationActive] = useState(false);
  const [rotationSpeed, setRotationSpeed] = useState(0.02);
  const [activeAxis, setActiveAxis] = useState(0); // 0:X, 1:Y, 2:Z
  const [objectType, setObjectType] = useState<ObjectType>('sphere');
  const [lastGesture, setLastGesture] = useState<string | null>(null);

  // Three.js refs (preserve across renders)
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraThreeRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const meshRef = useRef<THREE.Mesh | null>(null);
  const recognizerRef = useRef<GestureRecognizer | null>(null);

  const gestureCooldownRef = useRef(0);
  const gestureHoldFramesRef = useRef(0);
  const lastGestureNameRef = useRef<string | null>(null);

  useEffect(() => {
    let stream: MediaStream | null = null;
    let animationFrameId: number;

    async function init() {
      try {
        // 1) Setup camera
        const video = videoRef.current;
        if (!video) return;

        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } });
        video.srcObject = stream;
        video.autoplay = true;
        video.playsInline = true;
        await video.play();
        setCameraReady(true);

        // 2) Setup MediaPipe GestureRecognizer
        const vision = await FilesetResolver.forVisionTasks(
          'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.8/wasm'
        );
        const recognizer = await GestureRecognizer.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath: '/models/gesture_recognizer.task',
          },
          runningMode: 'VIDEO',
          numHands: 2,
        });
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

        // Initial object (sphere)
        const geometry = new THREE.SphereGeometry(1, 32, 16);
        const material = new THREE.MeshStandardMaterial({ color: 0x66a3ff });
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
        function loop() {
          // Gesture recognition
          if (recognizerRef.current && video.readyState >= 2) {
            const now = performance.now();
            const result = recognizerRef.current.recognizeForVideo(video, now);
            processGestures(result);
          }

          // Rotation
          if (rotationActive && meshRef.current) {
            if (activeAxis === 0) meshRef.current.rotation.x += rotationSpeed;
            if (activeAxis === 1) meshRef.current.rotation.y += rotationSpeed;
            if (activeAxis === 2) meshRef.current.rotation.z += rotationSpeed;
          }

          // Render
          if (rendererRef.current && sceneRef.current && cameraThreeRef.current) {
            rendererRef.current.render(sceneRef.current, cameraThreeRef.current);
          }

          animationFrameId = requestAnimationFrame(loop);
        }
        loop();
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        console.error('Initialization error:', err);
        setError(`Failed to initialize: ${message}`);
      }
    }

    init();

    return () => {
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
  }, [rotationActive, rotationSpeed, activeAxis]);

  // Switch object geometry when objectType changes
  useEffect(() => {
    if (!meshRef.current || !sceneRef.current) return;
    const mesh = meshRef.current;
    mesh.geometry.dispose();
    if (objectType === 'sphere') {
      mesh.geometry = new THREE.SphereGeometry(1, 32, 16);
    } else {
      mesh.geometry = new THREE.BoxGeometry(2, 2, 2);
    }
  }, [objectType]);

  function processGestures(result: GestureRecognizerResult) {
    if (gestureCooldownRef.current > 0) {
      gestureCooldownRef.current--;
    }

    let currentGesture: string | null = null;
    if (result.gestures && result.gestures.length > 0) {
      const topGesture = result.gestures[0][0];
      if (topGesture && topGesture.score > 0.7) {
        currentGesture = topGesture.categoryName;
      }
    }

    if (currentGesture && currentGesture === lastGestureNameRef.current) {
      gestureHoldFramesRef.current++;
    } else {
      gestureHoldFramesRef.current = 0;
    }

    if (currentGesture && gestureHoldFramesRef.current > 5 && gestureCooldownRef.current === 0) {
      gestureCooldownRef.current = 10;
      handleGestureAction(currentGesture);
      setLastGesture(currentGesture);
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
        console.log('Reset rotations');
        break;
      case 'Closed_Fist':
        setRotationActive((prev) => !prev);
        console.log('Toggled rotation');
        break;
      case 'Victory':
        setObjectType((prev) => (prev === 'sphere' ? 'cube' : 'sphere'));
        console.log('Switched object');
        break;
      case 'Pointing_Up':
        setActiveAxis((prev) => (prev + 1) % 3);
        console.log('Switched axis');
        break;
      case 'Thumb_Up':
        setRotationSpeed((prev) => Math.min(prev + 0.005, 0.1));
        console.log('Increased speed');
        break;
      case 'Thumb_Down':
        setRotationSpeed((prev) => Math.max(prev - 0.005, 0.005));
        console.log('Decreased speed');
        break;
      default:
        break;
    }
  }

  return (
    <div style={{ position: 'relative', width: '100vw', height: '100vh', overflow: 'hidden', background: '#111' }}>
      {/* Hidden video for MediaPipe input */}
      <video ref={videoRef} style={{ display: 'none' }} />

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

      {/* Overlay UI */}
      {cameraReady && (
        <div
          style={{
            position: 'absolute',
            top: 10,
            left: 10,
            background: 'rgba(0,0,0,0.5)',
            color: '#fff',
            padding: '10px',
            borderRadius: '4px',
            fontSize: '13px',
            fontFamily: 'monospace',
            maxWidth: '420px',
          }}
        >
          <div style={{ fontWeight: 'bold', marginBottom: '6px' }}>Gesture Help</div>
          <div>Open_Palm: Reset | Closed_Fist: Toggle rotation</div>
          <div>Victory: Switch object | Pointing_Up: Cycle X/Y/Z</div>
          <div>Thumb_Up: Speed+ | Thumb_Down: Speed-</div>
          <div style={{ marginTop: '6px', borderTop: '1px solid #666', paddingTop: '6px' }}>
            State: rot={rotationActive ? 'ON' : 'OFF'} | speed={rotationSpeed.toFixed(3)} | axis=
            {['X', 'Y', 'Z'][activeAxis]} | last={lastGesture || '-'}
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

      {!cameraReady && !error && (
        <div
          style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            color: '#fff',
            fontSize: '18px',
          }}
        >
          Initializing camera and gesture recognizer...
        </div>
      )}
    </div>
  );
}
