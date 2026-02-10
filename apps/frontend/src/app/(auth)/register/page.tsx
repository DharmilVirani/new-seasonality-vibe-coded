'use client';

import { useState, useEffect, useRef } from "react";
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuthStore } from '@/store/authStore';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Eye, EyeOff, Mail, UserPlus } from "lucide-react";
import toast from 'react-hot-toast';
import { LoadingOverlay } from '@/components/ui/loading';

interface PupilProps {
  size?: number;
  maxDistance?: number;
  pupilColor?: string;
  forceLookX?: number;
  forceLookY?: number;
}

const Pupil = ({
  size = 12,
  maxDistance = 5,
  pupilColor = "black",
  forceLookX,
  forceLookY
}: PupilProps) => {
  const [mouseX, setMouseX] = useState<number>(0);
  const [mouseY, setMouseY] = useState<number>(0);
  const pupilRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      setMouseX(e.clientX);
      setMouseY(e.clientY);
    };

    window.addEventListener("mousemove", handleMouseMove);

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
    };
  }, []);

  const calculatePupilPosition = () => {
    if (!pupilRef.current) return { x: 0, y: 0 };

    if (forceLookX !== undefined && forceLookY !== undefined) {
      return { x: forceLookX, y: forceLookY };
    }

    const pupil = pupilRef.current.getBoundingClientRect();
    const pupilCenterX = pupil.left + pupil.width / 2;
    const pupilCenterY = pupil.top + pupil.height / 2;

    const deltaX = mouseX - pupilCenterX;
    const deltaY = mouseY - pupilCenterY;
    const distance = Math.min(Math.sqrt(deltaX ** 2 + deltaY ** 2), maxDistance);

    const angle = Math.atan2(deltaY, deltaX);
    const x = Math.cos(angle) * distance;
    const y = Math.sin(angle) * distance;

    return { x, y };
  };

  const pupilPosition = calculatePupilPosition();

  return (
    <div
      ref={pupilRef}
      className="rounded-full"
      style={{
        width: `${size}px`,
        height: `${size}px`,
        backgroundColor: pupilColor,
        transform: `translate(${pupilPosition.x}px, ${pupilPosition.y}px)`,
        transition: 'transform 0.1s ease-out',
      }}
    />
  );
};

interface EyeBallProps {
  size?: number;
  pupilSize?: number;
  maxDistance?: number;
  eyeColor?: string;
  pupilColor?: string;
  isBlinking?: boolean;
  forceLookX?: number;
  forceLookY?: number;
}

const EyeBall = ({
  size = 48,
  pupilSize = 16,
  maxDistance = 10,
  eyeColor = "white",
  pupilColor = "black",
  isBlinking = false,
  forceLookX,
  forceLookY
}: EyeBallProps) => {
  const [mouseX, setMouseX] = useState<number>(0);
  const [mouseY, setMouseY] = useState<number>(0);
  const eyeRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      setMouseX(e.clientX);
      setMouseY(e.clientY);
    };

    window.addEventListener("mousemove", handleMouseMove);

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
    };
  }, []);

  const calculatePupilPosition = () => {
    if (!eyeRef.current) return { x: 0, y: 0 };

    if (forceLookX !== undefined && forceLookY !== undefined) {
      return { x: forceLookX, y: forceLookY };
    }

    const eye = eyeRef.current.getBoundingClientRect();
    const eyeCenterX = eye.left + eye.width / 2;
    const eyeCenterY = eye.top + eye.height / 2;

    const deltaX = mouseX - eyeCenterX;
    const deltaY = mouseY - eyeCenterY;
    const distance = Math.min(Math.sqrt(deltaX ** 2 + deltaY ** 2), maxDistance);

    const angle = Math.atan2(deltaY, deltaX);
    const x = Math.cos(angle) * distance;
    const y = Math.sin(angle) * distance;

    return { x, y };
  };

  const pupilPosition = calculatePupilPosition();

  return (
    <div
      ref={eyeRef}
      className="rounded-full flex items-center justify-center transition-all duration-150"
      style={{
        width: `${size}px`,
        height: isBlinking ? '2px' : `${size}px`,
        backgroundColor: eyeColor,
        overflow: 'hidden',
      }}
    >
      {!isBlinking && (
        <div
          className="rounded-full"
          style={{
            width: `${pupilSize}px`,
            height: `${pupilSize}px`,
            backgroundColor: pupilColor,
            transform: `translate(${pupilPosition.x}px, ${pupilPosition.y}px)`,
            transition: 'transform 0.1s ease-out',
          }}
        />
      )}
    </div>
  );
};

