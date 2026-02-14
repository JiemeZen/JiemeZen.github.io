// ============================================
// MAIN.JS - Application Controller
// Controls DOM, View Switching, and Logic
// ============================================

// ============================================
// Utility Functions
// ============================================
function removeDeepSeekDisclaimer(text) {
  if (!text || typeof text !== 'string') {
    return text;
  }
  
  // Replace "DeepSeek" with "Guru" throughout the text
  return text.replace(/DeepSeek/g, 'Guru');
}

// ============================================
// BaZhi Calculation Functions
// ============================================
async function performInitialBaZhiCalculation(userId, birthInfo) {
  try {
    console.log('[BaZhi Calc] Starting calculation for user:', userId);
    
    // Step 1: Get the comprehensive BaZhi reading (in Chinese)
    const bazhiPrompt = buildBaZhiPrompt(birthInfo);
    const bazhiAnalysis_zn = await callBaZhiAPI(bazhiPrompt);
    
    console.log('[BaZhi Calc] Analysis received (Chinese), length:', bazhiAnalysis_zn.length);
    
    // Step 2: Start translation to English (async, don't wait)
    const translationPromise = translateMessage(bazhiAnalysis_zn, 'ZH-to-EN')
      .then(bazhiAnalysis_en => {
        console.log('[BaZhi Calc] Translation complete, length:', bazhiAnalysis_en.length);
        AppState.fullBaZhiAnalysis_en = bazhiAnalysis_en;
        
        // Update Firestore with English version
        saveBaZhiProfile(userId, {
          fullAnalysis_en: bazhiAnalysis_en
        }).catch(err => console.error('[BaZhi Calc] Error saving English translation:', err));
        
        return bazhiAnalysis_en;
      })
      .catch(err => {
        console.error('[BaZhi Calc] Translation error:', err);
        return null;
      });
    
    // Step 3: Extract elemental information from the Chinese analysis (parallel to translation)
    const extractionPrompt = buildElementExtractionPrompt(bazhiAnalysis_zn);
    const elementalDataJSON = await callBaZhiAPI(extractionPrompt, 0.3);
    
    console.log('[BaZhi Calc] Elemental data extracted:', elementalDataJSON);
    
    // Step 4: Parse the JSON response
    const elementalData = parseElementalJSON(elementalDataJSON);
    
    if (!elementalData) {
      console.error('[BaZhi Calc] Failed to parse elemental data');
      return;
    }
    
    // Step 5: Save the BaZhi profile to Firestore (Chinese version + elemental data)
    await saveBaZhiProfile(userId, {
      fullAnalysis_zn: bazhiAnalysis_zn,
      elementalData: elementalData,
      calculatedAt: new Date().toISOString()
    });
    
    // Step 6: Store Chinese analysis and display the elemental chart
    AppState.fullBaZhiAnalysis_zn = bazhiAnalysis_zn;
    displayElementalChart(elementalData);
    
    // Show the "Show Full Analysis" button
    const showMoreBtn = document.getElementById('btnShowMore');
    if (showMoreBtn) {
      showMoreBtn.style.display = 'block';
    }
    
    console.log('[BaZhi Calc] Calculation complete and saved');
    console.log('[BaZhi Calc] Translation running in background...');
    
  } catch (error) {
    console.error('[BaZhi Calc] Error during calculation:', error);
    // Don't block the UI, just log the error
  }
}

async function callBaZhiAPI(systemPrompt, temperature = 0.7) {
  try {
    const response = await fetch(BACKEND_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: '请开始分析' }
        ],
        temperature: temperature,
        max_tokens: 3000
      })
    });
    
    const data = await response.json();
    
    if (data.choices && data.choices[0]) {
      return removeDeepSeekDisclaimer(data.choices[0].message.content);
    } else {
      throw new Error('Invalid API response');
    }
  } catch (error) {
    console.error('[BaZhi API] Error:', error);
    throw error;
  }
}

