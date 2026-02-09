// ============================================
// Authentication Module
// Handles Firebase Authentication
// ============================================

// ============================================
// Login Function
// ============================================
async function loginUser(email, password) {
  try {
    const userCredential = await auth.signInWithEmailAndPassword(email, password);
    console.log('Login successful:', userCredential.user.email);
    return { success: true, user: userCredential.user };
  } catch (error) {
    console.error('Login error:', error);
    return { success: false, error: error.message };
  }
}

// ============================================
// Register Function
// ============================================
async function registerUser(email, password) {
  try {
    const userCredential = await auth.createUserWithEmailAndPassword(email, password);
    console.log('Registration successful:', userCredential.user.email);
    
    // Initialize user document in Firestore
    await db.collection('users').doc(userCredential.user.uid).set({
      email: email,
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      hasBirthInfo: false
    });
    
    return { success: true, user: userCredential.user };
  } catch (error) {
    console.error('Registration error:', error);
    return { success: false, error: error.message };
  }
}

// ============================================
// Logout Function
// ============================================
async function logout() {
  try {
    await auth.signOut();
    console.log('Logout successful');
    window.location.href = 'guru.html';
    return { success: true };
  } catch (error) {
    console.error('Logout error:', error);
    return { success: false, error: error.message };
  }
}

// ============================================
// Password Reset Function
// ============================================
async function resetPassword(email) {
  try {
    await auth.sendPasswordResetEmail(email);
    return { success: true };
  } catch (error) {
    console.error('Password reset error:', error);
    return { success: false, error: error.message };
  }
}

// ============================================
// Get Current User
// ============================================
function getCurrentUser() {
  return auth.currentUser;
}

// ============================================
// Check if User is Authenticated
// ============================================
function isAuthenticated() {
  return auth.currentUser !== null;
}
