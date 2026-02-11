// ============================================
// MAIN.JS - Application Controller
// Controls DOM, View Switching, and Logic
// ============================================

// ============================================
// Application State
// ============================================
const AppState = {
  currentView: 'auth', // 'auth', 'birthInfo', 'landing', 'chat'
  currentUser: null,
  birthInfo: null,
  currentChatId: null, // Track which chat session is active
  chineseConversationHistory: [],
  isNavigatingFromHash: false // Prevent hash update loops
};

// ============================================
// Hash Routing Configuration
// ============================================
const HashMapping = {
  'auth': '#login',
  'birthInfo': '#setup',
  'landing': '#home',
  'chat': '#chat'
};

const ViewMapping = {
  '#login': 'auth',
  '#register': 'auth', // Alias for auth view
  '#setup': 'birthInfo',
  '#home': 'landing',
  '#chat': 'chat'
};

// ============================================
// View Management
// ============================================
function showView(viewName, fromHash = false) {
  console.log('[showView] Switching to:', viewName, 'fromHash:', fromHash);
  
  // 1. Hide Top-Level Overlay Views (Auth, BirthInfo)
  document.querySelectorAll('.view').forEach(view => {
    view.classList.add('hidden');
  });

  // 2. Hide Internal App Views (Landing, Chat inside Shell)
  document.querySelectorAll('.view-content').forEach(vc => {
    vc.classList.remove('active');
    vc.classList.add('hidden');
  });
  
  const appShell = document.getElementById('appShell');
  const viewMap = {
    'auth': 'authView',
    'birthInfo': 'birthInfoView',
    'landing': 'landingView',
    'chat': 'chatView'
  };
  
  const targetId = viewMap[viewName];
  if (!targetId) {
    console.error('[showView] Invalid view name:', viewName);
    return;
  }

  console.log('[showView] Target element ID:', targetId);

  if (viewName === 'auth' || viewName === 'birthInfo') {
    // Mode: Overlay View
    if(appShell) appShell.classList.add('hidden');
    const el = document.getElementById(targetId);
    if(el) {
      el.classList.remove('hidden');
      console.log('[showView] Showing overlay view:', targetId);
    } else {
      console.error('[showView] Element not found:', targetId);
    }
  } else {
    // Mode: App Shell View
    if(appShell) appShell.classList.remove('hidden');
    const el = document.getElementById(targetId);
    if(el) {
        el.classList.remove('hidden');
        el.classList.add('active');
        console.log('[showView] Showing app view:', targetId);
    } else {
      console.error('[showView] Element not found:', targetId);
    }
  }

  AppState.currentView = viewName;
  
  // Update body class for view-specific styling (e.g., seal position)
  document.body.className = document.body.className.replace(/view-\w+/g, '');
  if (viewName) {
    document.body.classList.add(`view-${viewName}`);
  }
  
  // Update home button visibility (hide on landing, show on chat)
  updateHomeButtonVisibility(viewName);
  
  // Update URL hash (but not if we're already navigating from a hash change)
  if (!fromHash && HashMapping[viewName]) {
    AppState.isNavigatingFromHash = true;
    window.location.hash = HashMapping[viewName];
    // Reset flag after a short delay
    setTimeout(() => {
      AppState.isNavigatingFromHash = false;
    }, 100);
  }
  
  console.log('Switched to view:', viewName);
}

function updateHomeButtonVisibility(viewName) {
  const homeBtn = document.getElementById('homeBtn');
  if (!homeBtn) return;
  
  // Hide home button on landing page, show on chat page
  if (viewName === 'landing') {
    homeBtn.style.display = 'none';
  } else if (viewName === 'chat') {
    homeBtn.style.display = 'block';
  } else {
    homeBtn.style.display = 'none';
  }
}

function handleHashChange() {
  // Prevent infinite loops
  if (AppState.isNavigatingFromHash) {
    return;
  }
  
  const hash = window.location.hash || '#login';
  const viewName = ViewMapping[hash];
  
  if (viewName && viewName !== AppState.currentView) {
    console.log('Hash changed to:', hash, '-> View:', viewName);
    showView(viewName, true);
  }
}

function initializeFromHash() {
  const hash = window.location.hash || '#login';
  const viewName = ViewMapping[hash];
  
  // If there's a valid hash, it will be used by the auth state listener
  // Store it for later use
  if (viewName) {
    console.log('Initial hash:', hash, '-> View:', viewName);
  }
}

