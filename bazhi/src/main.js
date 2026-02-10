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
  chineseConversationHistory: []
};

// ============================================
// View Management
// ============================================
function showView(viewName) {
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
  if (!targetId) return;

  if (viewName === 'auth' || viewName === 'birthInfo') {
    // Mode: Overlay View
    if(appShell) appShell.classList.add('hidden');
    const el = document.getElementById(targetId);
    if(el) el.classList.remove('hidden');
  } else {
    // Mode: App Shell View
    if(appShell) appShell.classList.remove('hidden');
    const el = document.getElementById(targetId);
    if(el) {
        el.classList.remove('hidden');
        el.classList.add('active');
    }
  }

  AppState.currentView = viewName;
  console.log('Switched to view:', viewName);
}

// ============================================
// Initialize Application
// ============================================
document.addEventListener('DOMContentLoaded', () => {
  console.log('BaZhi Guru App Initialized');
  
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
    if (user) {
      // User is logged in
      AppState.currentUser = user;
      console.log('User authenticated:', user.email);
      
      // Update user email displays
      updateUserEmailDisplays(user.email);
      
      // Check if user has birth info
      const hasBirthInfo = await loadUserBirthInfo(user.uid);
      
      if (hasBirthInfo) {
        // Show landing page with chat sessions
        showView('landing');
      } else {
        // Show birth info setup
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
    showAuthStatusMessage('Login successful!', 'success');
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
    showAuthStatusMessage('Account created successfully!', 'success');
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
  const result = await loadBirthInfo(userId);
  if (result.success) {
    AppState.birthInfo = result.data;
    return true;
  }
  return false;
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
    
    // Display guru response
    displayMessage(englishResponse, 'guru');
    
    // Update conversation history
    AppState.chineseConversationHistory.push(
      { role: 'user', content: chineseQuestion },
      { role: 'assistant', content: chineseResponse }
    );
    
    // Save to Firebase with chat session ID
    await saveChatMessage(AppState.currentUser.uid, AppState.currentChatId, {
      userMessage_EN: message,
      userMessage_ZH: chineseQuestion,
      guruResponse_ZH: chineseResponse,
      guruResponse_EN: englishResponse
    });
    
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
    "Heaven gives the chart. Earth gives the stage. Human gives the action.",
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
