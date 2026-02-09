// ============================================
// Chat Module
// Handles chat logic, API calls, and data
// ============================================

// ============================================
// Birth Info Management
// ============================================
async function loadBirthInfo(userId) {
  try {
    const doc = await db.collection('users').doc(userId).get();
    
    if (doc.exists) {
      const data = doc.data();
      if (data.birthInfo) {
        console.log('Birth info loaded:', data.birthInfo);
        return { success: true, data: data.birthInfo };
      } else {
        console.log('User document exists but no birth info saved yet');
        return { success: false };
      }
    } else {
      console.log('User document does not exist');
      return { success: false };
    }
  } catch (error) {
    console.error('Error loading birth info:', error);
    return { success: false, error: error.message };
  }
}

async function saveBirthInfo(userId, data) {
  try {
    // Verify user is authenticated
    const currentUser = auth.currentUser;
    if (!currentUser) {
      throw new Error('User not authenticated');
    }
    
    if (currentUser.uid !== userId) {
      throw new Error('User ID mismatch');
    }
    
    console.log('Attempting to save birth info to Firestore...');
    console.log('User ID:', userId);
    console.log('Data:', data);
    
    // Try to save with set and merge
    await db.collection('users').doc(userId).set({
      email: currentUser.email,
      birthInfo: data,
      hasBirthInfo: true,
      birthInfoUpdatedAt: firebase.firestore.FieldValue.serverTimestamp()
    }, { merge: true });
    
    console.log('Birth info saved successfully');
    return { success: true };
  } catch (error) {
    console.error('Error saving birth info:', error);
    console.error('Error code:', error.code);
    console.error('Error message:', error.message);
    return { success: false, error: `${error.code}: ${error.message}` };
  }
}

// ============================================
// Chat History Management
// ============================================
async function loadChatHistory(userId, chatId) {
  try {
    console.log('Attempting to load chat history for userId:', userId, 'chatId:', chatId);
    const doc = await db.collection('users').doc(userId).get();
    
    if (doc.exists) {
      const data = doc.data();
      console.log('User document exists. ChatSessions:', data.chatSessions);
      
      if (data.chatSessions && data.chatSessions[chatId]) {
        const chats = data.chatSessions[chatId];
        console.log('Chat history loaded for session:', chatId, '- Messages:', chats.length);
        return { success: true, chats: chats };
      } else {
        console.log('No chat history found for session:', chatId);
        return { success: true, chats: [] };
      }
    } else {
      console.log('User document does not exist');
      return { success: true, chats: [] };
    }
  } catch (error) {
    console.error('Error loading chat history:', error);
    return { success: false, error: error.message };
  }
}

async function saveChatMessage(userId, chatId, chatData) {
  try {
    const chatEntry = {
      timestamp: new Date().toISOString(),
      userMessage_EN: chatData.userMessage_EN,
      userMessage_ZH: chatData.userMessage_ZH,
      guruResponse_ZH: chatData.guruResponse_ZH,
      guruResponse_EN: chatData.guruResponse_EN
    };
    
    console.log('Saving chat message to userId:', userId, 'chatId:', chatId);
    
    // Get current document to check structure
    const docRef = db.collection('users').doc(userId);
    const doc = await docRef.get();
    
    let updateData = {};
    
    if (doc.exists && doc.data().chatSessions && doc.data().chatSessions[chatId]) {
      // Chat session exists, append to array
      updateData[`chatSessions.${chatId}`] = firebase.firestore.FieldValue.arrayUnion(chatEntry);
    } else {
      // Chat session doesn't exist, create new array
      const chatSessions = doc.exists && doc.data().chatSessions ? { ...doc.data().chatSessions } : {};
      chatSessions[chatId] = [chatEntry];
      updateData.chatSessions = chatSessions;
    }
    
    await docRef.set(updateData, { merge: true });
    
    console.log('Chat saved to Firebase for session:', chatId);
    return { success: true };
  } catch (error) {
    console.error('Error saving chat:', error);
    return { success: false, error: error.message };
  }
}

