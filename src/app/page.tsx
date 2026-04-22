"use client";

import { useState, useEffect, useRef } from "react";
import dynamic from "next/dynamic";
import { motion, AnimatePresence } from "framer-motion";
import {
  BookOpen, Brain, FileText, Clock, Music, FileSearch,
  PenTool, Calendar, BarChart3, FileCheck, BookCopy,
  SpellCheck, MessageCircle, ChevronRight, Play, X, Menu,
  Sparkles, Zap, Users, Volume2, Globe, CheckCircle,
} from "lucide-react";
import Link from "next/link";
import { AthenaLogo } from "@/components/app/logo";
import schoolLogo from "@/LOGO/college.png";
import Image from "next/image";

// Load 3D scene only on client — avoids SSR crash with React 19
const ThreeScene = dynamic(() => import("@/components/app/three-scene"), { ssr: false });

/* ─── Background Music ───────────────────────────────────────────────────── */
function BackgroundMusic() {
  const [isPlaying, setIsPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    audioRef.current = new Audio(
      "https://cdn.pixabay.com/download/audio/2022/05/27/audio_1808fbf07a.mp3?filename=ocean-waves-112906.mp3"
    );
    audioRef.current.loop = true;
    audioRef.current.volume = 0.3;
    return () => { audioRef.current?.pause(); };
  }, []);

  const toggle = () => {
    if (!audioRef.current) return;
    if (isPlaying) audioRef.current.pause();
    else audioRef.current.play().catch(() => { });
    setIsPlaying(!isPlaying);
  };

  return (
    <motion.button
      whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}
      onClick={toggle}
      className="fixed bottom-6 left-6 z-50 w-14 h-14 rounded-full bg-gradient-to-r from-cyan-500 to-blue-600
                 shadow-lg shadow-cyan-500/30 flex items-center justify-center text-white border border-white/20"
    >
      {isPlaying ? <Volume2 className="w-6 h-6 animate-pulse" /> : <Play className="w-6 h-6" />}
    </motion.button>
  );
}

/* ─── 3D Ocean ───────────────────────────────────────────────────────────── */
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

/* ─── Floating Particles ─────────────────────────────────────────────────── */
function FloatingParticles() {
  const ref = useRef<THREE.Points>(null);
  const count = 200;
  const positions = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    positions[i * 3] = (Math.random() - 0.5) * 20;
    positions[i * 3 + 1] = (Math.random() - 0.5) * 10;
    positions[i * 3 + 2] = (Math.random() - 0.5) * 20;
  }
  useFrame((state) => {
    if (ref.current) {
      ref.current.rotation.y = state.clock.elapsedTime * 0.05;
      ref.current.rotation.x = Math.sin(state.clock.elapsedTime * 0.1) * 0.1;
    }
  });
  return (
    <points ref={ref}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" count={count} array={positions} itemSize={3} />
      </bufferGeometry>
      <pointsMaterial size={0.05} color="#00d4ff" transparent opacity={0.6} sizeAttenuation />
    </points>
  );
}

/* ─── Feature Card ───────────────────────────────────────────────────────── */
function FeatureCard({ icon: Icon, title, description, delay, color }: {
  icon: React.ElementType; title: string; description: string; delay: number; color: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 50 }} whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }} transition={{ duration: 0.5, delay }}
      whileHover={{ y: -8, scale: 1.02 }} className="relative group"
    >
      <div className={`absolute inset-0 bg-gradient-to-r ${color} rounded-2xl blur-xl opacity-0 group-hover:opacity-30 transition-opacity duration-500`} />
      <div className="relative bg-white/5 backdrop-blur-lg border border-white/10 rounded-2xl p-6 h-full hover:border-white/30 transition-all duration-300 overflow-hidden">
        <div className={`w-12 h-12 rounded-xl bg-gradient-to-r ${color} flex items-center justify-center mb-4`}>
          <Icon className="w-6 h-6 text-white" />
        </div>
        <h3 className="text-lg font-bold text-white mb-2">{title}</h3>
        <p className="text-gray-400 text-sm leading-relaxed">{description}</p>
        <motion.div
          className="absolute bottom-0 left-0 h-0.5 bg-gradient-to-r from-transparent via-cyan-400/60 to-transparent"
          initial={{ width: "0%" }} whileHover={{ width: "100%" }} transition={{ duration: 0.4 }}
        />
      </div>
    </motion.div>
  );
}

