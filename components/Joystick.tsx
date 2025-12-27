import React, { useRef, useEffect, useState } from 'react';

interface JoystickProps {
  onMove: (x: number, y: number) => void;
}

const Joystick: React.FC<JoystickProps> = ({ onMove }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const stickRef = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(false);
  const touchId = useRef<number | null>(null);

  const radius = 50; // Radius of the joystick base

  const handleStart = (e: React.TouchEvent) => {
    e.preventDefault(); // Предотвращаем скролл
    // Explicitly cast to avoid 'unknown' type error in some TS environments
    const touch = e.changedTouches[0] as React.Touch;
    touchId.current = touch.identifier;
    setActive(true);
    updateStick(touch.clientX, touch.clientY);
  };

  const handleMove = (e: React.TouchEvent) => {
    e.preventDefault();
    if (!active) return;
    
    // Find the touch that started this joystick interaction
    // Explicitly cast Array.from result to ensure correct typing
    const touches = Array.from(e.changedTouches) as React.Touch[];
    const touch = touches.find(t => t.identifier === touchId.current);
    if (touch) {
      updateStick(touch.clientX, touch.clientY);
    }
  };

  const handleEnd = (e: React.TouchEvent) => {
    e.preventDefault();
    const touches = Array.from(e.changedTouches) as React.Touch[];
    const touch = touches.find(t => t.identifier === touchId.current);
    if (touch) {
      setActive(false);
      touchId.current = null;
      if (stickRef.current) {
        stickRef.current.style.transform = `translate(0px, 0px)`;
      }
      onMove(0, 0);
    }
  };

  const updateStick = (clientX: number, clientY: number) => {
    if (!containerRef.current || !stickRef.current) return;

    const rect = containerRef.current.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;

    let dx = clientX - centerX;
    let dy = clientY - centerY;
    const distance = Math.sqrt(dx * dx + dy * dy);

    // Normalize
    if (distance > radius) {
      const angle = Math.atan2(dy, dx);
      dx = Math.cos(angle) * radius;
      dy = Math.sin(angle) * radius;
    }

    stickRef.current.style.transform = `translate(${dx}px, ${dy}px)`;

    // Map to -1 to 1
    const x = dx / radius;
    const y = dy / radius;
    
    onMove(x, y);
  };

  return (
    <div
      ref={containerRef}
      className="relative w-32 h-32 bg-black/30 rounded-full backdrop-blur-sm border-2 border-white/20 touch-none pointer-events-auto"
      onTouchStart={handleStart}
      onTouchMove={handleMove}
      onTouchEnd={handleEnd}
    >
      <div
        ref={stickRef}
        className="absolute top-1/2 left-1/2 w-12 h-12 -mt-6 -ml-6 bg-white/80 rounded-full shadow-lg pointer-events-none transition-transform duration-75 ease-linear"
      />
    </div>
  );
};

export default Joystick;