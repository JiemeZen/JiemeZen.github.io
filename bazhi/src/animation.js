(function() {
    const canvas = document.getElementById('inkCanvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let width, height;

    // Configuration
    const config = {
        mountainLayers: 5,
        mistSpeed: 0.5,
        birdCount: 15,
        parallaxIntensity: 0.1 // How much the layers separate on scroll
    };

    // State
    let time = 0;
    let birds = [];
    let mistParticles = [];
    let bambooStalks = [];
    let scrollOffset = 0;
    let targetScrollOffset = 0;

    // Resize handling
    function resize() {
        width = window.innerWidth;
        height = window.innerHeight;
        canvas.width = width;
        canvas.height = height;
        initScene();
    }

    window.addEventListener('resize', resize);

    // Parallax Scroll Handler
    function setupParallaxScroll() {
        const chatView = document.getElementById('chatView');
        if (chatView) {
            chatView.addEventListener('scroll', () => {
                targetScrollOffset = chatView.scrollTop;
            });
        }
    }

    // --- Utils ---
    function random(min, max) {
        return Math.random() * (max - min) + min;
    }

    // Noise function for natural mountain shapes (Simple 1D noise)
    function noise(x, seed) {
        const y = Math.sin(x * seed) + Math.sin(x * seed * 2) * 0.5 + Math.sin(x * seed * 4) * 0.25;
        return y;
    }

    // --- Classes ---

    class Bird {
        constructor() {
            this.reset();
            // Random start position
            this.x = Math.random() * width;
        }

        reset() {
            this.x = -50;
            this.y = random(height * 0.1, height * 0.5);
            this.speed = random(0.5, 1.2); // Slower speed
            this.size = random(2, 5);
            this.wingSpan = random(5, 10);
            this.flapSpeed = random(0.05, 0.15); // Slower flapping
            this.angle = random(-0.1, 0.1);
        }

        update() {
            this.x += this.speed;
            this.y += Math.sin(time * 0.05) * 0.5; // Slight bobbing
            
            if (this.x > width + 50) {
                this.reset();
            }
        }

        draw() {
            ctx.save();
            ctx.translate(this.x, this.y);
            ctx.rotate(this.angle);
            
            ctx.beginPath();
            ctx.strokeStyle = '#222';
            ctx.lineWidth = 1.5;
            
            // Wing flap animation
            const flap = Math.sin(time * this.flapSpeed * 20) * this.wingSpan;
            
            ctx.moveTo(-this.size, -flap/2);
            ctx.quadraticCurveTo(0, 0, this.size, -flap/2);
            
            ctx.stroke();
            ctx.restore();
        }
    }

    class Mist {
        constructor() {
            this.reset();
        }

        reset() {
            this.x = Math.random() * width;
            this.y = random(height * 0.5, height * 0.9);
            this.radius = random(50, 200);
            this.speed = random(0.1, 0.5);
            this.opacity = random(0.05, 0.15);
        }

        update() {
            this.x -= this.speed;
            if (this.x < -this.radius) {
                this.x = width + this.radius;
                this.y = random(height * 0.5, height * 0.9);
            }
        }

        draw() {
            const gradient = ctx.createRadialGradient(this.x, this.y, 0, this.x, this.y, this.radius);
            gradient.addColorStop(0, `rgba(255, 255, 255, ${this.opacity})`);
            gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
            
            ctx.fillStyle = gradient;
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
            ctx.fill();
        }
    }

    // Bamboo Class for stable, swaying animation
    class Bamboo {
        constructor(startX, startY, height, lean, mirror = false) {
            this.startX = startX;
            this.startY = startY;
            this.height = height;
            this.lean = lean;
            this.mirror = mirror;
            this.segments = [];
            this.generate();
        }

        generate() {
            let x = 0;
            let y = 0;
            let w = random(4, 8);
            const count = 8;
            const segH = this.height / count;

            for(let i=0; i<count; i++) {
                const nextX = x + this.lean + random(-2, 2);
                const nextY = y - segH;
                
                // Store leaf data if generated
                let leaf = null;
                if (Math.random() > 0.4) {
                    leaf = {
                        len: random(20, 40),
                        angle: random(-1, 1)
                    };
                }

                this.segments.push({
                    x, y, nextX, nextY, w, leaf
                });

                x = nextX;
                y = nextY;
                w *= 0.9;
            }
        }

        draw() {
            ctx.save();
            if (this.mirror) {
                ctx.translate(width, 0);
                ctx.scale(-1, 1);
            }
            ctx.translate(this.startX, this.startY);
            
            // Gentle sway based on time
            const sway = Math.sin(time * 0.015 + this.startX) * 0.02;
            ctx.rotate(sway);

            ctx.strokeStyle = '#111';
            ctx.fillStyle = '#111';
            ctx.lineCap = 'round';

            this.segments.forEach(seg => {
                ctx.beginPath();
                ctx.lineWidth = seg.w;
                ctx.moveTo(seg.x, seg.y);
                ctx.quadraticCurveTo(seg.x + this.lean/2, seg.y - (seg.y - seg.nextY)/2, seg.nextX, seg.nextY);
                ctx.stroke();

                // Node
                ctx.beginPath();
                ctx.lineWidth = seg.w + 2;
                ctx.moveTo(seg.nextX - 3, seg.nextY);
                ctx.lineTo(seg.nextX + 3, seg.nextY);
                ctx.stroke();

                // Leaf
                if (seg.leaf) {
                    ctx.beginPath();
                    ctx.lineWidth = 1;
                    // Leaf sway
                    const lSway = Math.sin(time * 0.03) * 0.1;
                    const angle = seg.leaf.angle + lSway;
                    
                    ctx.moveTo(seg.nextX, seg.nextY);
                    ctx.quadraticCurveTo(
                        seg.nextX + Math.cos(angle)*seg.leaf.len/2, 
                        seg.nextY + Math.sin(angle)*10, 
                        seg.nextX + Math.cos(angle)*seg.leaf.len, 
                        seg.nextY + Math.sin(angle)*seg.leaf.len
                    );
                    ctx.stroke();
                    ctx.lineTo(seg.nextX, seg.nextY);
                    ctx.fill();
                }
            });
            ctx.restore();
        }
    }

    // --- Generators ---

    function drawSun() {
        // Inspired by Image 2 - A soft red sun
        const x = width * 0.15;
        const y = height * 0.15;
        const radius = 60;

        const gradient = ctx.createRadialGradient(x, y, radius * 0.8, x, y, radius * 2);
        gradient.addColorStop(0, '#b92b27');
        gradient.addColorStop(1, 'rgba(185, 43, 39, 0)');

        ctx.save();
        ctx.globalAlpha = 0.8;
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(x, y, radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }

    function drawMountains() {
        // Detect mobile/portrait mode and adjust compression
        const isPortrait = width < height || width < 768;
        const compressionFactor = isPortrait ? 2.2 : 1; // Compress mountains more on mobile
        
        for (let i = 0; i < config.mountainLayers; i++) {
            const layerFactor = i / config.mountainLayers; // 0 (back) to 1 (front)
            
            // Parallax effect: back layers move slower, front layers move faster
            // The effect creates separation between layers when scrolling
            const parallaxFactor = layerFactor * config.parallaxIntensity;
            const parallaxOffset = scrollOffset * parallaxFactor;
            
            const yBase = height * 0.4 + (i * height * 0.12) + parallaxOffset;
            const colorValue = 200 - (i * 40); // Lighter at back, darker at front
            
            // Ink wash opacity logic: 
            // Back mountains are faint (atmospheric perspective)
            // Front mountains are darker but still have transparency
            const opacity = 0.2 + (i * 0.15); 

            // Create a linear gradient for the mountain itself to fade into the mist at the bottom
            // This prevents the harsh line at the base
            const mountainGrad = ctx.createLinearGradient(0, yBase - 100, 0, height);
            mountainGrad.addColorStop(0, `rgba(${colorValue - 20}, ${colorValue - 20}, ${colorValue}, ${opacity})`);
            mountainGrad.addColorStop(0.8, `rgba(${colorValue - 20}, ${colorValue - 20}, ${colorValue}, 0)`);

            ctx.fillStyle = mountainGrad;
            
            ctx.beginPath();
            ctx.moveTo(0, height);
            ctx.lineTo(0, yBase);

            // Create rocky/hilly peaks
            for (let x = 0; x <= width; x += 5) {
                // Combine frequencies for "ink stroke" unevenness
                // Increase frequency on mobile to compress mountains horizontally
                const frequency = (0.002 + (i * 0.001)) * compressionFactor;
                const amp = 50 + (i * 30);
                const noiseVal = noise(x, frequency) * amp;
                
                // Add secondary detail (also compressed on mobile)
                const detail = noise(x, 0.02 * compressionFactor) * 10;
                
                ctx.lineTo(x, yBase - Math.abs(noiseVal) - detail);
            }

            ctx.lineTo(width, height);
            ctx.closePath();
            ctx.fill();

            // Add "Mist" at the base of each mountain layer (simulating the white space in ink paintings)
            const mistGrad = ctx.createLinearGradient(0, height, 0, yBase);
            mistGrad.addColorStop(0, 'rgba(252, 251, 249, 0.8)'); // Paper color
            mistGrad.addColorStop(0.5, 'rgba(252, 251, 249, 0)');
            ctx.fillStyle = mistGrad;
            ctx.fillRect(0, yBase - 100, width, height - yBase + 100);
        }
    }

    // --- Animation Loop ---

    function initScene() {
        birds = [];
        for(let i=0; i<config.birdCount; i++) birds.push(new Bird());
        
        mistParticles = [];
        for(let i=0; i<10; i++) mistParticles.push(new Mist());

        bambooStalks = [];
        // Bottom left clump
        bambooStalks.push(new Bamboo(width * 0.05, height + 20, 300, 10));
        bambooStalks.push(new Bamboo(width * 0.08, height + 50, 400, 20));
        bambooStalks.push(new Bamboo(width * 0.02, height + 10, 250, 5));
        
        // Bottom right clump (mirrored)
        bambooStalks.push(new Bamboo(50, -50, 300, 15, true));
    }

    function animate() {
        // Smooth scroll offset interpolation (lerp) for organic movement
        const lerpFactor = 0.08; // Lower = smoother/slower, higher = snappier
        scrollOffset += (targetScrollOffset - scrollOffset) * lerpFactor;
        
        ctx.clearRect(0, 0, width, height);

        // 1. Draw Static/Slow Background Elements
        drawSun();
        drawMountains();

        // 2. Draw Animated Elements
        mistParticles.forEach(m => {
            m.update();
            m.draw();
        });

        birds.forEach(b => {
            b.update();
            b.draw();
        });

        // 3. Draw Foreground
        bambooStalks.forEach(b => b.draw());

        time++;
        requestAnimationFrame(animate);
    }

    // --- Calligraphy Handling ---
    // Drifting characters that appear and fade like thoughts
    const characters = ['气', '道', '流', '云', '远', '山', '风', '雅', '静', '禅', '心', '竹', '梦', '水'];
    const container = document.getElementById('scene-container');

    function spawnCharacter() {
        const span = document.createElement('div');
        span.classList.add('floating-char');
        span.innerText = characters[Math.floor(Math.random() * characters.length)];
        
        // Random styling
        const size = Math.random() * 30 + 20; // Slightly smaller max size
        const startX = Math.random() * width;
        const startY = Math.random() * height * 0.5;
        const duration = Math.random() * 15 + 15; // Slower drift (15-30s)

        span.style.fontSize = `${size}px`;
        span.style.left = `${startX}px`;
        span.style.top = `${startY}px`;
        
        // Random blur for "ink bleed" effect
        if (Math.random() > 0.5) {
            span.style.filter = `blur(${Math.random() * 2}px)`;
        }

        container.appendChild(span);

        // Animation via Web Animations API for better performance
        const anim = span.animate([
            { transform: 'translateY(0) rotate(0deg)', opacity: 0 },
            { opacity: 0.5, offset: 0.2 }, // Lower max opacity
            { opacity: 0.5, offset: 0.8 },
            { transform: `translateY(${Math.random() * 100 - 50}px) translateX(${Math.random() * 100 - 50}px) rotate(${Math.random() * 20 - 10}deg)`, opacity: 0 }
        ], {
            duration: duration * 1000,
            easing: 'ease-out'
        });

        anim.onfinish = () => span.remove();
    }

    // --- Text Animation Logic (Poem) ---
    function animatePoem() {
        const lines = document.querySelectorAll('.poem-line');
        lines.forEach((line, index) => {
            // Animate height to simulate writing
            setTimeout(() => {
                // Much slower transition (12s) for a very deliberate, meditative writing effect
                line.style.transition = 'height 12s cubic-bezier(0.2, 1, 0.3, 1)';
                line.style.height = '250px'; // Ensure full height is cleared
            }, 2000 + (index * 4000)); // Longer initial wait for fonts, and longer stagger between lines
        });
    }

    // Initialize
    resize();
    setupParallaxScroll();
    animate();
    setInterval(spawnCharacter, 3000);
    animatePoem();
})();