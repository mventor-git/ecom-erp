import { Suspense, useRef, useEffect, Component } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { useGLTF, useAnimations } from '@react-three/drei';
import * as THREE from 'three';

/**
 * WelcomeModel3D — admin-configurable 3D showcase for the welcome page.
 *
 * Settings (all public, edited in Admin → Welcome Slides → 3D Showcase):
 *   welcome_3d_enabled  — master switch
 *   welcome_3d_model_url— .glb/.gltf URL (uploaded via Admin upload)
 *   welcome_3d_motion   — float | spin | none  (idle motion preset)
 *   welcome_3d_clip     — which animation clip inside the .glb plays ('' = first)
 *   welcome_3d_scale    — scale multiplier
 *   welcome_3d_speed    — animation/motion speed multiplier
 *
 * Renders nothing when disabled or unconfigured; a bad model file is swallowed
 * by the error boundary so the page never breaks.
 */

class SilentErrorBoundary extends Component {
  constructor(props) { super(props); this.state = { failed: false }; }
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch(err) { console.warn('3D showcase failed:', err?.message); }
  render() { return this.state.failed ? null : this.props.children; }
}

function Model({ url, motion, clip, scale, speed }) {
  const group = useRef();
  const { scene, animations } = useGLTF(url);
  const { actions } = useAnimations(animations, group);
  const clockRef = useRef(0);

  // Play an embedded clip when available/requested
  useEffect(() => {
    const names = Object.keys(actions || {});
    if (names.length === 0) return;
    const pick = clip && actions[clip] ? clip : names[0];
    if (motion !== 'none' || clip) {
      const action = actions[pick];
      action.reset().fadeIn(0.4).play();
      action.timeScale = Math.max(speed || 1, 0.1);
      return () => action.fadeOut(0.3);
    }
  }, [actions, clip, motion, speed]);

  // Idle motion presets (float / spin) + gentle mouse parallax
  useFrame((state, delta) => {
    const g = group.current;
    if (!g) return;
    clockRef.current += delta * Math.max(speed || 1, 0.1);
    const t = clockRef.current;
    if (motion === 'float') {
      g.position.y = Math.sin(t * 1.2) * 0.12;
      g.rotation.y = Math.sin(t * 0.35) * 0.35 + state.pointer.x * 0.15;
      g.rotation.x = state.pointer.y * -0.08;
    } else if (motion === 'spin') {
      g.rotation.y = t * 0.8;
    } else {
      // none — parallax only, keeps the scene alive without motion sickness
      g.rotation.y += (state.pointer.x * 0.25 - g.rotation.y) * 0.02;
    }
  });

  // Center & frame whatever was loaded
  useEffect(() => {
    if (!scene) return;
    const box = new THREE.Box3().setFromObject(scene);
    const center = box.getCenter(new THREE.Vector3());
    scene.position.sub(center);
  }, [scene]);

  return (
    <group ref={group} scale={scale || 1}>
      <primitive object={scene} />
    </group>
  );
}

export default function WelcomeModel3D({ enabled, modelUrl, motion, clip, scale, speed }) {
  if (!enabled || !modelUrl) return null;

  return (
    <div className="pointer-events-none absolute inset-0 z-10" aria-hidden="true">
      <SilentErrorBoundary>
        <Canvas
          camera={{ position: [0, 0.4, 4.2], fov: 42 }}
          dpr={[1, 2]}
          gl={{ alpha: true, antialias: true }}
          style={{ background: 'transparent' }}
        >
          {/* Studio lighting — no external HDR dependency */}
          <ambientLight intensity={0.7} />
          <directionalLight position={[3, 5, 4]} intensity={1.6} />
          <directionalLight position={[-4, -2, -3]} intensity={0.5} color="#e9c46a" />
          <spotLight position={[0, 6, 2]} angle={0.5} penumbra={1} intensity={1.1} />

          <Suspense fallback={null}>
            <group position={[1.6, 0, 0]}>   {/* right side on desktop */}
              <Model url={modelUrl} motion={motion} clip={clip} scale={scale} speed={speed} />
            </group>
          </Suspense>
        </Canvas>
      </SilentErrorBoundary>
    </div>
  );
}
