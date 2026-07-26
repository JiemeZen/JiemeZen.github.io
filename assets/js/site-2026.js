import { createSpatialScene, JOURNEY_DURATION } from './scene-2026.js';

const body = document.body;
const page = body.dataset.page || 'main';

function addScene() {
	if (document.querySelector('.spatial-scene')) return;
	const host = document.createElement('div');
	host.className = 'spatial-scene';
	host.setAttribute('aria-hidden', 'true');
	body.prepend(host);
	createSpatialScene(host, page);
}

function setupJourney() {
	const start = document.querySelector('#journey-start');
	const destination = document.querySelector('#main');
	if (!start || !destination) return;

	start.addEventListener('click', event => {
		event.preventDefault();
		if (body.classList.contains('is-journeying')) return;
		body.classList.add('is-journeying');
		document.dispatchEvent(new CustomEvent('site:journey-start'));
		const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
		window.setTimeout(() => {
			body.classList.add('feature-wall');
			destination.scrollIntoView({ behavior: reducedMotion ? 'auto' : 'smooth', block: 'start' });
			window.setTimeout(() => body.classList.remove('is-journeying'), reducedMotion ? 0 : 800);
		}, reducedMotion ? 0 : JOURNEY_DURATION);
	}, { capture: true });
}

function createFloatingMenu() {
	if (document.querySelector('.floating-menu')) return;
	const links = [
		['Home', page === 'photography' ? '../index.html' : 'index.html'],
		['About', page === 'photography' ? '../about.html' : 'about.html'],
		['Projects', page === 'photography' ? '../projects.html' : 'projects.html'],
		['Travel', page === 'photography' ? '../travel.html' : 'travel.html'],
		['Blog', page === 'photography' ? '../blog.html' : 'blog.html']
	];
	const menu = document.createElement('nav');
	menu.className = 'floating-menu';
	menu.setAttribute('aria-label', 'Quick navigation');
	menu.innerHTML = `
		<button class="floating-menu__toggle" type="button" aria-expanded="false" aria-controls="floating-menu-links">
			<span aria-hidden="true"></span><span class="floating-menu__label">Menu</span>
		</button>
		<div class="floating-menu__links" id="floating-menu-links">
			${links.map(([label, href]) => `<a href="${href}">${label}</a>`).join('')}
		</div>`;
	body.appendChild(menu);
	const toggle = menu.querySelector('.floating-menu__toggle');
	const close = () => {
		menu.classList.remove('is-open');
		toggle.setAttribute('aria-expanded', 'false');
	};
	toggle.addEventListener('click', () => {
		const open = menu.classList.toggle('is-open');
		toggle.setAttribute('aria-expanded', String(open));
	});
	document.addEventListener('click', event => {
		if (!menu.contains(event.target)) close();
	});
	document.addEventListener('keydown', event => {
		if (event.key === 'Escape') close();
	});
	const update = () => menu.classList.toggle('is-visible', window.scrollY > Math.min(420, window.innerHeight * 0.55));
	window.addEventListener('scroll', update, { passive: true });
	update();
}

function prepareShell() {
	const main = document.querySelector('#main');
	const nav = document.querySelector('#nav');
	const header = document.querySelector('#header');
	if (main && !main.id.startsWith('main-')) {
		main.setAttribute('role', 'main');
		main.setAttribute('tabindex', '-1');
	}
	if (!document.querySelector('.skip-link') && main) {
		const skip = document.createElement('a');
		skip.className = 'skip-link';
		skip.href = '#main';
		skip.textContent = 'Skip to content';
		body.prepend(skip);
	}
	if (nav) nav.setAttribute('aria-label', 'Primary navigation');
	if (header) header.classList.add('spatial-header');

	const themeToggle = document.querySelector('#dark-mode-toggle');
	if (themeToggle) {
		themeToggle.setAttribute('role', 'button');
		themeToggle.setAttribute('tabindex', '0');
		themeToggle.setAttribute('aria-label', 'Toggle color theme');
		themeToggle.addEventListener('keydown', event => {
			if (event.key === 'Enter' || event.key === ' ') {
				event.preventDefault();
				themeToggle.click();
			}
		});
	}

	document.querySelectorAll('a[target="_blank"]').forEach(link => {
		const rel = new Set((link.getAttribute('rel') || '').split(/\s+/).filter(Boolean));
		rel.add('noopener');
		rel.add('noreferrer');
		link.setAttribute('rel', [...rel].join(' '));
	});
}

function enhanceReveal(root = document) {
	const candidates = root.querySelectorAll('#main > article, #main > section, #main .posts > article, .timeline-content, .thumb');
	if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
		candidates.forEach(item => item.classList.add('is-revealed'));
		return;
	}
	const observer = new IntersectionObserver(entries => {
		entries.forEach(entry => {
			if (entry.isIntersecting) {
				entry.target.classList.add('is-revealed');
				observer.unobserve(entry.target);
			}
		});
	}, { threshold: 0.08, rootMargin: '0px 0px -5% 0px' });
	candidates.forEach((item, index) => {
		if (item.dataset.revealBound) return;
		item.dataset.revealBound = 'true';
		item.style.setProperty('--reveal-delay', `${Math.min(index % 6, 5) * 55}ms`);
		observer.observe(item);
	});
}

