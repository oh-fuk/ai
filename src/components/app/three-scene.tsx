"use client";

import { Suspense, useRef, useMemo } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Stars, Environment, Sphere, MeshDistortMaterial } from "@react-three/drei";
import * as THREE from "three";

/* ── Slowly rotating galaxy ring of particles ── */
function GalaxyRing() {
    const ref = useRef<THREE.Points>(null);

    const { positions, colors } = useMemo(() => {
        const count = 3000;
        const pos = new Float32Array(count * 3);
        const col = new Float32Array(count * 3);
        const colorInner = new THREE.Color("#38bdf8"); // cyan
        const colorOuter = new THREE.Color("#818cf8"); // indigo

        for (let i = 0; i < count; i++) {
            const radius = Math.random() * 7 + 1.5;
            const spinAngle = radius * 2.5;
            const branchAngle = ((i % 3) / 3) * Math.PI * 2;
            const scatter = Math.pow(Math.random(), 3);
            const sx = (Math.random() - 0.5) * scatter * 2;
            const sy = (Math.random() - 0.5) * scatter * 0.4;
            const sz = (Math.random() - 0.5) * scatter * 2;

            pos[i * 3] = Math.cos(branchAngle + spinAngle) * radius + sx;
            pos[i * 3 + 1] = sy;
            pos[i * 3 + 2] = Math.sin(branchAngle + spinAngle) * radius + sz;

            const mixed = new THREE.Color().lerpColors(colorInner, colorOuter, radius / 9);
            col[i * 3] = mixed.r;
            col[i * 3 + 1] = mixed.g;
            col[i * 3 + 2] = mixed.b;
        }
        return { positions: pos, colors: col };
    }, []);

    const geo = useMemo(() => {
        const g = new THREE.BufferGeometry();
        g.setAttribute("position", new THREE.BufferAttribute(positions, 3));
        g.setAttribute("color", new THREE.BufferAttribute(colors, 3));
        return g;
    }, [positions, colors]);

    useFrame((state) => {
        if (ref.current) {
            ref.current.rotation.y = state.clock.elapsedTime * 0.06;
            ref.current.rotation.x = Math.sin(state.clock.elapsedTime * 0.05) * 0.08;
        }
    });

    return (
        <points ref={ref} geometry={geo}>
            <pointsMaterial
                size={0.04}
                vertexColors
                transparent
                opacity={0.85}
                sizeAttenuation
                depthWrite={false}
            />
        </points>
    );
}

/* ── Glowing distorted orb (brain / AI core) ── */
function CoreOrb() {
    const meshRef = useRef<THREE.Mesh>(null);

    useFrame((state) => {
        if (meshRef.current) {
            meshRef.current.rotation.y = state.clock.elapsedTime * 0.15;
            meshRef.current.rotation.z = state.clock.elapsedTime * 0.08;
        }
    });

    return (
        <group position={[0, 0, 0]}>
            {/* outer glow halo */}
            <Sphere args={[1.45, 32, 32]} ref={meshRef}>
                <MeshDistortMaterial
                    color="#0ea5e9"
                    emissive="#0369a1"
                    emissiveIntensity={1.2}
                    distort={0.45}
                    speed={2.5}
                    transparent
                    opacity={0.18}
                    depthWrite={false}
                />
            </Sphere>
            {/* inner solid core */}
            <Sphere args={[0.9, 64, 64]}>
                <MeshDistortMaterial
                    color="#38bdf8"
                    emissive="#0284c7"
                    emissiveIntensity={0.9}
                    distort={0.3}
                    speed={2}
                    metalness={0.4}
                    roughness={0.1}
                />
            </Sphere>
        </group>
    );
}

/* ── Small floating orbs drifting around ── */
function FloatingOrbs() {
    const group = useRef<THREE.Group>(null);

    const orbs = useMemo(() =>
        Array.from({ length: 12 }, (_, i) => ({
            position: [
                Math.cos((i / 12) * Math.PI * 2) * (3.5 + Math.random() * 2),
                (Math.random() - 0.5) * 3,
                Math.sin((i / 12) * Math.PI * 2) * (3.5 + Math.random() * 2),
            ] as [number, number, number],
            scale: 0.06 + Math.random() * 0.1,
            speed: 0.3 + Math.random() * 0.4,
            offset: Math.random() * Math.PI * 2,
            color: i % 2 === 0 ? "#38bdf8" : "#818cf8",
        })), []);

    useFrame((state) => {
        if (group.current) {
            group.current.children.forEach((child, i) => {
                const orb = orbs[i];
                child.position.y = orbs[i].position[1] +
                    Math.sin(state.clock.elapsedTime * orb.speed + orb.offset) * 0.5;
            });
            group.current.rotation.y = state.clock.elapsedTime * 0.04;
        }
    });

    return (
        <group ref={group}>
            {orbs.map((orb, i) => (
                <mesh key={i} position={orb.position} scale={orb.scale}>
                    <sphereGeometry args={[1, 16, 16]} />
                    <meshStandardMaterial
                        color={orb.color}
                        emissive={orb.color}
                        emissiveIntensity={2}
                        transparent
                        opacity={0.9}
                    />
                </mesh>
            ))}
        </group>
    );
}

/* ── Drifting dust particles ── */
function DustParticles() {
    const ref = useRef<THREE.Points>(null);

    const positions = useMemo(() => {
        const count = 400;
        const arr = new Float32Array(count * 3);
        for (let i = 0; i < count; i++) {
            arr[i * 3] = (Math.random() - 0.5) * 22;
            arr[i * 3 + 1] = (Math.random() - 0.5) * 12;
            arr[i * 3 + 2] = (Math.random() - 0.5) * 22;
        }
        return arr;
    }, []);

    const geo = useMemo(() => {
        const g = new THREE.BufferGeometry();
        g.setAttribute("position", new THREE.BufferAttribute(positions, 3));
        return g;
    }, [positions]);

    useFrame((state) => {
        if (ref.current) {
            ref.current.rotation.y = state.clock.elapsedTime * 0.02;
            ref.current.rotation.x = state.clock.elapsedTime * 0.01;
        }
    });

    return (
        <points ref={ref} geometry={geo}>
            <pointsMaterial size={0.025} color="#e0f2fe" transparent opacity={0.4} sizeAttenuation depthWrite={false} />
        </points>
    );
}

/* ── Main export ── */
export default function ThreeScene() {
    return (
        <Canvas camera={{ position: [0, 2.5, 9], fov: 55 }}>
            <Suspense fallback={null}>
                <ambientLight intensity={0.3} />
                <pointLight position={[5, 5, 5]} intensity={3} color="#38bdf8" />
                <pointLight position={[-5, -3, -5]} intensity={1.5} color="#818cf8" />
                <pointLight position={[0, 0, 0]} intensity={2} color="#0ea5e9" />

                <GalaxyRing />
                <CoreOrb />
                <FloatingOrbs />
                <DustParticles />
                <Stars radius={80} depth={60} count={4000} factor={3} saturation={0.3} fade speed={0.8} />

                <Environment preset="night" />
            </Suspense>
        </Canvas>
    );
}
