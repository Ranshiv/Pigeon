// client/src/components/CustomCursor.js
import React, { useState, useEffect, useRef } from 'react';
import './CustomCursor.css';

const CustomCursor = () => {
    const [position, setPosition] = useState({ x: 0, y: 0 });
    const [hidden, setHidden] = useState(false);
    const [clicked, setClicked] = useState(false);
    const [linkHovered, setLinkHovered] = useState(false);
    const glowEffectRef = useRef(null);
    const dotRef = useRef(null);
    const ringRef = useRef(null);
    const lastPositionRef = useRef({ x: 0, y: 0 });
    const animationFrameRef = useRef();

    useEffect(() => {
        // Create glow effect element
        const glowEffect = document.createElement('div');
        glowEffect.className = 'glow-effect';
        document.body.appendChild(glowEffect);
        glowEffectRef.current = glowEffect;

        // Smooth cursor following with animation frames
        const updatePositions = () => {
            if (glowEffectRef.current && dotRef.current && ringRef.current) {
                // Different easing values for dot and ring
                const dotEase = 0.3; // Higher = more responsive dot
                const ringEase = 0.15; // Lower = smoother but slower ring
                const glowEase = 0.1; // Slowest for the glow effect

                // Update positions with easing for smooth movement
                // Dot position (most responsive)
                const dotX = lastPositionRef.current.x + (position.x - lastPositionRef.current.x) * dotEase;
                const dotY = lastPositionRef.current.y + (position.y - lastPositionRef.current.y) * dotEase;

                // Ring position (medium response)
                const ringX = lastPositionRef.current.x + (position.x - lastPositionRef.current.x) * ringEase;
                const ringY = lastPositionRef.current.y + (position.y - lastPositionRef.current.y) * ringEase;

                // Glow position (slowest response)
                const glowX = lastPositionRef.current.x + (position.x - lastPositionRef.current.x) * glowEase;
                const glowY = lastPositionRef.current.y + (position.y - lastPositionRef.current.y) * glowEase;

                // Apply positions
                dotRef.current.style.left = `${dotX}px`;
                dotRef.current.style.top = `${dotY}px`;

                ringRef.current.style.left = `${ringX}px`;
                ringRef.current.style.top = `${ringY}px`;

                glowEffectRef.current.style.left = `${glowX}px`;
                glowEffectRef.current.style.top = `${glowY}px`;

                // Update last position reference for next frame
                lastPositionRef.current = {
                    x: dotX,
                    y: dotY
                };
            }
            animationFrameRef.current = requestAnimationFrame(updatePositions);
        };

        // Start animation
        animationFrameRef.current = requestAnimationFrame(updatePositions);

        const updatePosition = (e) => {
            setPosition({ x: e.clientX, y: e.clientY });
        };

        const handleMouseEnter = () => {
            setHidden(false);
            if (glowEffectRef.current) {
                glowEffectRef.current.style.opacity = '0.6';
            }
        };

        const handleMouseLeave = () => {
            setHidden(true);
            if (glowEffectRef.current) {
                glowEffectRef.current.style.opacity = '0';
            }
        };

        const handleMouseDown = () => {
            setClicked(true);
            if (glowEffectRef.current) {
                glowEffectRef.current.classList.add('clicked');
            }
        };

        const handleMouseUp = () => {
            setClicked(false);
            if (glowEffectRef.current) {
                glowEffectRef.current.classList.remove('clicked');
            }
        };

        const handleLinkHoverIn = () => {
            setLinkHovered(true);
            if (glowEffectRef.current) {
                glowEffectRef.current.classList.add('link-hovered');
            }
        };

        const handleLinkHoverOut = () => {
            setLinkHovered(false);
            if (glowEffectRef.current) {
                glowEffectRef.current.classList.remove('link-hovered');
            }
        };

        document.addEventListener('mousemove', updatePosition);
        document.addEventListener('mouseenter', handleMouseEnter);
        document.addEventListener('mouseleave', handleMouseLeave);
        document.addEventListener('mousedown', handleMouseDown);
        document.addEventListener('mouseup', handleMouseUp);

        // Add event listeners for clickable elements
        const clickableElements = document.querySelectorAll('a, button, .navbar-item, .dropdown-item, [role="button"], input[type="submit"]');
        clickableElements.forEach(el => {
            el.addEventListener('mouseenter', handleLinkHoverIn);
            el.addEventListener('mouseleave', handleLinkHoverOut);
        });

        // Add mousemove listeners to certain sections for special glow effects
        const specialSections = document.querySelectorAll('.spotlight-section, .workspaces-section, .trending-section');

        const handleSpecialSectionHover = (e) => {
            const rect = e.currentTarget.getBoundingClientRect();
            const centerX = rect.left + rect.width / 2;
            const centerY = rect.top + rect.height / 2;

            // Calculate distance from cursor to center of element
            const dx = e.clientX - centerX;
            const dy = e.clientY - centerY;
            const distance = Math.sqrt(dx * dx + dy * dy);

            // Adjust glow size based on distance from center
            if (glowEffectRef.current && distance < rect.width / 2) {
                const scale = 1 - (distance / (rect.width / 1.5));
                glowEffectRef.current.style.filter = `blur(${10 + scale * 5}px) brightness(${1 + scale * 0.3})`;
            }
        };

        specialSections.forEach(section => {
            section.addEventListener('mousemove', handleSpecialSectionHover);
        });

        return () => {
            document.removeEventListener('mousemove', updatePosition);
            document.removeEventListener('mouseenter', handleMouseEnter);
            document.removeEventListener('mouseleave', handleMouseLeave);
            document.removeEventListener('mousedown', handleMouseDown);
            document.removeEventListener('mouseup', handleMouseUp);

            // Clean up clickable elements listeners
            clickableElements.forEach(el => {
                el.removeEventListener('mouseenter', handleLinkHoverIn);
                el.removeEventListener('mouseleave', handleLinkHoverOut);
            });

            // Clean up special section listeners
            specialSections.forEach(section => {
                section.removeEventListener('mousemove', handleSpecialSectionHover);
            });

            // Cancel animation frame
            if (animationFrameRef.current) {
                cancelAnimationFrame(animationFrameRef.current);
            }

            // Remove glow effect element when component unmounts
            if (document.body.contains(glowEffectRef.current)) {
                document.body.removeChild(glowEffectRef.current);
            }
        };
    }, [position]);

    return (
        <>
            <div
                ref={dotRef}
                className={`cursor-dot ${hidden ? 'hidden' : ''} ${clicked ? 'clicked' : ''} ${linkHovered ? 'link-hovered' : ''}`}
                style={{ transform: 'translate(-50%, -50%)' }}
            />
            <div
                ref={ringRef}
                className={`cursor-ring ${hidden ? 'hidden' : ''} ${clicked ? 'clicked' : ''} ${linkHovered ? 'link-hovered' : ''}`}
                style={{ transform: 'translate(-50%, -50%)' }}
            />
        </>
    );
};

export default CustomCursor;