export default function RegisterPage() {
  const router = useRouter();
  const { register, isLoading } = useAuthStore();
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [mouseX, setMouseX] = useState<number>(0);
  const [mouseY, setMouseY] = useState<number>(0);
  const [isTealBlinking, setIsTealBlinking] = useState(false);
  const [isSlateBlinking, setIsSlateBlinking] = useState(false);
  const [isPinkBlinking, setIsPinkBlinking] = useState(false);
  const [isLimeBlinking, setIsLimeBlinking] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [isRedirecting, setIsRedirecting] = useState(false);

  // Unique animations for register page
  const [isWaving, setIsWaving] = useState(true); // Wave on page load
  const [isBouncing, setIsBouncing] = useState(false); // Bounce when typing
  const [isCelebrating, setIsCelebrating] = useState(false); // Celebrate when form is filled
  const [filledFields, setFilledFields] = useState(0);
  const [isPasswordFocused, setIsPasswordFocused] = useState(false); // Track if typing in password fields

  const tealRef = useRef<HTMLDivElement>(null);
  const slateRef = useRef<HTMLDivElement>(null);
  const pinkRef = useRef<HTMLDivElement>(null);
  const limeRef = useRef<HTMLDivElement>(null);

  // Mouse tracking
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      setMouseX(e.clientX);
      setMouseY(e.clientY);
    };
    window.addEventListener("mousemove", handleMouseMove);
    return () => window.removeEventListener("mousemove", handleMouseMove);
  }, []);

  // Calculate position for face tracking
  const calculatePosition = (ref: React.RefObject<HTMLDivElement | null>) => {
    if (!ref.current) return { faceX: 0, faceY: 0 };
    const rect = ref.current.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 3;
    const deltaX = mouseX - centerX;
    const deltaY = mouseY - centerY;
    const faceX = Math.max(-15, Math.min(15, deltaX / 20));
    const faceY = Math.max(-10, Math.min(10, deltaY / 30));
    return { faceX, faceY };
  };

  const tealPos = calculatePosition(tealRef);
  const slatePos = calculatePosition(slateRef);
  const pinkPos = calculatePosition(pinkRef);
  const limePos = calculatePosition(limeRef);

  // Wave animation on page load - characters wave hello
  useEffect(() => {
    const waveTimer = setTimeout(() => setIsWaving(false), 2500);
    return () => clearTimeout(waveTimer);
  }, []);

  // Bounce animation when user starts typing
  useEffect(() => {
    if (isTyping && !isBouncing) {
      setIsBouncing(true);
      const bounceTimer = setTimeout(() => setIsBouncing(false), 600);
      return () => clearTimeout(bounceTimer);
    }
  }, [isTyping]);

  // Track filled fields for celebration
  useEffect(() => {
    let count = 0;
    if (name.length > 0) count++;
    if (email.length > 0) count++;
    if (password.length > 0) count++;
    if (confirmPassword.length > 0) count++;
    setFilledFields(count);

    // Celebrate when all fields are filled
    if (count === 4 && !isCelebrating) {
      setIsCelebrating(true);
      const celebrateTimer = setTimeout(() => setIsCelebrating(false), 1500);
      return () => clearTimeout(celebrateTimer);
    }
  }, [name, email, password, confirmPassword]);

  // Blinking effects for all characters
  useEffect(() => {
    const scheduleBlink = (setter: (v: boolean) => void, minDelay: number, maxDelay: number) => {
      const getInterval = () => Math.random() * (maxDelay - minDelay) + minDelay;
      const blink = () => {
        const timeout = setTimeout(() => {
          setter(true);
          setTimeout(() => {
            setter(false);
            blink();
          }, 150);
        }, getInterval());
        return timeout;
      };
      return blink();
    };

    const t1 = scheduleBlink(setIsTealBlinking, 3000, 5000);
    const t2 = scheduleBlink(setIsSlateBlinking, 2500, 4500);
    const t3 = scheduleBlink(setIsPinkBlinking, 3500, 5500);
    const t4 = scheduleBlink(setIsLimeBlinking, 2800, 4800);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
      clearTimeout(t4);
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (password !== confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }

    console.log('Form submitted with data:', { name, email, password: '***' });
    console.log('API URL:', process.env.NEXT_PUBLIC_API_URL);

    try {
      console.log('Calling register function...');
      await register({ name, email, password });
      console.log('Register function completed successfully');
      toast.success('Account created successfully! Please login.');
      setIsRedirecting(true);
      router.push('/login');
    } catch (error: any) {
      setIsRedirecting(false);
      console.error('Registration error details:', {
        message: error.message,
        response: error.response?.data,
        status: error.response?.status,
        config: error.config
      });

      const message = error.response?.data?.error?.message ||
        error.response?.data?.message ||
        error.response?.data?.error ||
        error.message ||
        'Registration failed';
      toast.error(message);
    }
  };

  return (
    <div className="min-h-screen grid lg:grid-cols-2">
      {/* Loading Overlay */}
      <LoadingOverlay
        isVisible={isLoading || isRedirecting}
        text={isRedirecting ? "Redirecting to login..." : "Creating account..."}
      />

      {/* Left Content Section */}
      <div className="relative hidden lg:flex flex-col justify-between bg-gradient-to-br from-emerald-600/90 via-emerald-600 to-emerald-700/80 p-12 text-white">
        <div className="relative z-20">
          <div className="flex items-center gap-2 text-lg font-semibold">
            <div className="size-8 rounded-lg bg-white/10 backdrop-blur-sm flex items-center justify-center">
              <UserPlus className="size-4" />
            </div>
            <span>Seasonality SaaS</span>
          </div>
        </div>

        <div className="relative z-20 flex items-end justify-center h-[500px]">
          {/* Cartoon Characters with unique register page animations */}
          <div className="relative" style={{ width: '550px', height: '400px' }}>

            {/* Teal tall rectangle character - Back layer - WAVES on load */}
            <div
              ref={tealRef}
              className="absolute bottom-0 transition-all duration-500 ease-out"
              style={{
                left: '70px',
                width: '180px',
                height: '400px',
                backgroundColor: '#14B8A6',
                borderRadius: '10px 10px 0 0',
                zIndex: 1,
                transform: isCelebrating
                  ? 'rotate(-5deg) translateY(-20px)'
                  : isWaving
                    ? 'rotate(8deg)'
                    : isBouncing
                      ? 'translateY(-15px)'
                      : 'rotate(0deg)',
                transformOrigin: 'bottom center',
              }}
            >
              {/* Waving arm - only shows during wave */}
              {isWaving && (
                <div
                  className="absolute bg-[#0D9488] rounded-full animate-pulse"
                  style={{
                    right: '-30px',
                    top: '60px',
                    width: '50px',
                    height: '20px',
                    borderRadius: '10px',
                    transform: 'rotate(-30deg)',
                    animation: 'wave 0.4s ease-in-out infinite alternate',
                  }}
                />
              )}
              {/* Eyes */}
              <div
                className="absolute flex gap-8 transition-all duration-300 ease-out"
                style={{
                  left: isPasswordFocused && !showPassword ? '20px' : `${45 + tealPos.faceX}px`,
                  top: isPasswordFocused && !showPassword ? '60px' : `${40 + tealPos.faceY}px`,
                }}
              >
                <EyeBall
                  size={18}
                  pupilSize={7}
                  maxDistance={5}
                  eyeColor="white"
                  pupilColor="#2D2D2D"
                  isBlinking={isTealBlinking}
                  forceLookX={isPasswordFocused && !showPassword ? -4 : undefined}
                  forceLookY={isPasswordFocused && !showPassword ? -4 : undefined}
                />
                <EyeBall
                  size={18}
                  pupilSize={7}
                  maxDistance={5}
                  eyeColor="white"
                  pupilColor="#2D2D2D"
                  isBlinking={isTealBlinking}
                  forceLookX={isPasswordFocused && !showPassword ? -4 : undefined}
                  forceLookY={isPasswordFocused && !showPassword ? -4 : undefined}
                />
              </div>
              {/* Happy smile when celebrating */}
              {isCelebrating && (
                <div
                  className="absolute w-16 h-8 border-b-4 border-[#2D2D2D] rounded-b-full"
                  style={{ left: '55px', top: '75px' }}
                />
              )}
            </div>

            {/* Dark slate tall rectangle character - Middle layer - JUMPS when typing */}
            <div
              ref={slateRef}
              className="absolute bottom-0 transition-all duration-300 ease-out"
              style={{
                left: '240px',
                width: '120px',
                height: '310px',
                backgroundColor: '#334155',
                borderRadius: '8px 8px 0 0',
                zIndex: 2,
                transform: isCelebrating
                  ? 'translateY(-30px) scale(1.05)'
                  : isWaving
                    ? 'translateY(-10px)'
                    : isBouncing
                      ? 'translateY(-25px) scale(1.02)'
                      : 'translateY(0)',
                transformOrigin: 'bottom center',
              }}
            >
              {/* Eyes */}
              <div
                className="absolute flex gap-6 transition-all duration-300 ease-out"
                style={{
                  left: isPasswordFocused && !showPassword ? '10px' : `${26 + slatePos.faceX}px`,
                  top: isPasswordFocused && !showPassword ? '50px' : `${32 + slatePos.faceY}px`,
                }}
              >
                <EyeBall
                  size={16}
                  pupilSize={6}
                  maxDistance={4}
                  eyeColor="white"
                  pupilColor="#2D2D2D"
                  isBlinking={isSlateBlinking}
                  forceLookX={isPasswordFocused && !showPassword ? -4 : undefined}
                  forceLookY={isPasswordFocused && !showPassword ? -4 : undefined}
                />
                <EyeBall
                  size={16}
                  pupilSize={6}
                  maxDistance={4}
                  eyeColor="white"
                  pupilColor="#2D2D2D"
                  isBlinking={isSlateBlinking}
                  forceLookX={isPasswordFocused && !showPassword ? -4 : undefined}
                  forceLookY={isPasswordFocused && !showPassword ? -4 : undefined}
                />
              </div>
              {/* Excited eyebrows when bouncing */}
              {(isBouncing || isCelebrating) && (
                <>
                  <div className="absolute w-4 h-1 bg-white rounded-full" style={{ left: '26px', top: '24px', transform: 'rotate(-15deg)' }} />
                  <div className="absolute w-4 h-1 bg-white rounded-full" style={{ left: '58px', top: '24px', transform: 'rotate(15deg)' }} />
                </>
              )}
            </div>

            {/* Pink semi-circle character - Front left - WOBBLES happily */}
            <div
              ref={pinkRef}
              className="absolute bottom-0 transition-all duration-400 ease-out"
              style={{
                left: '0px',
                width: '240px',
                height: '200px',
                zIndex: 3,
                backgroundColor: '#F472B6',
                borderRadius: '120px 120px 0 0',
                transform: isCelebrating
                  ? 'rotate(5deg) scale(1.05)'
                  : isWaving
                    ? 'rotate(-5deg)'
                    : isBouncing
                      ? 'rotate(3deg)'
                      : 'rotate(0deg)',
                transformOrigin: 'bottom center',
              }}
            >
              {/* Eyes - just pupils */}
              <div
                className="absolute flex gap-8 transition-all duration-200 ease-out"
                style={{
                  left: isPasswordFocused && !showPassword ? '50px' : `${82 + (pinkPos.faceX || 0)}px`,
                  top: isPasswordFocused && !showPassword ? '70px' : `${90 + (pinkPos.faceY || 0)}px`,
                }}
              >
                <EyeBall
                  size={16}
                  pupilSize={6}
                  maxDistance={4}
                  eyeColor="white"
                  pupilColor="#2D2D2D"
                  isBlinking={isPinkBlinking}
                  forceLookX={isPasswordFocused && !showPassword ? -5 : undefined}
                  forceLookY={isPasswordFocused && !showPassword ? -4 : undefined}
                />
                <EyeBall
                  size={16}
                  pupilSize={6}
                  maxDistance={4}
                  eyeColor="white"
                  pupilColor="#2D2D2D"
                  isBlinking={isPinkBlinking}
                  forceLookX={isPasswordFocused && !showPassword ? -5 : undefined}
                  forceLookY={isPasswordFocused && !showPassword ? -4 : undefined}
                />
              </div>
              {/* Blush cheeks when celebrating */}
              {isCelebrating && (
                <>
                  <div className="absolute w-6 h-4 bg-[#F9A8D4] rounded-full opacity-60" style={{ left: '60px', top: '105px' }} />
                  <div className="absolute w-6 h-4 bg-[#F9A8D4] rounded-full opacity-60" style={{ left: '130px', top: '105px' }} />
                </>
              )}
            </div>

            {/* Lime tall rounded character - Front right - SWAYS side to side */}
            <div
              ref={limeRef}
              className="absolute bottom-0 transition-all duration-500 ease-out"
              style={{
                left: '310px',
                width: '140px',
                height: '230px',
                backgroundColor: '#A3E635',
                borderRadius: '70px 70px 0 0',
                zIndex: 4,
                transform: isCelebrating
                  ? 'rotate(-8deg) translateY(-15px)'
                  : isWaving
                    ? 'rotate(6deg)'
                    : isBouncing
                      ? 'rotate(-4deg)'
                      : 'rotate(0deg)',
                transformOrigin: 'bottom center',
              }}
            >
              {/* Eyes with white eyeballs */}
              <div
                className="absolute flex gap-6 transition-all duration-200 ease-out"
                style={{
                  left: isPasswordFocused && !showPassword ? '20px' : `${42 + (limePos.faceX || 0)}px`,
                  top: isPasswordFocused && !showPassword ? '55px' : `${40 + (limePos.faceY || 0)}px`,
                }}
              >
                <EyeBall
                  size={16}
                  pupilSize={6}
                  maxDistance={4}
                  eyeColor="white"
                  pupilColor="#2D2D2D"
                  isBlinking={isLimeBlinking}
                  forceLookX={isPasswordFocused && !showPassword ? -5 : undefined}
                  forceLookY={isPasswordFocused && !showPassword ? -4 : undefined}
                />
                <EyeBall
                  size={16}
                  pupilSize={6}
                  maxDistance={4}
                  eyeColor="white"
                  pupilColor="#2D2D2D"
                  isBlinking={isLimeBlinking}
                  forceLookX={isPasswordFocused && !showPassword ? -5 : undefined}
                  forceLookY={isPasswordFocused && !showPassword ? -4 : undefined}
                />
              </div>
              {/* Mouth - changes to smile when celebrating */}
              <div
                className={`absolute rounded-full transition-all duration-300 ${isCelebrating ? 'w-12 h-6 border-b-4 border-[#2D2D2D] bg-transparent rounded-b-full' : 'w-20 h-[4px] bg-[#2D2D2D]'}`}
                style={{
                  left: isCelebrating ? '44px' : `${40 + (limePos.faceX || 0)}px`,
                  top: `${88 + (limePos.faceY || 0)}px`,
                }}
              />
            </div>

            {/* Progress indicator - shows filled fields */}
            <div className="absolute -bottom-8 left-1/2 transform -translate-x-1/2 flex gap-2">
              {[0, 1, 2, 3].map((i) => (
                <div
                  key={i}
                  className={`w-2 h-2 rounded-full transition-all duration-300 ${i < filledFields ? 'bg-white scale-125' : 'bg-white/30'
                    }`}
                />
              ))}
            </div>
          </div>
        </div>

        <div className="relative z-20 flex items-center gap-8 text-sm text-white/60">
          <a href="#" className="hover:text-white transition-colors">
            Privacy Policy
          </a>
          <a href="#" className="hover:text-white transition-colors">
            Terms of Service
          </a>
          <a href="#" className="hover:text-white transition-colors">
            Contact
          </a>
        </div>

        {/* Decorative elements */}
        <div className="absolute inset-0 bg-grid-white/[0.05] bg-[size:20px_20px]" />
        <div className="absolute top-1/4 right-1/4 size-64 bg-white/10 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 left-1/4 size-96 bg-white/5 rounded-full blur-3xl" />

        {/* Wave animation keyframes */}
        <style jsx>{`
          @keyframes wave {
            0% { transform: rotate(-30deg); }
            100% { transform: rotate(-50deg); }
          }
        `}</style>
      </div>

      {/* Right Register Section */}
      <div className="flex items-center justify-center p-8 bg-background">
        <div className="w-full max-w-[420px]">
          {/* Mobile Logo */}
          <div className="lg:hidden flex items-center justify-center gap-2 text-lg font-semibold mb-12">
            <div className="size-8 rounded-lg bg-emerald-600/10 flex items-center justify-center">
              <UserPlus className="size-4 text-emerald-600" />
            </div>
            <span>Seasonality SaaS</span>
          </div>

          {/* Header */}
          <div className="text-center mb-10">
            <h1 className="text-3xl font-bold tracking-tight mb-2">Create your account</h1>
            <p className="text-muted-foreground text-sm">Start your free trial today</p>
          </div>

          {/* Register Form */}
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="name" className="text-sm font-medium">Full Name</Label>
              <Input
                id="name"
                type="text"
                placeholder="John Doe"
                value={name}
                onChange={(e) => setName(e.target.value)}
                onFocus={() => setIsTyping(true)}
                onBlur={() => setIsTyping(false)}
                required
                className="h-12 bg-background border-border/60 focus:border-emerald-500"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="email" className="text-sm font-medium">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onFocus={() => setIsTyping(true)}
                onBlur={() => setIsTyping(false)}
                required
                className="h-12 bg-background border-border/60 focus:border-emerald-500"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password" className="text-sm font-medium">Password</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onFocus={() => setIsPasswordFocused(true)}
                  onBlur={() => setIsPasswordFocused(false)}
                  required
                  minLength={8}
                  className="h-12 pr-10 bg-background border-border/60 focus:border-emerald-500"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                >
                  {showPassword ? <EyeOff className="size-5" /> : <Eye className="size-5" />}
                </button>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPassword" className="text-sm font-medium">Confirm Password</Label>
              <div className="relative">
                <Input
                  id="confirmPassword"
                  type={showConfirmPassword ? "text" : "password"}
                  placeholder="••••••••"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  onFocus={() => setIsPasswordFocused(true)}
                  onBlur={() => setIsPasswordFocused(false)}
                  required
                  className="h-12 pr-10 bg-background border-border/60 focus:border-emerald-500"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                >
                  {showConfirmPassword ? <EyeOff className="size-5" /> : <Eye className="size-5" />}
                </button>
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <Checkbox id="terms" required />
              <Label htmlFor="terms" className="text-sm font-normal cursor-pointer">
                I agree to the{" "}
                <a href="#" className="text-emerald-600 hover:underline font-medium">
                  Terms of Service
                </a>{" "}
                and{" "}
                <a href="#" className="text-emerald-600 hover:underline font-medium">
                  Privacy Policy
                </a>
              </Label>
            </div>

            <Button
              type="submit"
              className="w-full h-12 text-base font-medium bg-emerald-600 hover:bg-emerald-700"
              size="lg"
              disabled={isLoading}
            >
              {isLoading ? "Creating account..." : "Create Account"}
            </Button>
          </form>

          {/* Social Login */}
          <div className="mt-6">
            <Button
              variant="outline"
              className="w-full h-12 bg-background border-border/60 hover:bg-accent"
              type="button"
              onClick={() => {
                window.location.href = `${process.env.NEXT_PUBLIC_API_URL}/api/auth/google`;
              }}
            >
              <Mail className="mr-2 size-5" />
              Sign up with Google
            </Button>
          </div>

          {/* Sign In Link */}
          <div className="text-center text-sm text-muted-foreground mt-8">
            Already have an account?{" "}
            <Link href="/login" className="text-foreground font-medium hover:underline">
              Sign In
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