function buildElementExtractionPrompt(bazhiAnalysis) {
  return `Based on the following BaZhi (八字) analysis, extract the Five Elements (五行) count and provide a figurative description of the person's elemental profile.

BaZhi Analysis:
${bazhiAnalysis}

Please respond with ONLY a JSON object in this exact format (no markdown, no code blocks, just raw JSON):
{
  "elements": {
    "Wood": <number>,
    "Fire": <number>,
    "Earth": <number>,
    "Metal": <number>,
    "Water": <number>
  },
  "description_en": "A brief 2-3 sentence figurative description in English of the person based on their elemental composition. Use metaphors related to nature and the elements.",
  "description_zh": "简短的2-3句中文比喻性描述，基于五行组成。使用与自然和元素相关的隐喻。",
  "summary_en": "A concise English summary of the analysis and the person's core characteristics and tendencies. Include yearly breakdowns.",
  "summary_zh": "简洁的中文分析总结，包括此人的核心特征和倾向。包括流年分析。"
}

Count each element stem and branch in the four pillars (year, month, day, hour). The total should be 8.`;
}

function parseElementalJSON(jsonString) {
  try {
    // Remove markdown code blocks if present
    let cleaned = jsonString.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    
    // Try to extract JSON if there's extra text
    const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      cleaned = jsonMatch[0];
    }
    
    const data = JSON.parse(cleaned);
    
    // Validate structure
    if (data.elements) {
      // Normalize element names to match our system
      const normalized = {
        wood: data.elements.Wood || data.elements.wood || 0,
        fire: data.elements.Fire || data.elements.fire || 0,
        earth: data.elements.Earth || data.elements.earth || 0,
        metal: data.elements.Metal || data.elements.metal || 0,
        water: data.elements.Water || data.elements.water || 0,
        description_en: data.description_en || data.description || '',
        description_zh: data.description_zh || data.description || '',
        summary_en: data.summary_en || data.summary || '',
        summary_zh: data.summary_zh || data.summary || ''
      };
      
      console.log('[JSON Parse] Normalized elemental data:', normalized);
      return normalized;
    }
    
    console.error('[JSON Parse] Invalid structure:', data);
    return null;
    
  } catch (error) {
    console.error('[JSON Parse] Error parsing JSON:', error);
    console.error('[JSON Parse] Input string:', jsonString);
    return null;
  }
}

async function saveBaZhiProfile(userId, profileData) {
  try {
    await db.collection('users').doc(userId).set({
      bazhiProfile: profileData
    }, { merge: true });
    
    console.log('[BaZhi Save] Profile saved successfully');
    return { success: true };
  } catch (error) {
    console.error('[BaZhi Save] Error:', error);
    return { success: false, error: error.message };
  }
}

async function loadBaZhiProfile(userId) {
  try {
    const doc = await db.collection('users').doc(userId).get();
    
    if (doc.exists && doc.data().bazhiProfile) {
      return { success: true, data: doc.data().bazhiProfile };
    }
    
    return { success: false };
  } catch (error) {
    console.error('[BaZhi Load] Error:', error);
    return { success: false, error: error.message };
  }
}

