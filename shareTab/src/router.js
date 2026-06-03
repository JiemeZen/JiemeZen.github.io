// ============================================
// Router Module
// Hash-based SPA routing
// ============================================

const routes = {
    login: 'view-login',
    signup: 'view-signup',
    dashboard: 'view-dashboard',
    group: 'view-group'
};

let currentRoute = null;
let currentGroupId = null;

// ============================================
// Navigation
// ============================================
export function navigate(hash) {
    window.location.hash = hash;
}

export function getCurrentRoute() {
    return currentRoute;
}

export function getCurrentGroupId() {
    return currentGroupId;
}

// ============================================
// Route Parsing
// ============================================
function parseHash(hash) {
    const cleaned = hash.replace('#', '') || 'login';
    
    // Check for group/:id pattern
    if (cleaned.startsWith('group/')) {
        const groupId = cleaned.split('/')[1];
        return { route: 'group', groupId };
    }
    
    return { route: cleaned, groupId: null };
}

// ============================================
// View Switching
// ============================================
function showView(routeName) {
    // Hide all views
    document.querySelectorAll('.view').forEach(v => v.classList.add('hidden'));
    
    // Show target view
    const viewId = routes[routeName];
    if (viewId) {
        const viewEl = document.getElementById(viewId);
        if (viewEl) {
            viewEl.classList.remove('hidden');
        }
    }

    // Show/hide header for authenticated views
    const header = document.getElementById('app-header');
    if (routeName === 'login' || routeName === 'signup') {
        header.classList.add('hidden');
    } else {
        header.classList.remove('hidden');
    }
}

// ============================================
// Route Handler
// ============================================
function handleRoute() {
    const { route, groupId } = parseHash(window.location.hash);
    currentRoute = route;
    currentGroupId = groupId;
    
    showView(route);
    
    // Dispatch route change event
    window.dispatchEvent(new CustomEvent('route-changed', { 
        detail: { route, groupId } 
    }));
}

// ============================================
// Auth Guard
// ============================================
export function applyAuthGuard(user) {
    const { route } = parseHash(window.location.hash);
    
    if (!user && route !== 'login' && route !== 'signup') {
        navigate('login');
        return;
    }
    
    if (user && (route === 'login' || route === 'signup')) {
        navigate('dashboard');
        return;
    }
    
    handleRoute();
}

// ============================================
// Initialize Router
// ============================================
export function initRouter() {
    window.addEventListener('hashchange', handleRoute);
    // Don't call handleRoute here — let auth guard decide initial view
}
