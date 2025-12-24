import React, { useState, useEffect } from 'react';
import { Package } from 'lucide-react';

interface FlyingIconProps {
  startX: number;
  startY: number;
  targetX: number;
  targetY: number;
  onComplete: () => void;
}

export const FlyingIcon: React.FC<FlyingIconProps> = ({
  startX, startY, targetX, targetY, onComplete
}) => {
  const [style, setStyle] = useState<React.CSSProperties>({
    position: 'fixed',
    left: startX,
    top: startY,
    opacity: 1,
    transform: 'translate(-50%, -50%) scale(1)',
    zIndex: 100,
    transition: 'all 0.6s cubic-bezier(0.2, 0.8, 0.2, 1)'
  });

  useEffect(() => {
    const frameId = requestAnimationFrame(() => {
      setStyle({
        position: 'fixed',
        left: targetX,
        top: targetY,
        opacity: 0,
        transform: 'translate(-50%, -50%) scale(0.2)',
        zIndex: 100,
        transition: 'all 0.6s cubic-bezier(0.2, 0.8, 0.2, 1)'
      });
    });

    const timer = setTimeout(onComplete, 600);
    return () => {
      cancelAnimationFrame(frameId);
      clearTimeout(timer);
    };
  }, [targetX, targetY, onComplete]);

  return (
    <div style={style} className="text-emerald-400 pointer-events-none">
      <Package size={24} fill="currentColor" fillOpacity={0.2} />
    </div>
  );
};







