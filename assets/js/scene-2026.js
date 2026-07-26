import * as THREE from './vendor/three.module.min.js';

export const JOURNEY_DURATION = 1150;

const PAGE_COLORS = {
	main: [0x8b5cf6, 0x22d3ee],
	about: [0xf472b6, 0x8b5cf6],
	projects: [0x22d3ee, 0xa3e635],
	travel: [0xfb923c, 0x22d3ee],
	blog: [0xfbbf24, 0xf472b6],
	hyundai: [0xa3e635, 0x22d3ee],
	photography: [0xf472b6, 0xfb923c],
	sitemap: [0x8b5cf6, 0x22d3ee]
};

function canRender() {
	if (!window.WebGLRenderingContext) return false;
	if (window.innerWidth < 480) return false;
	if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return false;
	if (navigator.connection?.saveData) return false;
	try {
		const canvas = document.createElement('canvas');
		return Boolean(canvas.getContext('webgl2') || canvas.getContext('webgl'));
	} catch (_) {
		return false;
	}
}

export function createSpatialScene(host, page = 'main') {
	if (!host || !canRender()) {
		host?.classList.add('scene-fallback');
		return { destroy() {} };
	}

	const colors = PAGE_COLORS[page] || PAGE_COLORS.main;
	const scene = new THREE.Scene();
	const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 100);
	camera.position.set(0, 0, 7.2);

	const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: 'high-performance' });
	renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
	renderer.outputColorSpace = THREE.SRGBColorSpace;
	renderer.setClearColor(0x000000, 0);
	renderer.domElement.setAttribute('aria-hidden', 'true');
	renderer.domElement.tabIndex = -1;
	host.appendChild(renderer.domElement);

	const group = new THREE.Group();
	scene.add(group);

	const geometry = page === 'main' ? new THREE.SphereGeometry(2.05, 40, 28) : new THREE.IcosahedronGeometry(2.05, 2);
	const material = new THREE.MeshPhysicalMaterial({
		color: colors[0],
		metalness: 0.35,
		roughness: 0.2,
		transmission: 0.2,
		transparent: true,
		opacity: 0.7,
		flatShading: true,
		wireframe: false
	});
	const sculpture = new THREE.Mesh(geometry, material);
	group.add(sculpture);

	const wireGeometry = page === 'main' ? new THREE.SphereGeometry(2.32, 24, 16) : new THREE.IcosahedronGeometry(2.32, 2);
	const wire = new THREE.LineSegments(
		new THREE.WireframeGeometry(wireGeometry),
		new THREE.LineBasicMaterial({ color: colors[1], transparent: true, opacity: 0.36 })
	);
	wire.rotation.set(0.25, 0.4, -0.12);
	group.add(wire);

	const ringMaterial = new THREE.MeshBasicMaterial({ color: colors[1], transparent: true, opacity: 0.22, side: THREE.DoubleSide });
	for (let i = 0; i < 3; i += 1) {
		const ring = new THREE.Mesh(new THREE.TorusGeometry(2.85 + i * 0.42, 0.012, 6, 120), ringMaterial.clone());
		ring.rotation.set(Math.PI * (0.18 + i * 0.17), Math.PI * (0.12 + i * 0.23), i * 0.5);
		group.add(ring);
	}

	const particleCount = window.innerWidth < 720 ? 180 : 420;
	const positions = new Float32Array(particleCount * 3);
	for (let i = 0; i < particleCount; i += 1) {
		const radius = 3.1 + Math.random() * 5.5;
		const theta = Math.random() * Math.PI * 2;
		const phi = Math.acos(2 * Math.random() - 1);
		positions[i * 3] = radius * Math.sin(phi) * Math.cos(theta);
		positions[i * 3 + 1] = radius * Math.sin(phi) * Math.sin(theta);
		positions[i * 3 + 2] = radius * Math.cos(phi);
	}
	const particleGeometry = new THREE.BufferGeometry();
	particleGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
	const particles = new THREE.Points(particleGeometry, new THREE.PointsMaterial({ color: colors[1], size: 0.025, transparent: true, opacity: 0.55 }));
	scene.add(particles);

	scene.add(new THREE.AmbientLight(0xffffff, 1.4));
	const keyLight = new THREE.PointLight(colors[1], 25, 20);
	keyLight.position.set(4, 3, 5);
	scene.add(keyLight);
	const fillLight = new THREE.PointLight(colors[0], 18, 18);
	fillLight.position.set(-4, -2, 3);
	scene.add(fillLight);

	const pointer = { x: 0, y: 0 };
	let scrollProgress = 0;
	let frame = 0;
	let visible = true;
	let destroyed = false;
	let journeyProgress = 0;
	let journeyStartedAt = 0;

	function resize() {
		const rect = host.getBoundingClientRect();
		const width = Math.max(1, rect.width);
		const height = Math.max(1, rect.height);
		camera.aspect = width / height;
		camera.updateProjectionMatrix();
		renderer.setSize(width, height, false);
	}

	function onPointer(event) {
		pointer.x = (event.clientX / window.innerWidth - 0.5) * 2;
		pointer.y = (event.clientY / window.innerHeight - 0.5) * 2;
	}

	function onScroll() {
		const max = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
		scrollProgress = window.scrollY / max;
	}

	function render(time) {
		if (destroyed) return;
		frame = requestAnimationFrame(render);
		if (!visible || document.hidden) return;
		const t = time * 0.00018;
		if (journeyStartedAt) journeyProgress = Math.min(1, (time - journeyStartedAt) / JOURNEY_DURATION);
		group.rotation.y += (t + pointer.x * 0.24 + scrollProgress * 1.4 - group.rotation.y) * 0.035;
		if (journeyProgress) group.rotation.y += 0.055 * Math.sin(journeyProgress * Math.PI);
		group.rotation.x += (pointer.y * 0.16 + Math.sin(t * 2) * 0.08 - group.rotation.x) * 0.035;
		wire.rotation.z += 0.0012;
		particles.rotation.y = -t * 0.25;
		particles.rotation.x = scrollProgress * 0.35;
		const breathe = (1 + Math.sin(time * 0.0011) * 0.025) * (1 - Math.sin(journeyProgress * Math.PI) * 0.52);
		sculpture.scale.setScalar(breathe);
		wire.scale.setScalar(breathe);
		camera.position.z = 7.2 - Math.sin(journeyProgress * Math.PI) * 3.1;
		renderer.render(scene, camera);
	}

	const observer = new IntersectionObserver(entries => {
		visible = entries[0]?.isIntersecting ?? true;
	}, { rootMargin: '200px' });
	observer.observe(host);
	window.addEventListener('resize', resize, { passive: true });
	window.addEventListener('pointermove', onPointer, { passive: true });
	window.addEventListener('scroll', onScroll, { passive: true });
	const onJourneyStart = () => { journeyStartedAt = performance.now(); };
	document.addEventListener('site:journey-start', onJourneyStart);
	resize();
	onScroll();
	frame = requestAnimationFrame(render);
	host.classList.add('scene-ready');

	return {
		destroy() {
			destroyed = true;
			cancelAnimationFrame(frame);
			observer.disconnect();
			window.removeEventListener('resize', resize);
			window.removeEventListener('pointermove', onPointer);
			window.removeEventListener('scroll', onScroll);
			document.removeEventListener('site:journey-start', onJourneyStart);
			geometry.dispose();
			material.dispose();
			particleGeometry.dispose();
			particles.material.dispose();
			renderer.dispose();
			renderer.domElement.remove();
		}
	};
}
