"use client";

import { Suspense, useRef, useMemo } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Stars, Environment } from "@react-three/drei";
import * as THREE from "three";

function Ocean() {
    const materialRef = useRef<THREE.ShaderMaterial>(null);

    const vertexShader = `
    uniform float uTime;
    varying vec2 vUv;
    varying float vElevation;
    void main() {
      vUv = uv;
      vec3 pos = position;
      float elevation = sin(pos.x * 2.0 + uTime) * 0.2;
      elevation += sin(pos.y * 3.0 + uTime * 0.8) * 0.2;
      elevation += sin((pos.x + pos.y) * 1.5 + uTime * 1.2) * 0.1;
      pos.z += elevation;
      vElevation = elevation;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
    }
  `;

    const fragmentShader = `
    uniform float uTime;
    varying vec2 vUv;
    varying float vElevation;
    void main() {
      vec3 deepColor = vec3(0.0, 0.2, 0.4);
      vec3 surfaceColor = vec3(0.0, 0.6, 0.8);
      vec3 foamColor = vec3(0.8, 0.9, 1.0);
      float mixStrength = (vElevation + 0.5) * 0.8;
      vec3 color = mix(deepColor, surfaceColor, mixStrength);
      if (vElevation > 0.35) color = mix(color, foamColor, (vElevation - 0.35) * 3.0);
      gl_FragColor = vec4(color, 0.85);
    }
  `;

    useFrame((state) => {
        if (materialRef.current)
            materialRef.current.uniforms.uTime.value = state.clock.elapsedTime;
    });

    return (
        <mesh rotation={[-Math.PI / 2.5, 0, 0]} position={[0, -2, 0]}>
            <planeGeometry args={[30, 30, 128, 128]} />
            <shaderMaterial
                ref={materialRef}
                vertexShader={vertexShader}
                fragmentShader={fragmentShader}
                uniforms={{ uTime: { value: 0 } }}
                transparent
                side={THREE.DoubleSide}
            />
        </mesh>
    );
}

function FloatingParticles() {
    const ref = useRef<THREE.Points>(null);
    const count = 200;
    const positions = useMemo(() => {
        const arr = new Float32Array(count * 3);
        for (let i = 0; i < count; i++) {
            arr[i * 3] = (Math.random() - 0.5) * 20;
            arr[i * 3 + 1] = (Math.random() - 0.5) * 10;
            arr[i * 3 + 2] = (Math.random() - 0.5) * 20;
        }
        return arr;
    }, []);

    useFrame((state) => {
        if (ref.current) {
            ref.current.rotation.y = state.clock.elapsedTime * 0.05;
            ref.current.rotation.x = Math.sin(state.clock.elapsedTime * 0.1) * 0.1;
        }
    });

    const geo = useMemo(() => {
        const g = new THREE.BufferGeometry();
        g.setAttribute("position", new THREE.BufferAttribute(positions, 3));
        return g;
    }, [positions]);

    return (
        <points ref={ref} geometry={geo}>
            <pointsMaterial size={0.05} color="#00d4ff" transparent opacity={0.6} sizeAttenuation />
        </points>
    );
}

export default function ThreeScene() {
    return (
        <Canvas camera={{ position: [0, 2, 8], fov: 60 }}>
            <Suspense fallback={null}>
                <ambientLight intensity={0.5} />
                <pointLight position={[10, 10, 10]} intensity={1} color="#00d4ff" />
                <pointLight position={[-10, -10, -10]} intensity={0.5} color="#0066ff" />
                <Ocean />
                <FloatingParticles />
                <Stars radius={100} depth={50} count={5000} factor={4} saturation={0} fade speed={1} />
                <Environment preset="night" />
            </Suspense>
        </Canvas>
    );
}
