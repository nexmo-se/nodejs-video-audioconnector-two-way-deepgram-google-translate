# **Real-Time Video Multi-User Translation**

Vonage Video Application with real-time speech translation powered by Vonage Video API Audio Connector, Deepgram STT/TTS, and Google Translate. Features individual user language preferences and bidirectional translation.

## Example of Application Demo

### **Real Test Example: French ↔ Spanish Translation**

**Test Setup:**

- User1 (French speaker): Sets language preference to "fr"
- User2 (Spanish speaker): Sets language preference to "es"
- Both users click "Start Deepgram" to activate Audio Connectors

**Actual Test Results:**

#### **User1 speaks French:** "Combien d'argent veux-tu" (How much money do you want?)

**Pipeline Flow:**

```log
🔄 PIPELINE 1: Deepgram STT configured (userLanguage: "fr" → deepgramSTTLanguage: "fr")
📝 Final transcript: "Combien d'argent veux-tu" (confidence: 0.9996745)
🔄 PIPELINE 2: Processing complete sentence from user1
🔄 PIPELINE 3: Translation completed (fr → es): "Cuanto dinero quieres"
🔄 PIPELINE 4-TTS: Voice model selected for TTS (aura-2-celeste-es)
🔄 PIPELINE 4: TTS generated for user (voiceModel: "aura-2-celeste-es", language: "es")
🔊 AUDIO ROUTING: Sending TTS audio to User2 (feedbackPrevention: "✅ ACTIVE")
🔄 PIPELINE 5: Sending 62.5KB audio to video session
✅ PIPELINE 5: TTS audio sent to user (method: "Audio Connector")
✅ Audio transmission completed: 108 chunks sent
```

**Results:**

- ✅ **User2 hears:** Spanish audio "Cuanto dinero quieres"
- ✅ **UI Display:** "You (fr→original) -> 12:52 PM : Combien d'argent veux-tu"

#### **User2 speaks Spanish:** "Dame mucho dinero" (Give me a lot of money)

**Pipeline Flow:**

```log
🔄 PIPELINE 1: Deepgram STT configured (userLanguage: "es" → deepgramSTTLanguage: "es")
📝 Final transcript: "Dame mucho dinero." (confidence: 0.85546875)
🔄 PIPELINE 2: Processing complete sentence from user2
🔄 PIPELINE 3: Translation completed (es → fr): "Donnez-moi beaucoup d'argent."
🔄 PIPELINE 4-TTS: Voice model selected for TTS (aura-2-asteria-en) *French text, English accent
🔄 PIPELINE 4: TTS generated for user (voiceModel: "aura-2-asteria-en", language: "fr")
🔊 AUDIO ROUTING: Sending TTS audio to User1 (feedbackPrevention: "✅ ACTIVE")
🔄 PIPELINE 5: Sending 60.0KB audio to video session
✅ PIPELINE 5: TTS audio sent to user (method: "Audio Connector")
✅ Audio transmission completed: 160 chunks sent
```

**Results:**

- ✅ **User1 hears:** French audio "Donnez-moi beaucoup d'argent" (English accent due to Deepgram TTS limitations)
- ✅ **UI Display:** "Connection dcdb817b... (es→fr) -> 12:52 PM : Donnez-moi beaucoup d'argent."

### **Key Behaviors Demonstrated:**

1. **Language-Aware STT:** Each user gets transcription in their language
2. **Bidirectional Translation:** Both directions work independently (fr↔es)
3. **Voice Limitations:** Spanish gets native voice, French gets English voice (Deepgram limitation)

## Complete Pipeline Flow

1. **Web Client Setup:** User A connects via browser, sets language preference (e.g., French)
2. **Audio Connector Init:** `addUserToSession()` replaces web client WebSocket with Audio Connector WebSocket
3. **Language Preservation:** User A's language preference ("fr") is preserved during WebSocket replacement
4. **STT Processing:** Deepgram receives audio with language-optimized configuration (`fr`)
5. **Translation:** Google Translate uses source language hints for accuracy
6. **TTS Generation:** Deepgram TTS generates audio (Spanish native voice or English fallback)
7. **Audio Delivery:** TTS audio sent to target User B's Audio Connector (NOT back to speaker User A)

---

## **Features**

- **Language-Aware STT**: User-specific Deepgram language configuration for optimal transcription accuracy
- **Smart Translation**: Source language hints and improved Google Translate integration
- **Per-User Audio Connectors**: Individual audio processing for each participant
- **Language Preference Management**: Persistent user language settings with dynamic STT reconfiguration
- **Logging**: Complete pipeline monitoring with language-specific debugging

### **Important: Deepgram TTS Voice Limitations**

**Deepgram TTS Language Support:**

- ✅ **English**: Native `aura-2-asteria-en` voice
- ✅ **Spanish**: Native `aura-2-celeste-es` voice
- ❌ **All Other Languages**: Use English voice speaking translated text

**Real-World Example:**

- French user speaks: "Bonjour" → STT: Perfect French transcription
- Translation: "Bonjour" → "Hello" (accurate)
- German user hears: English voice saying "Hello" in German but not in German accent

This is a **Deepgram limitation**, not a system bug. Text translation is perfect; voice accent is limited.

### **Key Language Improvements:**

- **Dynamic STT Configuration**: Uses user's language preference (e.g., `fr`, `es`, `de`) instead of generic `multi`
- **Source Language Hints**: Translation accuracy improved by using speaker's language as source hint
- **Fallback Strategy**: Gracefully falls back to multi-language detection when users haven't selected a language preference

## **Supported Languages**

### **Enhanced Language Support (25+ Languages)**

**STT (Speech-to-Text) Supported (Nova-2 Model):**

### **Tier 1 - Most Common Languages (12):**

English, Spanish, French, German, Italian, Portuguese, Japanese, Korean, Chinese (Mandarin), Russian, Hindi, Dutch

### **Tier 2 - European Languages (11):**

Danish, Swedish, Norwegian, Polish, Finnish, Czech, Bulgarian, Catalan, Estonian, Ukrainian, Turkish

### **Tier 3 - Additional Supported Languages (1):**

Tamil

**Total: 24 Languages Supported** ✅

**TTS (Text-to-Speech) Available:**

- **English**: Multiple Aura-2 voices (American, British, Australian, Irish, Filipino accents)
- **Spanish**: Multiple Aura-2 voices (Mexican, Peninsular, Colombian, Latin American accents)