/* ─── Page ───────────────────────────────────────────────────────────────── */
export default function LandingPage() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const fn = () => setScrolled(window.scrollY > 50);
    window.addEventListener("scroll", fn);
    return () => window.removeEventListener("scroll", fn);
  }, []);

  const features = [
    { icon: MessageCircle, title: "AI Chat", description: "Context-aware AI advisor that knows your study patterns and history.", color: "from-purple-500 to-pink-500" },
    { icon: Brain, title: "Quiz Generator", description: "Auto-generate quizzes from topics, PDFs, or your weakest subjects.", color: "from-blue-500 to-cyan-500" },
    { icon: FileText, title: "Paper Generator", description: "Full practice exam papers with MCQs, short & long questions.", color: "from-green-500 to-emerald-500" },
    { icon: Clock, title: "Pomodoro Timer", description: "Stay focused with customizable Pomodoro study sessions.", color: "from-orange-500 to-red-500" },
    { icon: Music, title: "Study Music", description: "Curated lo-fi and ambient music for deep focus.", color: "from-pink-500 to-rose-500" },
    { icon: FileSearch, title: "AI Summarizer", description: "Condense long documents into concise, easy-to-digest summaries.", color: "from-indigo-500 to-purple-500" },
    { icon: PenTool, title: "Writing Assistant", description: "AI helps with essays, emails, letters & applications.", color: "from-yellow-500 to-orange-500" },
    { icon: Calendar, title: "Study Planner", description: "AI-generated personalized study schedules from your syllabus.", color: "from-teal-500 to-cyan-500" },
    { icon: BarChart3, title: "Progress Tracker", description: "Visualize your academic growth with detailed charts.", color: "from-blue-600 to-indigo-600" },
    { icon: FileCheck, title: "Guess Paper", description: "Analyze past papers to predict future exam questions.", color: "from-red-500 to-pink-500" },
    { icon: BookCopy, title: "Notes Maker", description: "Generate structured student-style notes from any document.", color: "from-violet-500 to-purple-500" },
    { icon: SpellCheck, title: "Grammar Checker", description: "Check your writing for grammatical errors with explanations.", color: "from-emerald-500 to-green-500" },
  ];

  const stats = [
    { icon: Users, value: "50K+", label: "Active Students" },
    { icon: BookOpen, value: "1M+", label: "Questions Solved" },
    { icon: Zap, value: "99.9%", label: "Uptime" },
    { icon: Globe, value: "150+", label: "Countries" },
  ];

  return (
    <div className="min-h-screen bg-[#0a0a1a] text-white overflow-x-hidden">

      {/* ── Nav ── */}
      <motion.nav className={`fixed top-0 w-full z-40 transition-all duration-300 ${scrolled ? "bg-black/60 backdrop-blur-xl border-b border-white/10" : "bg-transparent"}`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-20">
            <motion.div className="flex items-center gap-3" whileHover={{ scale: 1.05 }}>
              <AthenaLogo className="h-10 w-10" />
              <span className="text-2xl font-bold bg-gradient-to-r from-cyan-400 to-blue-500 bg-clip-text text-transparent font-headline">AthenaAI</span>
            </motion.div>
            <div className="hidden md:flex items-center gap-8">
              {["Features", "About"].map((item) => (
                <motion.a key={item} href={`#${item.toLowerCase()}`} className="text-gray-300 hover:text-white transition-colors relative group" whileHover={{ y: -2 }}>
                  {item}
                  <span className="absolute -bottom-1 left-0 w-0 h-0.5 bg-cyan-400 group-hover:w-full transition-all duration-300" />
                </motion.a>
              ))}
            </div>
            <div className="hidden md:flex items-center gap-4">
              <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                <Link href="/login" className="px-6 py-2.5 rounded-full border border-white/20 text-white hover:bg-white/10 transition-all inline-block">Log In</Link>
              </motion.div>
              <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                <Link href="/register" className="px-6 py-2.5 rounded-full bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-medium shadow-lg shadow-cyan-500/25 inline-block">Sign Up Free</Link>
              </motion.div>
            </div>
            <button className="md:hidden text-white" onClick={() => setMenuOpen(!menuOpen)}>
              {menuOpen ? <X /> : <Menu />}
            </button>
          </div>
        </div>
        <AnimatePresence>
          {menuOpen && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}
              className="md:hidden bg-black/90 backdrop-blur-xl border-b border-white/10">
              <div className="px-4 py-6 space-y-4">
                {["Features", "About"].map((item) => (
                  <a key={item} href={`#${item.toLowerCase()}`} className="block text-gray-300 hover:text-white py-2">{item}</a>
                ))}
                <div className="pt-4 space-y-3">
                  <Link href="/login" className="block w-full py-3 rounded-full border border-white/20 text-white text-center">Log In</Link>
                  <Link href="/register" className="block w-full py-3 rounded-full bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-medium text-center">Sign Up Free</Link>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.nav>

      {/* ── Hero with 3D ── */}
      <section className="relative h-screen flex items-center justify-center overflow-hidden">
        <div className="absolute inset-0 z-0">
          <ThreeScene />
        </div>

        <div className="relative z-10 text-center px-4 max-w-5xl mx-auto">
          <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 1 }}>
            <motion.div className="flex items-center justify-center gap-6 mb-8"
              initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 0.3, type: "spring" }}>
              <Image src={schoolLogo} alt="IMCB G-10/4" width={80} height={80} className="rounded-full ring-2 ring-white/20 shadow-lg" />
              <AthenaLogo className="h-20 w-20 ring-2 ring-white/20 shadow-lg" />
            </motion.div>

            <motion.div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 border border-white/10 backdrop-blur-sm mb-8"
              initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 0.5, type: "spring" }}>
              <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
              <span className="text-sm text-gray-300">Powered by Gemini AI</span>
            </motion.div>

            <h1 className="text-5xl md:text-7xl lg:text-8xl font-bold mb-6 leading-tight font-headline">
              <span className="bg-gradient-to-r from-cyan-400 via-blue-500 to-purple-600 bg-clip-text text-transparent">Study Smarter</span>
              <br />
              <span className="text-white">Not Harder</span>
            </h1>

            <p className="text-xl md:text-2xl text-gray-400 mb-10 max-w-2xl mx-auto leading-relaxed">
              AthenaAI — your all-in-one AI study companion. 12+ powerful features to boost your academic performance.
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <motion.div whileHover={{ scale: 1.05, boxShadow: "0 0 40px rgba(6,182,212,0.4)" }} whileTap={{ scale: 0.95 }}>
                <Link href="/register" className="px-8 py-4 rounded-full bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-bold text-lg shadow-lg shadow-cyan-500/30 inline-flex items-center gap-2">
                  Get Started Free <ChevronRight className="w-5 h-5" />
                </Link>
              </motion.div>
              <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                <Link href="/login" className="px-8 py-4 rounded-full border border-white/20 text-white font-medium text-lg backdrop-blur-sm hover:bg-white/5 transition-all inline-flex items-center gap-2">
                  Log In
                </Link>
              </motion.div>
            </div>
          </motion.div>

          <motion.div className="absolute bottom-10 left-1/2 -translate-x-1/2"
            animate={{ y: [0, 10, 0] }} transition={{ repeat: Infinity, duration: 2 }}>
            <div className="w-6 h-10 rounded-full border-2 border-white/30 flex items-start justify-center p-2">
              <motion.div className="w-1.5 h-1.5 rounded-full bg-cyan-400" animate={{ y: [0, 12, 0] }} transition={{ repeat: Infinity, duration: 2 }} />
            </div>
          </motion.div>
        </div>
      </section>

      {/* ── Stats ── */}
      <section className="py-20">
        <div className="max-w-7xl mx-auto px-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            {stats.map((s, i) => (
              <motion.div key={i} initial={{ opacity: 0, scale: 0.5 }} whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }} transition={{ delay: i * 0.1 }} className="text-center">
                <div className="flex justify-center mb-4">
                  <div className="w-16 h-16 rounded-2xl bg-gradient-to-r from-cyan-500/20 to-blue-500/20 flex items-center justify-center border border-white/10">
                    <s.icon className="w-8 h-8 text-cyan-400" />
                  </div>
                </div>
                <div className="text-3xl md:text-4xl font-bold text-white mb-1">{s.value}</div>
                <div className="text-gray-400">{s.label}</div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Features ── */}
      <section id="features" className="py-24 relative">
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-blue-900/10 to-transparent" />
        <div className="max-w-7xl mx-auto px-4 relative z-10">
          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold mb-4 font-headline">
              <span className="bg-gradient-to-r from-cyan-400 to-blue-500 bg-clip-text text-transparent">12+ Powerful Features</span>
            </h2>
            <p className="text-gray-400 text-lg max-w-2xl mx-auto">Everything you need to excel, powered by Gemini AI</p>
          </motion.div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {features.map((f, i) => <FeatureCard key={i} {...f} delay={i * 0.04} />)}
          </div>
          <motion.div initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }} className="text-center mt-12">
            <div className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-white/5 border border-white/10">
              <Sparkles className="w-5 h-5 text-cyan-400" />
              <span className="text-gray-300">And more coming soon...</span>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="py-24 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-cyan-900/20 to-blue-900/20" />
        <div className="absolute top-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-cyan-500/50 to-transparent" />
        <div className="absolute bottom-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-blue-500/50 to-transparent" />
        <div className="max-w-4xl mx-auto px-4 text-center relative z-10">
          <motion.div initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}>
            <h2 className="text-4xl md:text-6xl font-bold mb-6 font-headline">
              Ready to Transform Your
              <span className="block bg-gradient-to-r from-cyan-400 to-blue-500 bg-clip-text text-transparent">Study Experience?</span>
            </h2>
            <p className="text-xl text-gray-400 mb-10 max-w-2xl mx-auto">Join students already studying smarter with AthenaAI. Start for free today.</p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <motion.div whileHover={{ scale: 1.05, boxShadow: "0 0 60px rgba(6,182,212,0.5)" }} whileTap={{ scale: 0.95 }}>
                <Link href="/register" className="px-10 py-5 rounded-full bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-bold text-xl shadow-xl shadow-cyan-500/30 inline-block">Start Free</Link>
              </motion.div>
              <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                <Link href="/login" className="px-10 py-5 rounded-full border border-white/20 text-white font-medium text-xl hover:bg-white/5 transition-all inline-block">Log In</Link>
              </motion.div>
            </div>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-6 text-sm text-gray-500">
              <span className="flex items-center gap-2"><CheckCircle className="w-4 h-4 text-green-400" /> No credit card</span>
              <span className="flex items-center gap-2"><CheckCircle className="w-4 h-4 text-green-400" /> Free forever plan</span>
              <span className="flex items-center gap-2"><CheckCircle className="w-4 h-4 text-green-400" /> Cancel anytime</span>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer id="about" className="py-12 border-t border-white/10 bg-black/30">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-3">
              <AthenaLogo className="h-8 w-8" />
              <span className="text-xl font-bold text-white font-headline">AthenaAI</span>
            </div>
            <div className="flex items-center gap-8 text-gray-400">
              <Link href="/login" className="hover:text-white transition-colors">Login</Link>
              <Link href="/register" className="hover:text-white transition-colors">Register</Link>
            </div>
            <div className="text-gray-500 text-sm">© {new Date().getFullYear()} AthenaAI. All rights reserved.</div>
          </div>
        </div>
      </footer>

      <BackgroundMusic />
    </div>
  );
}