// ============================================
// DeepSeek API Functions
// ============================================

async function translateMessage(text, direction) {
  // direction: 'EN-to-ZH' or 'ZH-to-EN'
  console.log('Translation agent called:', direction, text);
  
  const systemPrompt = buildTranslationPrompt(direction);
  
  try {
    // Call our secure backend proxy instead of DeepSeek directly
    const response = await fetch(BACKEND_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: text }
        ],
        temperature: APP_CONFIG.translationTemperature,
        max_tokens: APP_CONFIG.maxTokens
      })
    });
    
    const data = await response.json();
    
    if (data.choices && data.choices[0]) {
      return data.choices[0].message.content;
    } else {
      throw new Error('Invalid API response');
    }
  } catch (error) {
    console.error('Translation error:', error);
    throw error;
  }
}

async function getBaZhiResponse(chineseInput, birthInfo, conversationHistory) {
  console.log('BaZhi Guru called with:', chineseInput);
  
  const systemPrompt = buildBaZhiPrompt(birthInfo);
  
  // Build messages with conversation history
  const messages = [
    { role: 'system', content: systemPrompt },
    ...conversationHistory,
    { role: 'user', content: chineseInput }
  ];
  
  try {
    // Call our secure backend proxy instead of DeepSeek directly
    const response = await fetch(BACKEND_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        messages: messages,
        temperature: APP_CONFIG.guruTemperature,
        max_tokens: APP_CONFIG.maxTokens
      })
    });
    
    const data = await response.json();
    
    if (data.choices && data.choices[0]) {
      return data.choices[0].message.content;
    } else {
      throw new Error('Invalid API response');
    }
  } catch (error) {
    console.error('BaZhi Guru error:', error);
    throw error;
  }
}

// ============================================
// Prompt Builders
// ============================================
function buildTranslationPrompt(direction) {
  if (direction === 'EN-to-ZH') {
    return `你是一个专业的英中翻译专家，专门翻译八字命理相关内容。

任务：将用户的英文消息准确翻译成简体中文。

重要指南：
- 保持原意和语气
- 使用适当的中文八字术语
- 语言要自然流畅
- 如果涉及八字概念，使用正确的中文术语
- 只返回中文翻译，不要添加其他内容`;
  } else {
    return `You are a professional Chinese-English translator specializing in BaZhi (八字) and Chinese metaphysics.

Task: Translate the Chinese BaZhi expert's response into clear, accurate English.

Important guidelines:
- Maintain meaning and cultural nuances
- Translate key BaZhi terms appropriately (e.g., 八字 = BaZhi, 五行 = Five Elements)
- For important terms, show both: "BaZhi (八字)"
- Make the English natural and easy to understand
- Preserve the expert's tone and advice
- Return ONLY the English translation, nothing else
- Remove the verbose "The above content is generated by DeepSeek xxx xxx" from the final output`;
  }
}

function buildBaZhiPrompt(birthInfo) {
  return `你现在是一个中国传统八字命理的专业研究人员，你熟读穷通宝典、三命通会、滴天髓、渊海子平这些书籍。
  你熟读千里命稿、协纪辨方书、果老星宗、子平真栓、神峰通考等一系列书籍。根据"排大运分阳年、阴年。
  阳年：甲丙戊庚壬。阴年：乙丁己辛癸。阳年男，阴年女为顺排，阴年男，阳年女为逆排。
  具体排法以月干支为基准，进行顺逆。小孩交大运前，以月柱干支为大运十天干：甲乙丙丁戊己庚辛壬癸，十二地支：子丑寅卯辰巳午未申酉戌亥。
  我出生于${birthInfo.year}年${birthInfo.month}月${birthInfo.day}日${birthInfo.hour}时（阳历），
  ${birthInfo.gender === 'Male' ? '男性' : '女性'}，出生地${birthInfo.birthplace}。
  请你以一个专业四柱八字研究者的角色，对我的八字进行分析内容越全面越好`;
}