**Translation Coverage:**

- **Smart Translation**: Uses speaker's language preference as source hint for improved accuracy
- **Nova-2 STT Languages**: All 24 supported languages get optimized STT processing with language-specific configuration
- **Multi-Language Fallback**: Unknown/unselected languages use multi-language detection with auto-translation

**Documentation Reference:**

- [Deepgram TTS Models & Voices](https://developers.deepgram.com/docs/tts-models)
- [Deepgram STT Language Support](https://developers.deepgram.com/docs/models-languages-overview)

## **Language-Aware STT Configuration**

### **Dynamic Language Selection**

The system configures Deepgram STT based on user language preferences:

**Before (Generic Configuration):**

```javascript
language: "multi"; // One-size-fits-all approach
```

**After (Language-Aware Configuration):**

```javascript
// Maps user preference to optimal Deepgram language code
const deepgramLanguageMap = {
  fr: "fr", // French users get French-optimized STT
  es: "es", // Spanish users get Spanish-optimized STT
  en: "en-US", // English users get US English STT
  // ... 14+ more languages
};

language: userLanguage ? deepgramLanguageMap[userLanguage] : "multi";
```

### **Language Preference Fallback Behavior**

**User Has Selected Language:**

```javascript
// User selected "French" from dropdown
userLanguage = "fr";
deepgramSTTLanguage = "fr"; // Optimized French STT
```

**User Has NOT Selected Language:**

```javascript
// User hasn't clicked "Set Language" yet
userLanguage = null;
deepgramSTTLanguage = "multi"; // Auto-detect any language
```

**When Multi-Language Detection is Used:**

- ✅ **No Language Selected**: User connects Audio Connector without setting language preference
- ✅ **Auto-Detection**: Deepgram automatically detects spoken language (French, Spanish, English, etc.)
- ⚠️ **Lower Accuracy**: Multi-language detection is less accurate than language-specific models
- 🔄 **Reconnection Available**: User can select language later, triggering Audio Connector reconnection with optimized STT

### **Translation Accuracy Improvements**

**Enhanced Google Translate Integration:**

- **Source Language Hints**: Uses speaker's language preference instead of auto-detection
- **Fallback Strategy**: Graceful handling when language detection fails
- **Error Recovery**: Better error messages with language context

**Before:**

```javascript
translate(text, { to: targetLanguage }); // Generic auto-detection
```

**After:**

```javascript
translate(text, {
  from: speakerLanguage, // Explicit source language hint
  to: targetLanguage,
});
```

## **Prerequisites**

- **Node.js** v16+ installed
- **Vonage Video API** account and application
- **Deepgram API** account and API key
- **ngrok** or similar tunneling service (for development)

## **Quick Start**

### **1. Clone and Install**

```bash
git clone <repository-url>
cd nodejs-video-audioconnector-two-way-deepgram-google-translate
npm install
```

### **Project Structure**

```text
├── video-chat-server.js   # Main application server
├── update-env.js          # Development setup with ngrok
├── package.json           # Dependencies (cleaned & optimized)
├── views/
│   ├── index.ejs         # Main video chat interface
│   ├── js/client.js      # Client-side video handling
│   └── css/style.css     # Application styling
├── private.key           # Vonage private key (not in repo)
├── .env                  # Environment variables (not in repo)
└── README.md            # This file
```

### **2. Environment Configuration**

Copy the sample environment file and configure:

```bash
cp .env.samp .env
```

Edit `.env` by updating `APP_ID` and `DEEPGRAM_API_KEY` with your credentials:

```env
APP_ID=your_vonage_application_id
DEEPGRAM_API_KEY=your_deepgram_api_key
```

### **3. Private Key Setup**

```bash
cp private.key.samp private.key
# Add your Vonage private key content to private.key
```

### **4. Development Setup with ngrok (recommended)**

For easy development with tunneling:

```bash
# Start development server with auto-tunneling
node update-env.js
```

The script `update-env.js` runs:

1. Starts ngrok server on port 3002
2. Updates `.env` WEBSOCKET_SERVER_URI with NGROK_URL
3. Then starts the server `video-chat-server.js`

## **Run a Demo**

### Translation requires 2+ users with different language preferences

1. Navigate to your public ngrok url: http://NGROK_URL (or `http://localhost:3002`).
2. A new video session will be created automatically
3. Copy the join link to invite 2nd participant to use it on different device.
4. **Set Language Preferences**: Each user selects their preferred language (English/Spanish/etc.)
5. **Each User must click "Start Deepgram"**: Begins individual Audio Connector for that user
6. **Speak Naturally**: System automatically:
   - **STT**: Transcribes speech using user's specific language (e.g., French → `fr`)
   - **Translation**: Translates using Google Translate with source language hints
   - **TTS**: Generates audio using available voice (English/Spanish only)
   - **Audio Delivery**: Plays translated speech via Audio Connectors
   - **UI Display**: Shows real-time transcriptions with speaker identification

### **Multi-User Session Management**

- Each user gets individual Audio Connector connection (no speaker diarization conflicts)
- Language preferences persist across reconnections
- Session tracking uses Vonage connectionId for reliable user identification
- Automatic cleanup when users disconnect

## **Complete Frontend/Backend Flow Documentation**

### **Overview: Complete User Journey**

This section details every frontend request, backend processing, and data management for the complete translation pipeline. Perfect reference for implementation in any frontend framework.

---

### **PHASE 1: Session Initialization**

#### **1.1 Create New Session**

**Frontend Request:**

```http
GET /
```

**Backend Route:** `app.get("/", function (req, res))`

- **Processing:** Calls `new_session(res, req)`
- **Vonage API Call:** `videoClient.createSession({ mediaMode: "routed" })`
- **Variables Updated:**
  - Global `sessionId` = `session.sessionId`
  - `token` = `videoClient.generateClientToken(sessionId)`
- **Response:** Renders `index.ejs` with session data
- **Payload Returned:**

```javascript
{
  sessionId: "1_MX40NzIwM...",
  token: "T1==cGFydG5lcl9pZD...",
  appId: "your_app_id",
  websocket_server_uri: "wss://your-domain.ngrok.app"
}
```

#### **1.2 Join Existing Session**

**Frontend Request:**

```http
GET /:sessionId/join
```

**Backend Route:** `app.get("/:sessionId/join", function (req, res))`

- **Processing:** Extracts `sessionId` from URL params
- **Variables Updated:**
  - Global `sessionId` = `req.params["sessionId"]`
  - `token` = `videoClient.generateClientToken(sessionId)`
- **Response:** Same as 1.1

---

### **PHASE 2: Video Session & WebSocket Setup**

#### **2.1 Video Session Connection (Frontend)**

**Frontend Processing:** `startSession(sessionId, token, appId)`

- **Vonage SDK Calls:**
  - `OT.initPublisher()` - Creates local video/audio stream
  - `OT.initSession()` - Initializes session
  - `session.connect(token)` - Connects to session
- **Variables Updated:**
  - `window.currentSession` = session object
  - `window.currentPublisher` = publisher object
  - `userId` = `session.connection.connectionId` (Vonage auto-generated)
- **UI Updates:** Connection ID displayed to user

#### **2.2 WebSocket Connection (Frontend)**

**Frontend Action:** `initializeWebSocket()` called after video session establishes

**WebSocket Message Sent:**

```javascript
{
  command: "webSocketID",
  id: "client_" + sessionId,
  userId: userId,        // Vonage connectionId
  sessionId: sessionId
}
```

**Backend WebSocket Handler:** `websocket.on("message")`

- **Processing:** Identifies this as web client (not Audio Connector)
- **Session Tracking:** Calls `addUserToSession(sessionId, userId, websocket.id, websocket)`
- **Data Structures Updated:**

```javascript
sessionUsers = Map {
  sessionId => Map {
    userId => {
      connectionId: websocket.id,
      language: null,      // Will be set later
      websocket: websocketInstance,
      isActive: true
    }
  }
}
```

---

### **PHASE 3: Language Preference Setting**

#### **3.1 Set Language Preference**

**Frontend Request:** User clicks "Set Language" button

**WebSocket Message Sent:**

```javascript
{
  command: "set_preferred_language",
  sessionid: sessionId,
  userid: userId,        // Vonage connectionId
  language: "fr"         // Selected language code
}
```

**Backend WebSocket Handler:** `data.toString().includes("set_preferred_language")`

- **Processing:** Calls `setUserLanguage(sessionId, userId, language)`
- **Data Structure Updated:**

```javascript
sessionUsers.get(sessionId).get(userId).language = "fr";
```

- **Broadcast Logic:** Notifies other users in session
- **Message Sent to Other Users:**

```javascript
{
  type: "user_language_changed",
  userId: userId,
  language: "fr",
  timestamp: "2025-09-04T18:30:19.322Z"
}
```

- **Audio Connector Check:** If user has active Audio Connector, sends reconnection request
- **Reconnection Message:**

```javascript
{
  type: "language_updated_reconnect_required",
  newLanguage: "fr",
  reason: "Deepgram STT configuration needs to be updated with new language preference",
  timestamp: "2025-09-04T18:30:19.322Z"
}
```

---

### **PHASE 4: Start Translation Pipeline**

#### **4.1 Start Deepgram Request**

**Frontend Request:**

```http
GET /:sessionId/audioconnect/:userId
```

- **URL Example:** `/1_MX40NzIwM.../audioconnect/abc123-def456-789`
- **Variables:**
  - `sessionId` from session
  - `userId` = Vonage `connectionId`

**Backend Route:** `app.get("/:sessionId/audioconnect/:userId")`

- **Processing Steps:**
  1. **Extract Parameters:**
     ```javascript
     sessionId = req.params["sessionId"];
     userId = req.params["userId"];
     ```
  2. **Check Existing Connections:** Prevents duplicate Audio Connectors
  3. **Generate Token:** `token = videoClient.generateClientToken(sessionId)`
  4. **Vonage API Call:**
     ```javascript
     videoClient.connectToWebsocket(sessionId, token, {
       uri: `${websocket_server_uri}?userId=${userId}`,
       headers: { sessionid: sessionId, userid: userId },
       audioRate: 16000,
       bidirectional: true,
     });
     ```

**Backend Response:**

```javascript
{
  success: true,
  message: "Per-user Audio Connector connected",
  userId: "abc123-def456-789",
  connectionId: "connection_id_from_vonage",
  bidirectional: true
}
```

#### **4.2 Audio Connector WebSocket Connection**

**Automatic Vonage Message:** Audio Connector sends initial setup message

**Message Received:**

```javascript
{
  "content-type": "audio/l16;rate=16000",
  "event": "websocket:connected"
}
```

**Backend Processing:**

1. **Extract Headers:**
   ```javascript
   sessionId = JSON.parse(data)["sessionid"];
   userId = JSON.parse(data)["userid"];
   ```
2. **Session Tracking:** Calls `addUserToSession(sessionId, userId, websocket.id, websocket)`
3. **Language-Aware STT Configuration:**

   ```javascript
   // Get user's language preference
   const userInfo = sessionUsers.get(sessionId)?.get(userId);
   const userLanguage = userInfo?.language; // e.g., "fr"

   // Map to Deepgram language code
   const deepgramLanguage = userLanguage
     ? deepgramLanguageMap[userLanguage]
     : "multi";

   // Configure Deepgram
   dgConnection = deepgram.listen.live({
     language: deepgramLanguage, // "fr" instead of "multi"
     model: "nova-2",
     encoding: "linear16",
     sample_rate: 16000,
     channels: 1,
     interim_results: false,
     punctuate: true,
     smart_format: true,
   });
   ```

4. **Data Structures Updated:**
   ```javascript
   websocket.dgConnection = dgConnection;
   websocket.sessionId = sessionId;
   websocket.userId = userId;
   websocket.isAudioConnector = true;
   ```

---

### **PHASE 5: Real-Time Speech Processing**

#### **5.1 Audio Data Processing**

**Automatic Audio Stream:** Vonage sends binary audio data (640-byte chunks, 50fps)

**Backend Processing:**

1. **Audio Forwarding:** `dgConnection.send(data)` - Send to Deepgram STT
2. **Transcript Reception:** Deepgram returns final transcripts
3. **Logging Enhanced:**
   ```javascript
   log.info("📝 Final transcript", {
     transcript: "Bonjour, comment allez-vous?",
     confidence: 0.95,
     userId: "abc123-def456-789",
     userLanguage: "fr",
     deepgramLanguage: "fr", // Shows language-specific STT working
   });
   ```

#### **5.2 Translation Pipeline**

**Backend Processing:** When final transcript received

1. **Send Original to Speaker:**

   ```javascript
   speakerTranscriptionUpdate = {
     type: "transcription",
     speakerUserId: "abc123-def456-789",
     timestamp: "12:30 PM",
     originalText: "Bonjour, comment allez-vous?",
     translatedText: "Bonjour, comment allez-vous?",
     sourceLanguage: "fr", // User's language preference
     targetLanguage: "original",
   };
   ```

2. **Find Other Users:** `getOtherUsersInSession(sessionId, speakerUserId)`

   - **Returns:** Array of users with different language preferences
   - **Session Query:**
     ```javascript
     otherUsers = [
       {
         userId: "xyz789-abc123-456",
         language: "es",
         websocket: websocketInstance,
       },
     ];
     ```

3. **Smart Translation:** For each target user

   ```javascript
   // Enhanced translation with source language hint
   translateOptions = {
     to: "es", // Target user's language
     from: "fr", // Speaker's language (not auto-detect)
   };

   translationResult = await translate(
     "Bonjour, comment allez-vous?",
     translateOptions
   );
   // Result: "Hola, ¿cómo estás?"
   ```

4. **TTS Generation:**

   ```javascript
   // Voice selection based on target language
   voiceModel =
     user.language === "es" ? "aura-2-celeste-es" : "aura-2-asteria-en";

   ttsResult = await deepgram.speak(translationResult.text, {
     model: voiceModel,
   });
   ```

5. **Audio Playback:** `playback_to_websocket(targetUserWebSocket, ttsResult.stream)`

#### **5.3 Frontend Message Reception**

**WebSocket Message Received:**

```javascript
{
  type: "transcription",
  speakerUserId: "abc123-def456-789",
  timestamp: "12:30 PM",
  originalText: "Bonjour, comment allez-vous?",
  translatedText: "Hola, ¿cómo estás?",
  sourceLanguage: "fr",
  targetLanguage: "es"
}
```

**Frontend Processing:** `handleWebSocketMessage(evt)`

- **UI Updates:** Add to transcription log
- **Display Format:** "Connection abc123... (fr→es) -> 12:30 PM : Hola, ¿cómo estás?"

---

### **PHASE 6: Stop Translation Pipeline**

#### **6.1 Stop Deepgram Request**

**Frontend Action:** User clicks "Stop Deepgram" button

**WebSocket Message Sent:**

```javascript
{
  command: "close_audio_connector",
  sessionid: sessionId,
  userid: userId          // Vonage connectionId
}
```

**Backend WebSocket Handler:** `data.toString().includes("close_audio_connector")`

- **Processing:** Identifies user's Audio Connector connections
- **Resource Cleanup:**
  1. **Close Deepgram Connection:** `dgConnection.finish()`
  2. **Close WebSocket:** `websocket.close()`
  3. **Session Cleanup:** Remove from `sessionUsers` Map
  4. **Vonage Cleanup:** Audio Connector automatically disconnects

**Data Structures Updated:**

```javascript
// Remove user from session tracking
sessionUsers.get(sessionId).delete(userId);

// If no users remain, remove entire session
if (sessionUsers.get(sessionId).size === 0) {
  sessionUsers.delete(sessionId);
}
```

#### **6.2 Frontend State Update**

**Frontend Processing:**

- **UI Updates:** Button text changes to "Start Deepgram"
- **Variables Updated:** `deepgram_in_use = false`
- **Background:** Audio Connector connection terminates automatically

---

### **PHASE 7: Session Cleanup**

#### **7.1 Page Unload Cleanup**

**Frontend Event:** `window.addEventListener("beforeunload")`

**WebSocket Message Sent:**

```javascript
{
  command: "close_audio_connector",
  sessionid: sessionId,
  userid: userId
}
```

**Backend Processing:** Same as Phase 6.1 cleanup

---

### **Data Flow Summary**

**Key Data Structures Maintained:**

1. **sessionUsers Map:**

   ```javascript
   Map {
     "sessionId1" => Map {
       "userId1" => {
         connectionId: "ws_abc123",
         language: "fr",
         websocket: websocketInstance,
         isActive: true
       },
       "userId2" => { ... }
     }
   }
   ```

2. **WebSocket Properties:**

   ```javascript
   websocket = {
     id: "ws_abc123",
     userId: "abc123-def456-789",
     sessionId: "1_MX40NzIwM...",
     userLanguage: "fr",
     isAudioConnector: true,
     dgConnection: deepgramConnectionInstance,
   };
   ```

3. **Frontend State:**
   ```javascript
   {
     userId: "abc123-def456-789",     // Vonage connectionId
     session: sessionObject,
     publisher: publisherObject,
     ws: websocketConnection,
     deepgram_in_use: boolean
   }
   ```

## **Audio Connector Architecture & Subscription Logic**

### **Core Concept: "Translation Mailbox" Architecture**

Each user has **their own dedicated Audio Connector** that acts as a "translation inbox" - it receives TTS audio when OTHER users speak. Users ONLY subscribe to their own Audio Connector to receive translations from others.

### **The Mailbox Analogy**

```text
Think of Audio Connectors like personal mailboxes:

UserA (French)    UserB (Spanish)
     │                 │
┌────▼────┐       ┌────▼────┐
│ Mailbox │       │ Mailbox │
│    A    │       │    B    │
└─────────┘       └─────────┘
     ▲                 ▲
     │                 │
UserA only checks    UserB only checks
Mailbox A for        Mailbox B for
translations         translations
```

**Audio Flow:**

- UserA speaks French → Server translates to Spanish → Server delivers to UserB's mailbox → UserB hears Spanish
- UserB speaks Spanish → Server translates to French → Server delivers to UserA's mailbox → UserA hears French

### **Real Client-Side Subscription Logic**

**File:** `views/js/client.js` - The critical decision-making code:

```javascript
session.on("streamCreated", function (event) {
  const stream = event.stream;

  // Parse Audio Connector ownership from stream token
  const streamMeta = JSON.parse(stream.connection.data);
  const audioConnectorOwner = streamMeta.userId;
  const currentUserId = session.connection.connectionId;

  // CRITICAL ARCHITECTURE DECISION:
  const isOwnAudioConnector = audioConnectorOwner === currentUserId;

  if (isAudioConnector) {
    if (!isOwnAudioConnector) {
      // Skip OTHER users' Audio Connectors
      console.log(
        "🏗️ AUDIO ARCHITECTURE: Skipping OTHER user's Audio Connector - we only subscribe to our own",
        {
          ourUserId: currentUserId,
          streamOwner: audioConnectorOwner,
          reason:
            "Each user only subscribes to their own Audio Connector to receive translations",
        }
      );
      return; // EXIT - Do not subscribe
    }

    // Subscribe to OWN Audio Connector
    console.log(
      "✅ SUBSCRIBING TO OWN AUDIO CONNECTOR: Receive translations from other users",
      {
        purpose:
          "Our Audio Connector receives TTS audio when other users speak in different languages",
      }
    );

    // Create hidden container for audio-only subscription
    const hiddenContainer = document.createElement("div");
    session.subscribe(stream, hiddenContainer, {
      subscribeToVideo: false,
      subscribeToAudio: true,
    });
  }
});
```

### **Subscription Summary**

**Translation Delivery:**

- UserA speaks French → Server sends Spanish TTS to **UserB's Audio Connector** → UserB hears it
- UserB speaks Spanish → Server sends French TTS to **UserA's Audio Connector** → UserA hears it

### **🔧 Server-Side Routing Logic**

**File:** `video-chat-server.js` - How server delivers TTS to the correct mailbox:

```javascript
// TTS delivery logic - route to target user's Audio Connector
async function sendTTSToUser(speakerUserId, targetUserId, ttsAudio) {
  const targetUser = sessionUsers.get(sessionId).get(targetUserId);

  // Critical: Send to target user's Audio Connector, NOT speaker's
  if (
    targetUser.websocket.readyState === WebSocket.OPEN &&
    targetUserId !== speakerUserId
  ) {
    console.log("🔊 AUDIO ROUTING: Sending TTS audio to target user", {
      speakerUserId: speakerUserId,
      targetUserId: targetUserId,
      routingRule: "speakerUserId !== targetUserId",
      feedbackPrevention: "✅ ACTIVE",
    });

    await playback_to_websocket(targetUser.websocket, ttsAudio);
  }
}
```

## **Audio Connector API Limitations**

### **Name Parameter Not Supported**

During development, we investigated whether custom `name` parameters could be set when creating Audio Connector streams to improve identification reliability. During the time of writing this, the documentation confirms that the `name` parameter is NOT supported for Audio Connector WebSocket connections.

**Available Audio Connector Parameters:**

```javascript
videoClient.connectToWebsocket(sessionId, token, {
  uri: websocketURI,
  headers: customHeaders,
  audioRate: 16000,
  bidirectional: true
});

// ❌ NOT SUPPORTED: Custom stream properties
{
  name: "audio_connector_user1",     // ❌ INVALID - name does not exist

}
```

**Documentation Reference:**  
[Official Audio Connector Guide](https://tokbox.com/developer/guides/audio-connector) - No `name` parameter mentioned in any connectToWebsocket examples.

#### **Reliable Detection Alternative**

Since custom naming isn't supported, the system uses **defensive dual-method detection**:

```javascript
// Method 1: Token-based detection (Primary - Reliable)
const streamMeta = JSON.parse(stream.connection.data);
const isAudioConnectorByToken = streamMeta.type === "audio_connector";

// Method 2: Property-based detection (Fallback - Defensive)
const isAudioConnectorByProps =
  stream.hasAudio === true &&
  stream.hasVideo === false &&
  (!stream.name || stream.name.trim() === "") &&
  stream.videoType === undefined;

// Use token data when available, fallback to properties
const isAudioConnector = tokenDataAvailable
  ? isAudioConnectorByToken
  : isAudioConnectorByProps;
```

**Why This Approach Works:**

- **Token metadata** provides reliable identification via `stream.connection.data`
- **Property detection** handles edge cases when token data isn't available
- **Empty name** is `undefined` for server-created Audio Connector streams
- **Regular video streams** have `name: "Publisher"` from client-side publisher options

This defensive approach ensures robust Audio Connector detection without relying on unsupported API features.

### **ConnectionId as User Identity**

The system uses **Vonage connectionId** as the primary user identifier throughout the entire pipeline:

#### **1. Web Client Connection & ConnectionId Generation**

**File:** `views/js/client.js`

```javascript
// User opens browser and connects to video session
session = OT.initSession(apiKey, sessionId);
session.connect(token, async function (err) {
  if (!err) {
    // Store connectionId globally for Audio Connector creation
    window.currentSession = session;
    console.log("Connection ID:", session.connection.connectionId);

    // This connectionId becomes the user's unique identifier
    const userId = session.connection.connectionId;
  }
});
```

**Result:** User has unique `connectionId` (e.g., `"2_MX4xMDB..."`)

#### **2. Audio Connector Creation with ConnectionId**

**File:** `views/index.ejs` (lines 325-335)

```javascript
// When user clicks "Start Deepgram", use connectionId as userId
const userId = window.currentSession?.connection?.connectionId;

// Call per-user Audio Connector endpoint with connectionId
$.ajax({
  method: "GET",
  url: "/<%=sessionId%>/audioconnect/" + userId, // connectionId becomes userId
});
```

**File:** `video-chat-server.js`

```javascript
// Per-user Audio Connector endpoint
app.get("/:sessionId/audioconnect/:userId", async function (req, res) {
  const sessionId = req.params["sessionId"];
  const userId = req.params["userId"]; // This is the connectionId from frontend

  // Generate token with userId embedded in connection data
  const tokenData = {
    userId: userId, // connectionId for stream identification
    type: "audio_connector",
    role: "translator",
    timestamp: Date.now(),
  };

  token = videoClient.generateClientToken(sessionId, {
    data: JSON.stringify(tokenData), // Embed userId in token
  });

  // Create Audio Connector with userId in WebSocket URI
  const result = await videoClient.connectToWebsocket(sessionId, token, {
    uri: `${websocket_server_uri}?userId=${userId}`, // Pass connectionId
    headers: { sessionid: sessionId, userid: userId },
    bidirectional: true,
  });
});
```

**Result:** Audio Connector created with connectionId embedded in token and URI

#### **3. WebSocket Connection & User Tracking**

**File:** `video-chat-server.js`

```javascript
// WebSocket connection handler
wsServer.on("connection", (websocket, request) => {
  // Extract userId (connectionId) from WebSocket URL
  const url = new URL(request.url, `http://${request.headers.host}`);
  const userIdFromUrl = url.searchParams.get("userId");

  // Store connectionId as user identifier
  websocket.userId = userIdFromUrl; // connectionId from frontend
  websocket.isAudioConnector = !!userIdFromUrl;

  // Track user in session
  addUserToSession(sessionId, userId, websocket.id, websocket);
});
```

**Result:** Server tracks users by connectionId in `sessionUsers` Map

#### **4. Stream Creation & ConnectionId Embedding**

When Audio Connector connects to video session, it creates a stream with the embedded token data:

```javascript
// Audio Connector stream includes connectionId in stream.connection.data
stream.connection.data;

// Audio Connector stream includes connectionId in stream.connection.data
stream.connection.data = JSON.stringify({
  userId: "2_MX4xMDB...", // Original connectionId
  type: "audio_connector",
  role: "translator",
});
```

#### **5. Client-Side Stream Subscription Logic**

**File:** `views/js/client.js` (lines 90-200)

```javascript
session.on("streamCreated", function (event) {
  const stream = event.stream;

  // Extract userId (connectionId) from stream token data
  let streamMeta = {};
  if (stream.connection.data) {
    streamMeta = JSON.parse(stream.connection.data);
    // streamMeta.userId contains the original connectionId
  }

  // Determine if this is an Audio Connector stream
  const isAudioConnector = streamMeta.type === "audio_connector";
  const audioConnectorOwner = streamMeta.userId; // connectionId of Audio Connector owner
  const currentUserId = session.connection.connectionId; // Current user's connectionId

  // CRITICAL SUBSCRIPTION LOGIC: Only subscribe if ownership is different
  const isOwnAudioConnector = audioConnectorOwner === currentUserId;

  if (isAudioConnector) {
    if (isOwnAudioConnector) {
      console.log(
        "✅ Subscribing to OWN Audio Connector for translated audio playback"
      );
      // Subscribe to receive translations FROM other users
    } else {
      console.log("✅ Subscribing to OTHER user's Audio Connector");
      // Subscribe to receive translations TO other users
    }

    // Create hidden container and subscribe for audio-only
    const hiddenContainer = document.createElement("div");
    session.subscribe(stream, hiddenContainer, {
      subscribeToVideo: false,
      subscribeToAudio: true,
    });
  }
});
```

### **ConnectionId Security & Isolation**

#### **Per-User Audio Connector Creation Security**

```javascript
// Only authorized users can create Audio Connectors
const userInfo = sessionUsers.get(sessionId)?.get(userId);
if (!userInfo) {
  websocket.close(1008, "Unauthorized userId for this session");
}
```

#### **Stream Ownership Verification**

```javascript
// Client verifies Audio Connector ownership before subscription
const doubleCheck = audioConnectorOwner === currentUserId;
if (!doubleCheck) {
  console.log("❌ OWNERSHIP MISMATCH: Skipping subscription");
  return;
}
```

### **ConnectionId State Management**

#### **Session User Tracking**

```javascript
// Global session state (video-chat-server.js)
const sessionUsers = new Map(); // sessionId -> Map(userId -> userInfo)

function addUserToSession(sessionId, userId, websocketId, websocketInstance) {
  if (!sessionUsers.has(sessionId)) {
    sessionUsers.set(sessionId, new Map());
  }

  sessionUsers.get(sessionId).set(userId, {
    userId: userId, // connectionId
    websocketId: websocketId,
    websocket: websocketInstance,
    language: null, // Set when user selects language
    isActive: true,
  });
}
```

#### **Language Preference Association**

```javascript
// Language preferences tied to connectionId
function setUserLanguage(sessionId, userId, language) {
  const sessionMap = sessionUsers.get(sessionId);
  if (sessionMap && sessionMap.has(userId)) {
    sessionMap.get(userId).language = language; // Associate language with connectionId
    return true;
  }
  return false;
}
```

### **Key Benefits of ConnectionId Architecture**

1. **Unique User Identity**: Each user identified by Vonage connectionId across all components
2. **Stream Ownership**: Audio Connector streams traced back to original user via connectionId
3. **Feedback Prevention**: TTS not sent back to speaker's connectionId
4. **Session Isolation**: Users can only create Audio Connectors for their own connectionId
5. **Language Tracking**: User language preferences associated with connectionId
6. **Subscription Logic**: Client can distinguish own vs. other users' Audio Connectors

### **ConnectionId Debugging Guide**

```javascript
// Frontend debugging (views/js/client.js)
console.log("Current user connectionId:", session.connection.connectionId);
console.log(
  "Stream owner connectionId:",
  JSON.parse(stream.connection.data).userId
);
console.log("Is own Audio Connector?", streamOwner === currentUser);

// Backend debugging (video-chat-server.js)
console.log("WebSocket userId (connectionId):", websocket.userId);
console.log("Session users:", Array.from(sessionUsers.get(sessionId).keys()));
console.log(
  "TTS target userId:",
  user.userId,
  "Speaker userId:",
  speakerUserId
);
```

This connectionId architecture ensures secure, isolated per-user translation processing while preventing audio feedback loops.

### **System Requirements & Testing**

### **Important: Same-Device Testing Limitation**

**For Development Testing**: Using multiple browser tabs on the same device will create audio feedback loops because:

- Both tabs share the same microphone and speakers
- TTS audio from one tab gets picked up by the other tab's microphone
- Creates endless re-translation of the same audio

**Solutions**:

1. **Recommended**: Test with separate physical devices (phone + computer)
2. **Alternative**: Use headphones and manually mute when not speaking
3. **Development**: Accept feedback loops as testing artifact (system works correctly in production)

#### **Multi-User Testing Results (Full Translation Pipeline)**

**Test Setup**: User1 (French) + User2 (Spanish) on separate devices

**Actual Enhanced Debug Logs:**

```log
[2025-09-10T18:52:30.608Z] ℹ️  🔍 SESSION DEBUG: Multi-user translation analysis {
  "sessionId": "1_MX5...",
  "speakerUserId": "26f1b0fe-a3b9-45d3-916f-f9eed6da8f73",
  "totalOtherUsers": 1,
  "sessionUsersMapSize": 2,
  "allUsersInSession": [
    {
      "userId": "26f1b0fe-a3b9-45d3-916f-f9eed6da8f73",
      "language": "fr",
      "isActive": true,
      "connectionType": "Audio Connector"
    },
    {
      "userId": "dcdb817b-1f09-4d9f-b834-9ae04dd7b1f3",
      "language": "es",
      "isActive": true,
      "connectionType": "Audio Connector"
    }
  ]
}

[2025-09-10T18:52:31.190Z] ℹ️  🔍 AUDIO ROUTING DEBUG: Analyzing TTS routing decision {
  "speakerUserId": "26f1b0fe-a3b9-45d3-916f-f9eed6da8f73",
  "targetUserId": "dcdb817b-1f09-4d9f-b834-9ae04dd7b1f3",
  "isTargetSameAsSpeaker": false,
  "websocketReadyState": 1,
  "isWebSocketOpen": true,
  "isAudioConnector": true,
  "willSendAudio": true,
  "voiceModel": "aura-2-celeste-es",
  "textToSpeak": "Cuanto dinero quieres..."
}

[2025-09-10T18:52:32.220Z] ℹ️  🔊 AUDIO TRANSMISSION DEBUG: Final transmission summary {
  "websocketId": "54a739fa-341b",
  "userId": "dcdb817b-1f09-4d9f-b834-9ae04dd7b1f3",
  "chunksSent": 108,
  "expectedChunks": 108,
  "transmissionComplete": true,
  "audioSizeKB": 67,
  "finalWebSocketState": 1
}
```

**Enhanced Feedback Prevention Verification:**

```log
[2025-09-10T18:52:45.055Z] ℹ️  🔍 AUDIO ROUTING DEBUG: Analyzing TTS routing decision {
  "speakerUserId": "dcdb817b-1f09-4d9f-b834-9ae04dd7b1f3",
  "targetUserId": "26f1b0fe-a3b9-45d3-916f-f9eed6da8f73",
  "isTargetSameAsSpeaker": false,      // ← Key: Different users
  "willSendAudio": true,               // ← Audio will be sent
  "feedbackPrevention": "✅ ACTIVE"    // ← System working correctly
}

// If user tried to send to themselves (hypothetical):
[2025-09-10T18:52:XX.XXX] ⚠️  � AUDIO ROUTING: Blocking TTS to speaker (feedback prevention) {
  "speakerUserId": "dcdb817b-1f09-4d9f-b834-9ae04dd7b1f3",
  "targetUserId": "dcdb817b-1f09-4d9f-b834-9ae04dd7b1f3",
  "reason": "SAME_USER_ID",
  "feedbackPrevention": "✅ WORKING",
  "textBlocked": "Dame mucho dinero..."
}
```

#### **Audio Cross-Talk Detection (Expected in Same-Device Testing)**

**What You Might Observe**: When User2's microphone picks up the French translation audio from User1's speakers:

**Actual Log Evidence:**

```log
// User2 speaks Spanish clearly:
[2025-09-10T18:52:41.394Z] ℹ️  📝 Final transcript {
  "transcript": "Dame mucho dinero.",
  "confidence": 0.85546875,
  "userId": "dcdb817b-1f09-4d9f-b834-9ae04dd7b1f3",
  "userLanguage": "es",
  "deepgramSTTLanguage": "es"
}

// French TTS audio plays to User1...

// User2's microphone picks up the French audio, but STT is configured for Spanish:
[2025-09-10T18:52:48.250Z] ℹ️  📝 Final transcript {
  "transcript": "Donis Mois.",           // ← Garbled French through Spanish STT
  "confidence": 0.48120117,             // ← Low confidence (cross-talk detection)
  "userId": "dcdb817b-1f09-4d9f-b834-9ae04dd7b1f3",
  "userLanguage": "es",
  "deepgramSTTLanguage": "es"
}

[2025-09-10T18:52:49.288Z] ℹ️  📝 Final transcript {
  "transcript": "Bokú,",                // ← More garbled audio
  "confidence": 0.5617676,             // ← Low confidence indicates cross-talk
}
```

**What This Shows:**

- ✅ **System Working Correctly**: Audio routing is perfect (no feedback loops)
- ⚠️ **Physical Audio Bleed**: Microphone picking up speaker audio (hardware issue)
- 🔍 **Cross-Talk Detection**: Low confidence scores indicate garbled audio
- 💡 **Solution**: Use headphones or separate devices to eliminate cross-talk

## **Logging & Monitoring**

The application provides **dual-layer comprehensive logging** with both server-side and client-side capture:

### **Server-Side and Client-Side Logging**

Server logs are written to `server-logs-YYYY-MM-DD.log` and Client logs are written to `client-logs-2025-09-10.log`.

- **Server Side**: Pipeline processing, Audio Connector states, translation flow
- **Client Side**: UI interactions, WebSocket messages, Audio Connector subscriptions, stream management
- **Cross-Reference**: Match server and client events using timestamps and connectionIds

## **Development**

## **Audio Connector UI Management**

### **Important: Audio Connector Subscription Behavior**

When using bidirectional Audio Connector to publish translated speech back to the video session, **you must subscribe to the Audio Connector stream** to allow users to hear the translated audio. However, the Vonage Video SDK automatically wants to render an audio-only placeholder/subscriber tile in the UI.

### **The Problem**

- Audio Connector creates a bidirectional stream for TTS audio injection
- The SDK treats this as a regular stream and tries to render a subscriber UI element
- Users see an unwanted "blank" or audio-only placeholder tile
- **You cannot avoid subscription** - it's required for audio playback

### **The Solution: CSS-Based Hiding (Implemented)**

The application uses CSS positioning to hide the Audio Connector placeholder from the UI. Here's the implemented approach:

#### **CSS Class Implementation**

**Added to `views/css/style.css`:**

```css
/* Audio Connector Hidden Container */
.audio-connector-hidden {
  position: absolute !important;
  left: -10000px !important;
  top: -10000px !important;
  width: 1px !important;
  height: 1px !important;
  overflow: hidden !important;
  opacity: 0 !important;
  visibility: hidden !important;
  pointer-events: none !important;
}
```

#### **Detection Logic in Client:**

```javascript
session.on("streamCreated", function (event) {
  const stream = event.stream;

  // Audio Connector detection based on stream properties
  const isAudioConnector =
    stream.hasAudio === true &&
    stream.hasVideo === false &&
    (!stream.name || stream.name.trim() === "");

  if (isAudioConnector) {
    // Create hidden container for Audio Connector
    const hiddenContainer = document.createElement("div");
    hiddenContainer.className = "audio-connector-hidden";
    document.body.appendChild(hiddenContainer);

    // Subscribe for audio playback but keep completely hidden
    const subscriber = session.subscribe(stream, hiddenContainer, {
      subscribeToVideo: false,
      subscribeToAudio: true,
      insertMode: "replace",
      width: 1,
      height: 1,
    });

    return; // Skip normal subscription logic
  }

  // Handle regular participant streams normally
  session.subscribe(stream, "subscriber", normalSubscribeOptions);
});
```

### **Audio Connector Detection Logic**

Audio Connector streams are reliably identified by these properties:

- `hasAudio: true` (contains audio for TTS playback)
- `hasVideo: false` (no video component)
- `!stream.name || stream.name.trim() === ""` (empty or undefined name)

### **Why This Approach Works**

1. **Required Subscription**: You must subscribe to hear the translated audio
2. **Hidden Container**: Off-screen positioning keeps it invisible to users

## **Long Sentence Detection & Utterance Optimization**

### **Enhanced Deepgram Configuration for Long Sentences**

The application has been optimized to handle long sentences and prevent premature splitting that can cause incorrect speaker diarization. Here are the key optimizations:

#### **Problem Solved:**

- **Issue**: Long sentences being split into multiple transcripts with different speaker IDs
- **Example**: "_I'm very happy about_" (Speaker 0) + "_that you attended today's meeting_" (Speaker 1)
- **Root Cause**: Aggressive utterance detection during natural speech pauses

#### **Deepgram Parameters Optimized:**

```javascript
dgConnection = deepgram.listen.live({
  // === UTTERANCE DETECTION (KEY FOR LONG SENTENCES) ===
  utterance_end_ms: 2000, // Wait 2 seconds before ending utterance
  vad_turnoff: 1000, // Voice Activity Detection - 1 second timeout

  // === PROCESSING OPTIMIZATION ===
  model: "nova-2", // More stable for real-time (vs nova-3)
  smart_format: true, // Better sentence structure detection
  interim_results: false, // Only final results for accuracy

  // === PERFORMANCE TUNING ===
  endpointing: 500, // Faster initial response
  no_delay: false, // Allow slight delay for accuracy
});
```

#### **Key Parameters Explained:**

| Parameter          | Value    | Purpose                                             | Impact                                    |
| ------------------ | -------- | --------------------------------------------------- | ----------------------------------------- |
| `utterance_end_ms` | 2000ms   | Wait 2 seconds of silence before ending utterance   | **Prevents premature sentence splitting** |
| `vad_turnoff`      | 1000ms   | Voice Activity Detection timeout for natural pauses | **Allows breathing/thinking pauses**      |
| `smart_format`     | true     | Enhanced sentence structure detection               | **Better punctuation and formatting**     |
| `model`            | "nova-2" | More stable real-time model                         | **Reduces oversensitive detection**       |

#### **Enhanced Event Monitoring:**

The application now includes comprehensive utterance detection monitoring:

```javascript
// Utterance lifecycle events
dgConnection.on(LiveTranscriptionEvents.UtteranceEnd, (data) => {
  log.info("🗣️ Utterance ended", {
    duration: data.duration_ms,
    trigger: "utterance_end_ms timeout or silence detected",
  });
});

dgConnection.on(LiveTranscriptionEvents.SpeechStarted, (data) => {
  log.info("🎤 Speech started", {
    timestamp: data.timestamp,
  });
});

// Enhanced transcript logging
dgConnection.on(LiveTranscriptionEvents.Transcript, (data) => {
  log.info("📝 Transcript received", {
    transcript: transcript,
    isFinal: data.is_final,
    confidence: data.channel.alternatives[0].confidence,
    duration: data.duration,
  });
});
```

#### **Feedback Prevention (Working)**

**The Challenge:** Without proper isolation, users would hear their own voice translated back to them, creating audio feedback loops.

**Multi-Layer Feedback Prevention System:**

**1. Server-Side TTS Routing (Primary Protection):**

```javascript
// Server only sends TTS audio to OTHER users, never back to speaker
if (user.userId !== speakerUserId) {
  await playback_to_websocket(user.websocket, stream);
  // Audio feedback prevention: NOT sent back to speaker
}

// Example: User A speaks French → Only User B gets Spanish TTS audio
// User A's Audio Connector receives NO TTS audio from their own speech
```

**2. Client-Side Stream Subscription Control (Secondary Protection):**

```javascript
// Client detects and skips own Audio Connector streams
session.on("streamCreated", function (event) {
  const stream = event.stream;
  const connectionData = JSON.parse(stream.connection.data);
  const streamUserId = connectionData.userId;
  const currentUserId = window.currentSession?.connection?.connectionId;

  const isOwnAudioConnector = streamUserId === currentUserId;

  if (isOwnAudioConnector) {
    console.log(
      "Skipping subscription to own Audio Connector - prevents feedback loop"
    );
    return; // Don't subscribe to own Audio Connector streams
  }

  // Only subscribe to OTHER users' Audio Connector streams
  session.subscribe(stream, hiddenContainer, {
    subscribeToAudio: true, // Hear translations FROM other users
    subscribeToVideo: false,
  });
});
```

**3. User Identification in Streams:**

```javascript
// Each Audio Connector stream includes user identification
token = videoClient.generateClientToken(sessionId, {
  data: JSON.stringify({
    userId: userId, // Embedded for stream identification
    type: "audio_connector",
    role: "translator",
  }),
});

// Allows client to distinguish "my Audio Connector" vs "other user's Audio Connector"
```

**Why This Works:**

- **Server Logic:** TTS only routed to different userIds
- **Client Logic:** Users never subscribe to their own Audio Connector streams

#### **Log Evidence of Success**

```log
[2025-09-04T22:03:24.978Z] ✅ Found other user for translation {
  "userId": "92cde67b-d772-4a82-b6bf-5e287ca02b48",
  "language": "es"
}

[2025-09-04T22:03:27.174Z] ✅ Audio transmission completed: 84 chunks sent
[2025-09-04T22:03:27.175Z] 🔄 PIPELINE 5: TTS audio sent to user {
  "method": "Audio Connector",
  "note": "Audio feedback prevention: NOT sent back to speaker"
}

[2025-09-04T22:04:07.227Z] ✅ Audio transmission completed: 120 chunks sent
[2025-09-04T22:04:07.228Z] ℹ️ Transcription sent to user's web client {
  "text": "Où est-il maintenant?"
}
```
