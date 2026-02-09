# 八字 Guru - BaZhi Consultation App

A simple, elegant single-page web app for BaZhi (Chinese fortune-telling) consultations powered by GenAI.

## 🎨 Design

Inspired by traditional Chinese ink paintings with cherry blossoms, featuring:
- Warm parchment and cream backgrounds (#f5f0e8, #faf7f2)
- Cherry blossom pink accents (#d67b88, #c1576b)
- Charcoal and ink black text (#1a1a1a, #3a3a3a)
- Misty gray shadows and elements

## 📁 Project Structure

```
bazhi/
├── guru.html              ← Single HTML file (all views in one)
├── styles/
│   └── main.css           ← All styling
├── src/
│   ├── main.js            ← Main controller (DOM & logic)
│   ├── config.js          ← Firebase & GenAI config
│   ├── auth.js            ← Authentication module
│   ├── chat.js            ← Chat logic & API calls
└── README.md              ← This file
```

## 🎯 How It Works

### Three Views (Single Page)

1. **Auth View** (Login/Register)
   - Tab-based interface
   - Email/Password authentication
   - Password reset link

2. **Birth Info View** (First-time setup)
   - Collect birth data:
     - Year, Month, Day, Hour
     - Birth place
     - Gender
   - Saved to Firebase

3. **Chat View** (Main interface)
   - Chat with BaZhi Guru
   - Real-time responses
   - Chat history persisted

### Two-Agent Flow

```
User types in English
    ↓
[Translation Agent] → Chinese
    ↓
[BaZhi Guru Agent] → Chinese response
    ↓
[Translation Agent] → English
    ↓
Display to user + Save to Firebase
```

**Happy Fortune-Telling! 🌸**
