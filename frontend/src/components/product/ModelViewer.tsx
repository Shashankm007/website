'use client';

import { Component, Suspense, useMemo, useState, type ReactNode } from 'react';
import * as THREE from 'three';
import { Canvas, useLoader } from '@react-three/fiber';
import { Center, Html, OrbitControls, Stage } from '@react-three/drei';
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader.js';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js';
import { AlertTriangle, Rotate3d } from 'lucide-react';

type ModelKind = 'stl' | 'obj' | 'unknown';

function kindFromUrl(url: string): ModelKind {
  // Strip query/hash before checking the extension.
  const clean = url.split(/[?#]/)[0].toLowerCase();
  if (clean.endsWith('.stl')) return 'stl';
  if (clean.endsWith('.obj')) return 'obj';
  return 'unknown';
}

/** Loads + renders an STL file using a neutral standard material. */
function StlMesh({ url }: { url: string }) {
  const geometry = useLoader(STLLoader, url);

  const prepared = useMemo(() => {
    const geo = geometry.clone();
    geo.computeVertexNormals();
    geo.center();
    return geo;
  }, [geometry]);

  return (
    <mesh geometry={prepared} castShadow receiveShadow>
      <meshStandardMaterial color="#94a3b8" roughness={0.55} metalness={0.1} />
    </mesh>
  );
}

/** Loads + renders an OBJ file (keeps its own materials/normals). */
function ObjMesh({ url }: { url: string }) {
  const object = useLoader(OBJLoader, url);

  const prepared = useMemo(() => {
    const root = object.clone();
    root.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        child.castShadow = true;
        child.receiveShadow = true;
        if (!child.material) {
          child.material = new THREE.MeshStandardMaterial({ color: '#94a3b8', roughness: 0.55, metalness: 0.1 });
        }
      }
    });
    return root;
  }, [object]);

  return <primitive object={prepared} />;
}

function Loading() {
  return (
    <Html center>
      <div className="flex items-center gap-2 rounded-lg bg-white/90 px-3 py-2 text-sm text-slate-600 shadow-card">
        <Rotate3d className="h-4 w-4 animate-spin text-brand-600" />
        Loading 3D model…
      </div>
    </Html>
  );
}

function ErrorOverlay({ message }: { message: string }) {
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-slate-50 px-6 text-center">
      <AlertTriangle className="h-8 w-8 text-amber-500" />
      <p className="text-sm font-medium text-slate-700">{message}</p>
    </div>
  );
}

/**
 * Interactive 3D preview for STL/OBJ product models. Must be loaded via
 * next/dynamic with `{ ssr: false }` (it relies on WebGL / browser APIs).
 */
export default function ModelViewer({ url }: { url: string }) {
  const [hasError, setHasError] = useState(false);
  const kind = useMemo(() => kindFromUrl(url), [url]);

  if (kind === 'unknown') {
    return (
      <div className="relative aspect-square w-full overflow-hidden rounded-2xl bg-slate-50">
        <ErrorOverlay message="This 3D format can't be previewed." />
      </div>
    );
  }

  return (
    <div className="relative aspect-square w-full overflow-hidden rounded-2xl bg-slate-50">
      {hasError && <ErrorOverlay message="We couldn't load this 3D model." />}
      {!hasError && (
        <Canvas
          shadows
          dpr={[1, 2]}
          camera={{ position: [0, 0, 4], fov: 45 }}
          onError={() => setHasError(true)}
        >
          <color attach="background" args={['#f8fafc']} />
          <Suspense fallback={<Loading />}>
            <ErrorBoundary onError={() => setHasError(true)}>
              <Stage environment="city" intensity={0.5} adjustCamera shadows="contact">
                <Center>{kind === 'stl' ? <StlMesh url={url} /> : <ObjMesh url={url} />}</Center>
              </Stage>
            </ErrorBoundary>
          </Suspense>
          <OrbitControls makeDefault enablePan={false} minDistance={1.5} maxDistance={10} />
        </Canvas>
      )}
      {!hasError && (
        <div className="pointer-events-none absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full bg-white/85 px-3 py-1 text-xs text-slate-500 shadow-card">
          Drag to rotate · scroll to zoom
        </div>
      )}
    </div>
  );
}

/**
 * Minimal error boundary so a failed loader (network / parse error) surfaces a
 * friendly message instead of crashing the Canvas tree.
 */
class ErrorBoundary extends Component<{ children: ReactNode; onError: () => void }, { errored: boolean }> {
  state = { errored: false };

  static getDerivedStateFromError() {
    return { errored: true };
  }

  componentDidCatch() {
    this.props.onError();
  }

  render() {
    if (this.state.errored) return null;
    return this.props.children;
  }
}