// ============================================
// Initialize Application
// ============================================
document.addEventListener('DOMContentLoaded', () => {
  console.log('BaZhi Guru App Initialized');
  
  // Initialize from hash
  initializeFromHash();
  
  // Set up hash change listener
  window.addEventListener('hashchange', handleHashChange);
  
  // Set up auth state listener
  setupAuthStateListener();
  
  // Set up event listeners
  setupEventListeners();
  
  // Set up scroll listener for header minimization
  setupScrollListener();
});

// ============================================
// Auth State Management
// ============================================
function setupAuthStateListener() {
  auth.onAuthStateChanged(async (user) => {
    console.log('[Auth State Change] User:', user ? user.email : 'null');
    
    if (user) {
      // User is logged in
      AppState.currentUser = user;
      console.log('User authenticated:', user.email);
      
      // Clear any auth status messages before navigating
      hideAuthStatusMessage();
      
      // Update user email displays
      updateUserEmailDisplays(user.email);
      
      // Check if user has birth info
      console.log('[Auth State] Checking birth info for user:', user.uid);
      const hasBirthInfo = await loadUserBirthInfo(user.uid);
      console.log('[Auth State] Has birth info:', hasBirthInfo);
      
      // Check current hash to determine view
      const hash = window.location.hash || '';
      const requestedView = ViewMapping[hash];
      console.log('[Auth State] Current hash:', hash, 'Requested view:', requestedView);
      
      if (hasBirthInfo) {
        // User has completed setup
        if (requestedView === 'chat' || requestedView === 'landing') {
          // Honor the hash if it's valid for this state
          console.log('[Auth State] Navigating to requested view:', requestedView);
          showView(requestedView);
        } else {
          // Default to landing page
          console.log('[Auth State] Navigating to default landing view');
          showView('landing');
        }
      } else {
        // User needs to complete birth info setup
        console.log('[Auth State] Navigating to birth info setup');
        showView('birthInfo');
      }
    } else {
      // User is not logged in
      AppState.currentUser = null;
      AppState.birthInfo = null;
      AppState.currentChatId = null;
      AppState.chineseConversationHistory = [];
      console.log('User not authenticated');
      showView('auth');
    }
  });
}

function updateUserEmailDisplays(email) {
  const headerEmail = document.getElementById('headerUserEmail');
  if(headerEmail) headerEmail.textContent = email;
  
  // App Shell Email
  const appEmail = document.getElementById('appUserEmail');
  if(appEmail) appEmail.textContent = email;
}

// ============================================
// Event Listeners Setup
// ============================================
function setupEventListeners() {
  // Auth View - Tab Switching
  document.querySelectorAll('.tab').forEach(tab => {
    tab.addEventListener('click', () => {
      const tabName = tab.getAttribute('data-tab');
      switchAuthTab(tabName);
    });
  });
  
  // Auth View - Login Form
  document.getElementById('loginFormElement').addEventListener('submit', handleLoginSubmit);
  
  // Auth View - Register Form
  document.getElementById('registerFormElement').addEventListener('submit', handleRegisterSubmit);
  
  // Auth View - Forgot Password
  document.getElementById('forgotPasswordLink').addEventListener('click', handleForgotPassword);
  
  // Birth Info View - Form Submit
  document.getElementById('birthInfoForm').addEventListener('submit', handleBirthInfoSubmit);
  
  // Birth Info View - Gender Button Selection
  const genderButtons = document.querySelectorAll('.gender-btn');
  const genderButtonsContainer = document.querySelector('.gender-buttons');
  
  genderButtons.forEach(btn => {
    btn.addEventListener('click', function() {
      // Remove active from all buttons
      genderButtons.forEach(b => b.classList.remove('active'));
      // Add active to clicked button
      this.classList.add('active');
      
      // Update container class for sliding indicator
      if (this.getAttribute('data-value') === 'Female') {
        genderButtonsContainer.classList.add('female-active');
      } else {
        genderButtonsContainer.classList.remove('female-active');
      }
      
      // Set hidden input value
      document.getElementById('gender').value = this.getAttribute('data-value');
    });
  });
  
  // Birth Info View - Logout
  const headerLogout = document.getElementById('headerLogoutBtn');
  if(headerLogout) headerLogout.addEventListener('click', handleLogout);
  
  // App Shell - Logout (Replaces Landing/Chat logout)
  const appLogout = document.getElementById('appLogoutBtn');
  if(appLogout) appLogout.addEventListener('click', handleLogout);
  
  // App Shell - Session Navigation (Sidebar & Mobile)
  const sessionButtons = document.querySelectorAll('.session-card-mini, .btn-session-mobile');
  sessionButtons.forEach(btn => {
    btn.addEventListener('click', () => {
        // Highlight active session in sidebar
        document.querySelectorAll('.session-card-mini').forEach(c => c.classList.remove('active'));
        if(btn.classList.contains('session-card-mini')) btn.classList.add('active'); // Only works if clicking sidebar link
        
        const chatId = btn.getAttribute('data-chat-id');
        handleChatSessionClick(chatId);
    });
  });
  
  // New Session Buttons
  document.querySelectorAll('.btn-new-session, .btn-new-session-mobile').forEach(btn => {
      btn.addEventListener('click', () => {
          if(confirm("Start a new consultation session?")) {
              // Logic to create new session ID or clear current
              handleChatSessionClick('new'); // Placeholder logic
          }
      });
  });
  
  // Chat View - Home Button
  const homeBtn = document.getElementById('homeBtn');
  if(homeBtn) homeBtn.addEventListener('click', handleHomeClick);
  
  // Chat View - Send Message
  const sendBtn = document.getElementById('sendMessageBtn');
  if(sendBtn) sendBtn.addEventListener('click', handleSendMessage);
  
  // Chat View - Enter key in input
  const msgInput = document.getElementById('messageInput');
  if(msgInput) {
      msgInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
          handleSendMessage();
        }
      });
  }
}