// ============================================
// Application State
// ============================================
const AppState = {
  currentView: 'auth', // 'auth', 'birthInfo', 'landing', 'chat'
  currentUser: null,
  birthInfo: null,
  currentChatId: null, // Track which chat session is active
  chineseConversationHistory: [],
  isNavigatingFromHash: false, // Prevent hash update loops
  currentLanguage: 'EN', // 'EN' or 'ZN'
  messageData: [], // Store messages with both EN and ZN versions
  elementalData: null, // Store elemental chart data for language switching
  fullBaZhiAnalysis_zn: null, // Store Chinese version of full BaZhi analysis
  fullBaZhiAnalysis_en: null, // Store English version of full BaZhi analysis
  showingFullAnalysis: false // Track if showing full analysis
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
  
  // App Shell - Logout Button
  const logoutBtn = document.getElementById('logoutBtn');
  if(logoutBtn) logoutBtn.addEventListener('click', handleLogout);
  
  // App Shell - Language Switch Button
  const langSwitch = document.getElementById('langSwitchBtn');
  if(langSwitch) langSwitch.addEventListener('click', handleLanguageSwitch);
  
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
  
  // Elemental Chart - Show More Button
  const showMoreBtn = document.getElementById('btnShowMore');
  if(showMoreBtn) {
    showMoreBtn.addEventListener('click', handleShowMoreAnalysis);
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
  submitBtn.textContent = 'Calculating your BaZhi...';
  
  const result = await saveBirthInfo(currentUser.uid, birthData);
  
  if (result.success) {
    AppState.birthInfo = birthData;
    
    // Perform BaZhi calculation immediately after saving birth info
    console.log('[BirthInfo] Triggering BaZhi calculation...');
    await performInitialBaZhiCalculation(currentUser.uid, birthData);
    
    showView('landing');
  } else {
    console.error('Failed to save birth info:', result.error);
    alert('Failed to save birth info: ' + result.error + '\n\nPlease check the browser console for more details.');
    submitBtn.disabled = false;
    submitBtn.textContent = 'Save & Start';
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
    
    // Reset current chat ID and message data
    AppState.currentChatId = null;
    AppState.messageData = [];
    
    // Show landing view
    showView('landing');
  }
}

// ============================================
// Language Switch Handler
// ============================================
function handleLanguageSwitch() {
  // Toggle language
  AppState.currentLanguage = AppState.currentLanguage === 'EN' ? 'ZN' : 'EN';
  
  // Update button display
  const langBtn = document.getElementById('langSwitchBtn');
  const langDisplay = langBtn.querySelector('.lang-display');
  langDisplay.textContent = AppState.currentLanguage === 'ZN' ? '中文' : 'EN';
  
  // Refresh chat display with new language
  refreshChatDisplay();
  
  // Refresh elemental chart if available
  if (AppState.elementalData && AppState.currentView === 'landing') {
    displayElementalChart(AppState.elementalData);
  }
  
  // Update full analysis display if currently showing
  const analysisTitle = document.getElementById('elementalAnalysisTitle');
  
  if (AppState.showingFullAnalysis) {
    const analysisContent = document.getElementById('analysisContent');
    const showMoreBtn = document.getElementById('btnShowMore');
    
    const fullAnalysis = AppState.currentLanguage === 'EN' 
      ? AppState.fullBaZhiAnalysis_en 
      : AppState.fullBaZhiAnalysis_zn;
    
    if (fullAnalysis && analysisContent) {
      // Parse markdown for proper formatting
      analysisContent.innerHTML = parseMarkdown(fullAnalysis);
    } else if (!fullAnalysis && analysisContent) {
      analysisContent.textContent = AppState.currentLanguage === 'EN' 
        ? 'Translation in progress, please wait...' 
        : '正在翻译中，请稍候...';
    }
    
    if (showMoreBtn) {
      showMoreBtn.textContent = AppState.currentLanguage === 'EN' ? 'Show Summary' : '显示摘要';
    }
    
    // Update title for full analysis
    if (analysisTitle) {
      analysisTitle.textContent = AppState.currentLanguage === 'EN' 
        ? 'Complete BaZhi Analysis' 
        : '完整八字分析';
    }
  } else {
    // Update button text and title when showing summary
    const showMoreBtn = document.getElementById('btnShowMore');
    if (showMoreBtn && showMoreBtn.style.display === 'block') {
      showMoreBtn.textContent = AppState.currentLanguage === 'EN' ? 'Show Full Analysis' : '显示完整分析';
    }
    
    // Update title for summary
    if (analysisTitle && analysisTitle.style.display === 'block') {
      analysisTitle.textContent = AppState.currentLanguage === 'EN' 
        ? 'Your BaZhi Analysis' 
        : '您的八字分析';
    }
  }
}

function refreshChatDisplay() {
  const messagesDiv = document.getElementById('chatMessages');
  if (!messagesDiv) return;
  
  // Clear current messages
  messagesDiv.innerHTML = '';
  
  // Redisplay all messages in the new language
  AppState.messageData.forEach(msg => {
    if (msg.type === 'user') {
      const text = AppState.currentLanguage === 'EN' ? msg.textEN : msg.textZN;
      displayMessage(text, 'user', false);
    } else if (msg.type === 'guru') {
      let text = AppState.currentLanguage === 'EN' ? msg.textEN : msg.textZN;
      // Remove disclaimer from Chinese responses
      if (AppState.currentLanguage === 'ZN') {
        text = removeDeepSeekDisclaimer(text);
      }
      displayMessage(text, 'guru', false);
    } else if (msg.type === 'system') {
      displaySystemMessage(msg.text);
    }
  });
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
  
  // Display user message in current language
  displayMessage(message, 'user', false);
  
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
    
    // Store user message with both languages
    AppState.messageData.push({
      type: 'user',
      textEN: message,
      textZN: chineseQuestion
    });
    
    // Store guru response with both languages
    AppState.messageData.push({
      type: 'guru',
      textEN: englishResponse,
      textZN: chineseResponse
    });
    
    // Auto-save to Firebase immediately to preserve chat history
    await saveChatMessage(AppState.currentUser.uid, AppState.currentChatId, {
      userMessage_EN: message,
      userMessage_ZH: chineseQuestion,
      guruResponse_ZH: chineseResponse,
      guruResponse_EN: englishResponse
    });
    
    // Display guru response in current language (don't store again, already stored above)
    const displayResponse = AppState.currentLanguage === 'EN' ? englishResponse : chineseResponse;
    displayMessage(displayResponse, 'guru', false);
    
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
    // Clear message data
    AppState.messageData = [];
    
    result.chats.forEach(chat => {
      // Store message data
      AppState.messageData.push({
        type: 'user',
        textEN: chat.userMessage_EN,
        textZN: chat.userMessage_ZH
      });
      AppState.messageData.push({
        type: 'guru',
        textEN: chat.guruResponse_EN,
        textZN: chat.guruResponse_ZH
      });
      
      // Display messages in current language
      const userText = AppState.currentLanguage === 'EN' ? chat.userMessage_EN : chat.userMessage_ZH;
      let guruText = AppState.currentLanguage === 'EN' ? chat.guruResponse_EN : chat.guruResponse_ZH;
      // Remove disclaimer from Chinese responses
      if (AppState.currentLanguage === 'ZN') {
        guruText = removeDeepSeekDisclaimer(guruText);
      }
      displayMessage(userText, 'user', false);
      displayMessage(guruText, 'guru', false);
      
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

function displayMessage(text, sender, animate = true, textEN = null, textZN = null) {
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
  
  // Store message data with both languages if provided (for new messages only)
  if (animate && textEN && textZN) {
    AppState.messageData.push({
      type: sender,
      textEN: textEN,
      textZN: textZN
    });
  }
  
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
  
  // Store system message
  AppState.messageData.push({
    type: 'system',
    text: text
  });
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
      loadAndDisplayBaZhiProfile();
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

// ============================================
// Elemental Chart Visualization
// ============================================
function handleShowMoreAnalysis() {
  const summaryElement = document.getElementById('elementSummary');
  const fullAnalysisElement = document.getElementById('elementFullAnalysis');
  const analysisContent = document.getElementById('analysisContent');
  const showMoreBtn = document.getElementById('btnShowMore');
  const analysisTitle = document.getElementById('elementalAnalysisTitle');
  
  if (!AppState.showingFullAnalysis) {
    // Show full analysis in the current language
    const fullAnalysis = AppState.currentLanguage === 'EN' 
      ? AppState.fullBaZhiAnalysis_en 
      : AppState.fullBaZhiAnalysis_zn;
    
    if (fullAnalysis && analysisContent) {
      // Parse markdown for proper formatting
      analysisContent.innerHTML = parseMarkdown(fullAnalysis);
      summaryElement.style.display = 'none';
      fullAnalysisElement.style.display = 'block';
      showMoreBtn.textContent = AppState.currentLanguage === 'EN' ? 'Show Summary' : '显示摘要';
      
      // Update title for full analysis
      if (analysisTitle) {
        analysisTitle.textContent = AppState.currentLanguage === 'EN' 
          ? 'Complete BaZhi Analysis' 
          : '完整八字分析';
      }
      
      AppState.showingFullAnalysis = true;
    } else if (!fullAnalysis && analysisContent) {
      // If translation not ready yet for EN, show loading message
      analysisContent.textContent = AppState.currentLanguage === 'EN' 
        ? 'Translation in progress, please wait...' 
        : '正在翻译中，请稍候...';
      summaryElement.style.display = 'none';
      fullAnalysisElement.style.display = 'block';
      showMoreBtn.textContent = AppState.currentLanguage === 'EN' ? 'Show Summary' : '显示摘要';
      
      // Update title for full analysis
      if (analysisTitle) {
        analysisTitle.textContent = AppState.currentLanguage === 'EN' 
          ? 'Complete BaZhi Analysis' 
          : '完整八字分析';
      }
      
      AppState.showingFullAnalysis = true;
    }
  } else {
    // Show summary
    summaryElement.style.display = 'block';
    fullAnalysisElement.style.display = 'none';
    showMoreBtn.textContent = AppState.currentLanguage === 'EN' ? 'Show Full Analysis' : '显示完整分析';
    
    // Update title for summary
    if (analysisTitle) {
      analysisTitle.textContent = AppState.currentLanguage === 'EN' 
        ? 'Your BaZhi Analysis' 
        : '您的八字分析';
    }
    
    AppState.showingFullAnalysis = false;
  }
}

async function loadAndDisplayBaZhiProfile() {
  if (!AppState.currentUser) return;
  
  const result = await loadBaZhiProfile(AppState.currentUser.uid);
  
  if (result.success && result.data.elementalData) {
    displayElementalChart(result.data.elementalData);
    
    // Store full analysis (both versions) and show button if available
    if (result.data.fullAnalysis_zn) {
      AppState.fullBaZhiAnalysis_zn = result.data.fullAnalysis_zn;
    }
    if (result.data.fullAnalysis_en) {
      AppState.fullBaZhiAnalysis_en = result.data.fullAnalysis_en;
    }
    // Legacy support for old data structure
    if (result.data.fullAnalysis && !result.data.fullAnalysis_zn) {
      AppState.fullBaZhiAnalysis_zn = result.data.fullAnalysis;
    }
    
    if (AppState.fullBaZhiAnalysis_zn || AppState.fullBaZhiAnalysis_en) {
      const showMoreBtn = document.getElementById('btnShowMore');
      if (showMoreBtn) {
        showMoreBtn.style.display = 'block';
      }
    }
  }
}

function displayElementalChart(elementalData) {
  console.log('[Display Chart] Showing elemental data:', elementalData);
  
  // Store in AppState for language switching
  AppState.elementalData = elementalData;
  
  // Show the container
  const container = document.getElementById('elementalChartContainer');
  if (container) {
    container.style.display = 'block';
  }
  
  // Update element counts
  document.getElementById('fireCount').textContent = elementalData.fire || 0;
  document.getElementById('earthCount').textContent = elementalData.earth || 0;
  document.getElementById('metalCount').textContent = elementalData.metal || 0;
  document.getElementById('waterCount').textContent = elementalData.water || 0;
  document.getElementById('woodCount').textContent = elementalData.wood || 0;
  
  // Update description based on current language
  const descElement = document.getElementById('elementDescription');
  if (descElement) {
    const description = AppState.currentLanguage === 'EN' 
      ? (elementalData.description_en || elementalData.description || '')
      : (elementalData.description_zh || elementalData.description || '');
    if (description) {
      descElement.innerHTML = `<p>${description}</p>`;
    }
  }
  
  // Update summary if available based on current language
  const summaryElement = document.getElementById('elementSummary');
  const analysisTitle = document.getElementById('elementalAnalysisTitle');
  
  if (summaryElement) {
    const summary = AppState.currentLanguage === 'EN'
      ? (elementalData.summary_en || elementalData.summary || '')
      : (elementalData.summary_zh || elementalData.summary || '');
    if (summary) {
      summaryElement.innerHTML = `<p>${summary}</p>`;
      summaryElement.style.display = 'block';
      
      // Show and set analysis title
      if (analysisTitle) {
        analysisTitle.textContent = AppState.currentLanguage === 'EN' 
          ? 'Your BaZhi Analysis' 
          : '您的八字分析';
        analysisTitle.style.display = 'block';
      }
    }
  }
  
  // Draw the circular strength diagram
  drawElementalCircle(elementalData);
}

function drawElementalCircle(elementalData) {
  const canvas = document.getElementById('elementalCanvas');
  if (!canvas) {
    console.error('[Draw Circle] Canvas not found');
    return;
  }
  
  const ctx = canvas.getContext('2d');
  const centerX = canvas.width / 2;
  const centerY = canvas.height / 2;
  const maxRadius = 150;
  
  // Clear canvas
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  
  // Element configuration matching the image
  const elements = [
    { name: 'fire', value: elementalData.fire || 0, color: '#d65745', angle: -90, label: '火\nFire' },
    { name: 'earth', value: elementalData.earth || 0, color: '#8b6f47', angle: -18, label: '土\nEarth' },
    { name: 'metal', value: elementalData.metal || 0, color: '#a8a8a8', angle: 54, label: '金\nMetal' },
    { name: 'water', value: elementalData.water || 0, color: '#5b9bd5', angle: 126, label: '水\nWater' },
    { name: 'wood', value: elementalData.wood || 0, color: '#7fb08e', angle: 198, label: '木\nWood' }
  ];
  
  // Find max value for scaling
  const maxValue = Math.max(...elements.map(e => e.value), 1);
  
  // Draw background circles (grid)
  ctx.strokeStyle = '#e0e0e0';
  ctx.lineWidth = 1;
  for (let i = 1; i <= 4; i++) {
    ctx.beginPath();
    ctx.arc(centerX, centerY, (maxRadius / 4) * i, 0, Math.PI * 2);
    ctx.stroke();
  }
  
  // Draw radial lines
  elements.forEach(element => {
    const angleRad = (element.angle * Math.PI) / 180;
    ctx.beginPath();
    ctx.moveTo(centerX, centerY);
    ctx.lineTo(
      centerX + Math.cos(angleRad) * maxRadius,
      centerY + Math.sin(angleRad) * maxRadius
    );
    ctx.stroke();
  });
  
  // Draw the elemental strength polygon
  ctx.beginPath();
  elements.forEach((element, index) => {
    const angleRad = (element.angle * Math.PI) / 180;
    const radius = (element.value / maxValue) * maxRadius;
    const x = centerX + Math.cos(angleRad) * radius;
    const y = centerY + Math.sin(angleRad) * radius;
    
    if (index === 0) {
      ctx.moveTo(x, y);
    } else {
      ctx.lineTo(x, y);
    }
  });
  ctx.closePath();
  
  // Fill with gradient
  const gradient = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, maxRadius);
  gradient.addColorStop(0, 'rgba(212, 175, 55, 0.4)');
  gradient.addColorStop(1, 'rgba(212, 175, 55, 0.1)');
  ctx.fillStyle = gradient;
  ctx.fill();
  
  // Stroke the polygon
  ctx.strokeStyle = '#d4af37';
  ctx.lineWidth = 2;
  ctx.stroke();
  
  // Draw element points and labels
  elements.forEach(element => {
    const angleRad = (element.angle * Math.PI) / 180;
    const radius = (element.value / maxValue) * maxRadius;
    const x = centerX + Math.cos(angleRad) * radius;
    const y = centerY + Math.sin(angleRad) * radius;
    
    // Draw point
    ctx.beginPath();
    ctx.arc(x, y, 6, 0, Math.PI * 2);
    ctx.fillStyle = element.color;
    ctx.fill();
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2;
    ctx.stroke();
    
    // Draw label at outer edge
    const labelRadius = maxRadius + 30;
    const labelX = centerX + Math.cos(angleRad) * labelRadius;
    const labelY = centerY + Math.sin(angleRad) * labelRadius;
    
    ctx.fillStyle = element.color;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    
    const lines = element.label.split('\n');
    lines.forEach((line, i) => {
      // Chinese characters use Ma Shan Zheng, English uses Times New Roman
      if (i === 0) {
        ctx.font = "bold 24px 'Ma Shan Zheng', cursive";
      } else {
        ctx.font = 'bold 14px Times New Roman, Times, serif';
      }
      ctx.fillText(line, labelX, labelY + (i - 0.5) * 16);
    });
  });
  
  // Draw center symbol
  ctx.fillStyle = '#d4af37';
  ctx.font = "bold 24px 'Ma Shan Zheng', cursive";
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('宁', centerX, centerY);
}