function enhanceTilt(root = document) {
	if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches) return;
	if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
	root.querySelectorAll('.tiles article, .posts > article, .timeline-content').forEach(card => {
		if (card.dataset.tiltBound) return;
		card.dataset.tiltBound = 'true';
		card.addEventListener('pointermove', event => {
			const rect = card.getBoundingClientRect();
			const x = (event.clientX - rect.left) / rect.width - 0.5;
			const y = (event.clientY - rect.top) / rect.height - 0.5;
			card.style.setProperty('--tilt-x', `${(-y * 5).toFixed(2)}deg`);
			card.style.setProperty('--tilt-y', `${(x * 7).toFixed(2)}deg`);
			card.style.setProperty('--glow-x', `${((x + 0.5) * 100).toFixed(1)}%`);
			card.style.setProperty('--glow-y', `${((y + 0.5) * 100).toFixed(1)}%`);
		});
		card.addEventListener('pointerleave', () => {
			card.style.removeProperty('--tilt-x');
			card.style.removeProperty('--tilt-y');
		});
	});
}

function enhanceMedia(root = document) {
	root.querySelectorAll('img').forEach((image, index) => {
		if (index > 1 && !image.hasAttribute('loading')) image.loading = 'lazy';
		image.decoding = 'async';
	});
	root.querySelectorAll('iframe').forEach(frame => {
		frame.loading = 'lazy';
		if (!frame.title) frame.title = 'Embedded media';
	});
}

function enhanceTimeline() {
	const button = document.querySelector('#showTimeline');
	const timeline = document.querySelector('#timeline');
	if (!button || !timeline) return;
	const entries = [...timeline.querySelectorAll(':scope > ul > li')];
	button.setAttribute('role', 'button');
	button.setAttribute('tabindex', '0');
	button.setAttribute('aria-controls', 'timeline');
	button.setAttribute('aria-expanded', timeline.style.display !== 'none' ? 'true' : 'false');

	const navigator = document.createElement('div');
	navigator.className = 'timeline-nav';
	navigator.setAttribute('aria-hidden', 'true');
	navigator.innerHTML = `
		<span class="timeline-nav__label">Career journey</span>
		<span class="timeline-nav__track"><span class="timeline-nav__fill"></span></span>
		<span class="timeline-nav__status">01 / ${String(entries.length).padStart(2, '0')}</span>`;
	timeline.prepend(navigator);

	const status = navigator.querySelector('.timeline-nav__status');
	const setCurrent = entry => {
		entries.forEach(item => item.classList.toggle('is-current', item === entry));
		const index = Math.max(entries.indexOf(entry), 0);
		const progress = entries.length > 1 ? (index / (entries.length - 1)) * 100 : 100;
		navigator.style.setProperty('--timeline-progress', `${progress}%`);
		status.textContent = `${String(index + 1).padStart(2, '0')} / ${String(entries.length).padStart(2, '0')}`;
	};

	if (entries.length) {
		setCurrent(entries[0]);
		const entryObserver = new IntersectionObserver(records => {
			const visible = records
				.filter(record => record.isIntersecting)
				.sort((a, b) => Math.abs(a.boundingClientRect.top - window.innerHeight * .42) - Math.abs(b.boundingClientRect.top - window.innerHeight * .42));
			if (visible[0]) setCurrent(visible[0].target);
		}, { rootMargin: '-18% 0px -52% 0px', threshold: [0, .15, .5] });
		entries.forEach(entry => entryObserver.observe(entry));
	}

	button.addEventListener('click', () => {
		requestAnimationFrame(() => {
			const expanded = timeline.style.display !== 'none';
			button.setAttribute('aria-expanded', expanded ? 'true' : 'false');
			if (expanded && entries[0]) setCurrent(entries[0]);
		});
	});
	button.addEventListener('keydown', event => {
		if (event.key === 'Enter' || event.key === ' ') {
			event.preventDefault();
			button.click();
		}
	});
}

function enhanceDynamic(root = document) {
	enhanceReveal(root);
	enhanceTilt(root);
	enhanceMedia(root);
}

addScene();
setupJourney();
createFloatingMenu();
prepareShell();
enhanceTimeline();
enhanceDynamic();

document.addEventListener('site:footer-loaded', event => enhanceDynamic(event.detail?.element || document));
document.addEventListener('site:content-updated', event => enhanceDynamic(event.detail?.element || document));

const mutationObserver = new MutationObserver(mutations => {
	const roots = mutations.flatMap(mutation => [...mutation.addedNodes]).filter(node => node.nodeType === Node.ELEMENT_NODE);
	roots.forEach(root => enhanceDynamic(root));
});
const articles = document.querySelector('#articles');
if (articles) mutationObserver.observe(articles, { childList: true });