// ============================================
// Auth Tab Switching
// ============================================
function switchAuthTab(tabName) {
  // Update tab buttons
  document.querySelectorAll('.tab').forEach(tab => {
    if (tab.getAttribute('data-tab') === tabName) {
      tab.classList.add('active');
    } else {
      tab.classList.remove('active');
    }
  });
  
  // Update form visibility
  if (tabName === 'login') {
    document.getElementById('loginForm').classList.add('active');
    document.getElementById('registerForm').classList.remove('active');
  } else if (tabName === 'register') {
    document.getElementById('loginForm').classList.remove('active');
    document.getElementById('registerForm').classList.add('active');
  }
  
  // Clear status messages
  hideAuthStatusMessage();
}

// ============================================
// Status Messages (Auth View)
// ============================================
function showAuthStatusMessage(message, type = 'info') {
  const statusDiv = document.getElementById('authStatusMessage');
  statusDiv.textContent = message;
  statusDiv.className = `status-message status-${type} active`;
}

function hideAuthStatusMessage() {
  const statusDiv = document.getElementById('authStatusMessage');
  statusDiv.className = 'status-message';
}

// ============================================
// Auth Handlers
// ============================================
async function handleLoginSubmit(event) {
  event.preventDefault();
  
  const email = document.getElementById('loginEmail').value;
  const password = document.getElementById('loginPassword').value;
  
  showAuthStatusMessage('Logging in...', 'info');
  
  const result = await loginUser(email, password);
  
  if (result.success) {
    console.log('[Login] Success - Auth state listener will handle navigation');
    // Show brief success message, then clear it
    showAuthStatusMessage('Login successful!', 'success');
    // Clear message after 500ms to ensure clean transition
    setTimeout(() => {
      hideAuthStatusMessage();
    }, 500);
    // Auth state listener will handle view switching
  } else {
    showAuthStatusMessage(`Login failed: ${result.error}`, 'error');
  }
}

async function handleRegisterSubmit(event) {
  event.preventDefault();
  
  const email = document.getElementById('registerEmail').value;
  const password = document.getElementById('registerPassword').value;
  const confirmPassword = document.getElementById('registerPasswordConfirm').value;
  
  // Validate passwords match
  if (password !== confirmPassword) {
    showAuthStatusMessage('Passwords do not match!', 'error');
    return;
  }
  
  if (password.length < 6) {
    showAuthStatusMessage('Password must be at least 6 characters!', 'error');
    return;
  }
  
  showAuthStatusMessage('Creating account...', 'info');
  
  const result = await registerUser(email, password);
  
  if (result.success) {
    console.log('[Register] Success - Auth state listener will handle navigation');
    showAuthStatusMessage('Account created successfully!', 'success');
    // Clear message after 500ms to ensure clean transition
    setTimeout(() => {
      hideAuthStatusMessage();
    }, 500);
    // Auth state listener will handle view switching
  } else {
    showAuthStatusMessage(`Registration failed: ${result.error}`, 'error');
  }
}

async function handleForgotPassword(event) {
  event.preventDefault();
  
  const email = document.getElementById('loginEmail').value;
  
  if (!email) {
    showAuthStatusMessage('Please enter your email address first', 'error');
    return;
  }
  
  const result = await resetPassword(email);
  
  if (result.success) {
    showAuthStatusMessage('Password reset email sent! Check your inbox.', 'success');
  } else {
    showAuthStatusMessage(`Failed to send reset email: ${result.error}`, 'error');
  }
}

async function handleLogout() {
  if (confirm('Are you sure you want to logout?')) {
    await logout();
    // Auth state listener will handle view switching
  }
}

// ============================================
// Birth Info Handlers
// ============================================
async function handleBirthInfoSubmit(event) {
  event.preventDefault();
  
  // Verify user is authenticated
  const currentUser = auth.currentUser;
  if (!currentUser) {
    alert('Error: You must be logged in to save birth information.');
    return;
  }
  
  console.log('Saving birth info for user:', currentUser.uid);
  
  const birthData = {
    year: parseInt(document.getElementById('birthYear').value),
    month: parseInt(document.getElementById('birthMonth').value),
    day: parseInt(document.getElementById('birthDay').value),
    hour: parseInt(document.getElementById('birthHour').value),
    birthplace: document.getElementById('birthPlace').value,
    gender: document.getElementById('gender').value
  };
  
  // Disable submit button to prevent double-submission
  const submitBtn = event.target.querySelector('button[type="submit"]');
  submitBtn.disabled = true;
  submitBtn.textContent = 'Saving...';
  
  const result = await saveBirthInfo(currentUser.uid, birthData);
  
  if (result.success) {
    AppState.birthInfo = birthData;
    showView('landing');
  } else {
    console.error('Failed to save birth info:', result.error);
    alert('Failed to save birth info: ' + result.error + '\n\nPlease check the browser console for more details.');
    submitBtn.disabled = false;
    submitBtn.textContent = 'Save & Start Consultation';
  }
}

async function loadUserBirthInfo(userId) {
  try {
    console.log('[loadUserBirthInfo] Loading for user:', userId);
    const result = await loadBirthInfo(userId);
    console.log('[loadUserBirthInfo] Result:', result);
    if (result.success) {
      AppState.birthInfo = result.data;
      return true;
    }
    return false;
  } catch (error) {
    console.error('[loadUserBirthInfo] Error:', error);
    return false;
  }
}

// ============================================
// Landing Page Handlers
// ============================================
async function handleChatSessionClick(chatId) {
  console.log('Loading chat session:', chatId);
  
  if (chatId === 'new') {
      // Create a temporary ID or handle new session logic
      chatId = 'chat' + (Math.floor(Math.random() * 1000));
      AppState.chineseConversationHistory = [];
      document.getElementById('chatMessages').innerHTML = '';
      displaySystemMessage('Starting a new consultation...');
      AppState.currentChatId = chatId;
      showView('chat');
      return;
  }

  AppState.currentChatId = chatId;
  AppState.chineseConversationHistory = [];
  
  // Clear chat messages
  const chatMsgContainer = document.getElementById('chatMessages');
  if(chatMsgContainer) chatMsgContainer.innerHTML = '';
  
  // Load chat history for this session
  await loadChatSession(AppState.currentUser.uid, chatId);
  
  // Show chat view
  showView('chat');
}

function handleHomeClick() {
  if (confirm('Return to home? Current chat session will remain saved.')) {
    // Clear active state from all sidebar sessions
    document.querySelectorAll('.session-card-mini').forEach(c => c.classList.remove('active'));
    
    // Reset current chat ID
    AppState.currentChatId = null;
    
    // Show landing view
    showView('landing');
  }
}

// ============================================
// Chat Handlers
// ============================================
async function handleSendMessage() {
  const input = document.getElementById('messageInput');
  const message = input.value.trim();
  
  if (!message) return;
  
  // Check if a chat session is selected
  if (!AppState.currentChatId) {
    alert('Please select a chat session from the home page first.');
    return;
  }
  
  // Disable input while processing
  input.disabled = true;
  document.getElementById('sendMessageBtn').disabled = true;
  
  // Display user message
  displayMessage(message, 'user');
  
  // Clear input
  input.value = '';
  
  try {
    // Step 1: Translate to Chinese
    showLoading('Translating your question...');
    const chineseQuestion = await translateMessage(message, 'EN-to-ZH');
    console.log('Chinese question:', chineseQuestion);
    
    // Step 2: Get BaZhi Guru response
    showLoading('Consulting the BaZhi Guru...');
    const chineseResponse = await getBaZhiResponse(chineseQuestion, AppState.birthInfo, AppState.chineseConversationHistory);
    console.log('Chinese response:', chineseResponse);
    
    // Step 3: Translate to English
    showLoading('Translating the response...');
    const englishResponse = await translateMessage(chineseResponse, 'ZH-to-EN');
    console.log('English response:', englishResponse);
    
    hideLoading();
    
    // Update conversation history
    AppState.chineseConversationHistory.push(
      { role: 'user', content: chineseQuestion },
      { role: 'assistant', content: chineseResponse }
    );
    
    // Auto-save to Firebase immediately to preserve chat history
    await saveChatMessage(AppState.currentUser.uid, AppState.currentChatId, {
      userMessage_EN: message,
      userMessage_ZH: chineseQuestion,
      guruResponse_ZH: chineseResponse,
      guruResponse_EN: englishResponse
    });
    
    // Display guru response after saving
    displayMessage(englishResponse, 'guru');
    
  } catch (error) {
    hideLoading();
    console.error('Error:', error);
    displaySystemMessage('Sorry, an error occurred. Please try again.');
  }
  
  // Re-enable input
  input.disabled = false;
  document.getElementById('sendMessageBtn').disabled = false;
  input.focus();
}

async function loadChatSession(userId, chatId) {
  console.log('loadChatSession called with userId:', userId, 'chatId:', chatId);
  const result = await loadChatHistory(userId, chatId);
  
  console.log('loadChatHistory result:', result);
  
  if (result.success && result.chats && result.chats.length > 0) {
    // Display previous messages
    result.chats.forEach(chat => {
      displayMessage(chat.userMessage_EN, 'user', false);
      displayMessage(chat.guruResponse_EN, 'guru', false);
      
      // Rebuild Chinese conversation history
      AppState.chineseConversationHistory.push(
        { role: 'user', content: chat.userMessage_ZH },
        { role: 'assistant', content: chat.guruResponse_ZH }
      );
    });
    
    console.log('Chat session loaded successfully:', chatId, '- Messages displayed:', result.chats.length);
  } else {
    console.log('No messages to display for session:', chatId);
    displaySystemMessage('Start a new conversation! Ask the BaZhi Guru anything.');
  }
}

// ============================================
// Message Display Functions
// ============================================
function parseMarkdown(text) {
  // Convert markdown to HTML
  let html = text;
  
  // Headers (##, ###)
  html = html.replace(/^#### (.*$)/gim, '<h4>$1</h4>');
  html = html.replace(/^### (.*$)/gim, '<h3>$1</h3>');
  html = html.replace(/^## (.*$)/gim, '<h2>$1</h2>');
  html = html.replace(/^# (.*$)/gim, '<h1>$1</h1>');
  
  // Bold **text** or __text__
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/__(.+?)__/g, '<strong>$1</strong>');
  
  // Italic *text* or _text_
  html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');
  html = html.replace(/_(.+?)_/g, '<em>$1</em>');
  
  // Line breaks (double newline = paragraph)
  html = html.replace(/\n\n/g, '</p><p>');
  
  // Single line breaks
  html = html.replace(/\n/g, '<br>');
  
  // Wrap in paragraph if needed
  if (!html.startsWith('<h') && !html.startsWith('<p>')) {
    html = '<p>' + html + '</p>';
  }
  
  // Lists - unordered
  html = html.replace(/^\*\* (.+)$/gim, '<li>$1</li>');
  html = html.replace(/^- (.+)$/gim, '<li>$1</li>');
  html = html.replace(/(<li>.*<\/li>)/s, '<ul>$1</ul>');
  
  // Lists - ordered
  html = html.replace(/^\d+\. (.+)$/gim, '<li>$1</li>');
  
  // Code blocks ```code```
  html = html.replace(/```([\s\S]*?)```/g, '<pre><code>$1</code></pre>');
  
  // Inline code `code`
  html = html.replace(/`([^`]+)`/g, '<code>$1</code>');
  
  return html;
}

function displayMessage(text, sender, animate = true) {
  const messagesDiv = document.getElementById('chatMessages');
  const messageDiv = document.createElement('div');
  
  messageDiv.className = `message message-${sender}`;
  
  // Parse markdown for guru messages, plain text for user messages
  if (sender === 'guru') {
    messageDiv.innerHTML = parseMarkdown(text);
  } else {
    messageDiv.textContent = text;
  }
  
  if (!animate) {
    messageDiv.style.animation = 'none';
  }
  
  messagesDiv.appendChild(messageDiv);
  
  // Scroll to bottom
  messagesDiv.scrollTop = messagesDiv.scrollHeight;
}

function displaySystemMessage(text) {
  const messagesDiv = document.getElementById('chatMessages');
  const messageDiv = document.createElement('div');
  
  messageDiv.style.cssText = 'text-align: center; color: var(--stone-gray); padding: 20px; font-style: italic;';
  messageDiv.textContent = text;
  
  messagesDiv.appendChild(messageDiv);
  messagesDiv.scrollTop = messagesDiv.scrollHeight;
}

// ============================================
// Loading Indicator
// ============================================
function showLoading(text) {
  const loadingDiv = document.getElementById('loadingIndicator');
  const loadingText = document.getElementById('loadingText');
  loadingText.textContent = text;
  loadingDiv.classList.add('active');
}

function hideLoading() {
  document.getElementById('loadingIndicator').classList.remove('active');
}

// ============================================
// Header Scroll Behavior
// ============================================
function setupScrollListener() {
  const chatMessages = document.getElementById('chatMessages');
  let lastScrollTop = 0;
  
  if (chatMessages) {
    chatMessages.addEventListener('scroll', () => {
      const header = document.querySelector('#chatView header');
      if (!header) return;
      
      const scrollTop = chatMessages.scrollTop;
      
      // Minimize header when scrolled down more than 50px
      if (scrollTop > 50) {
        header.classList.add('minimized');
      } else {
        header.classList.remove('minimized');
      }
      
      lastScrollTop = scrollTop;
    });
  }
}

// ============================================
// Rotating Text Animation
// ============================================
function setupRotatingText() {
  const texts = [
    "Know your elements. Master your life.",
    "The stars shape your tendencies; your choices shape your fate.",
    "Unlock your elemental balance. Begin your transformation.",
    "Heaven gives the chart. Earth gives the stage. Human to act.",
    "When Yin and Yang harmonize, your destiny follows."
  ];
  
  let currentIndex = 0;
  const rotatingTextElement = document.getElementById('rotatingText');
  
  if (!rotatingTextElement) return;
  
  setInterval(() => {
    // Fade out
    rotatingTextElement.classList.add('fade-out');
    
    setTimeout(() => {
      // Change text
      currentIndex = (currentIndex + 1) % texts.length;
      rotatingTextElement.textContent = texts[currentIndex];
      
      // Fade in
      rotatingTextElement.classList.remove('fade-out');
    }, 1000); // Wait for fade out to complete
    
  }, 5000); // Change every 5 seconds
}

// Start rotating text when landing view is shown
const originalShowView = showView;
showView = function(viewName) {
  originalShowView(viewName);
  if (viewName === 'landing') {
    setTimeout(() => {
      setupRotatingText();
      setupSessionCardFade();
    }, 100);
  }
};

// ============================================
// Session Card Fade Animation
// ============================================
function setupSessionCardFade() {
  const sessionCards = document.querySelectorAll('.session-card');
  if (sessionCards.length === 0) return;
  
  let currentCardIndex = 0;
  
  setInterval(() => {
    const currentCard = sessionCards[currentCardIndex];
    
    // Fade to 60%
    currentCard.classList.add('fading');
    
    setTimeout(() => {
      // Fade back to 100%
      currentCard.classList.remove('fading');
      
      // Move to next card
      currentCardIndex = (currentCardIndex + 1) % sessionCards.length;
    }, 2000); // Stay faded for 2 seconds (half of 4 seconds)
    
  }, 4000); // Cycle every 4 seconds
}
