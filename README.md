# **Real-Time Video Chat with Multi-Language Translation**

A professional-grade video chat application with real-time speech translation powered by Vonage Video API, Deepgram STT/TTS, and Google Translate.

## **🎯 Features**

- **Multi-Language Translation**: Auto-detects and translates speech between 10+ languages
- **Real-Time Audio Processing**: Live speech-to-text, translation, and text-to-speech pipeline
- **Speaker Diarization**: Separates and identifies different speakers in the conversation
- **Bidirectional Audio**: Both receives and sends translated audio back to participants
- **Live Transcription**: Real-time transcript display with speaker identification
- **Professional Logging**: Comprehensive pipeline monitoring and debugging

## **🏗️ Architecture Overview**

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Video Chat    │───▶│  Audio Connector │───▶│   Deepgram STT  │
│   (Vonage API)  │    │   (Captures      │    │   (Multi-lang)  │
│                 │    │    Audio)        │    │                 │
└─────────────────┘    └──────────────────┘    └─────────────────┘
         ▲                                               │
         │                                               ▼
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   TTS Audio     │◀───│  Deepgram TTS    │◀───│ Google Translate│
│   Playback      │    │  (English Voice) │    │  (Text → EN)    │
└─────────────────┘    └──────────────────┘    └─────────────────┘
```

### **Pipeline Flow:**
1. **Audio Capture**: Vonage Audio Connector captures audio from video session
2. **STT**: Audio → Deepgram STT → Text (with speaker diarization)
3. **Translation**: Text → Google Translate → English text
4. **TTS**: English text → Deepgram TTS → Audio stream
5. **Playback**: Audio stream → Audio Connector → Video session

## **🌍 Supported Languages**

**Auto-Detection Supported:**
- English, Spanish, French, German, Hindi, Russian
- Portuguese, Japanese, Italian, Dutch
- And more via Deepgram's multi-language model

## **📋 Prerequisites**

- **Node.js** v16+ installed
- **Vonage Video API** account and application
- **Deepgram API** account and API key
- **ngrok** or similar tunneling service (for development)

## **🚀 Quick Start**

### **1. Clone and Install**
```bash
git clone <repository-url>
cd nodejs-video-audioconnector-two-way-deepgram-google-translate
npm install
```

### **2. Environment Configuration**
Copy the sample environment file and configure:
```bash
cp .env.samp .env
```

Edit `.env` with your credentials:
```env
APP_ID=your_vonage_application_id
PORT=3000
DEEPGRAM_API_KEY=your_deepgram_api_key
WEBSOCKET_SERVER_URI=wss://your-domain.com
NODE_ENV=development
```

### **3. Private Key Setup**
```bash
cp private.key.samp private.key
# Add your Vonage private key content to private.key
```

### **4. Development Setup (with ngrok)**
For easy development with tunneling:
```bash
# Start development server with auto-tunneling
node update-env.js
```

### **5. Manual Start**
```bash
# Start the server manually
node video-chat-server.js
```

## **📖 How to Use**

### **Starting a Session**
1. Navigate to `http://localhost:3000` (or your domain)
2. A new video session will be created automatically
3. Copy the join link to invite other participants

### **Enabling Translation**
1. Click **"Start Deepgram"** button to begin the translation pipeline
2. Speak in any supported language
3. The system will:
   - Transcribe your speech
   - Detect the language
   - Translate to English (if needed)
   - Play back English audio to other participants
   - Display transcriptions in real-time

### **Multiple Speakers**
- The system automatically separates different speakers
- Each speaker's translations are processed independently
- Transcriptions show speaker IDs (Speaker 0, Speaker 1, etc.)

## **🔧 API Endpoints**

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/` | GET | Create new video session |
| `/:sessionId` | GET | Join existing session |
| `/:sessionId/join` | GET | Alternative join route |
| `/:sessionId/token` | GET | Generate authentication token |
| `/:sessionId/streams` | GET | Get stream information |
| `/:sessionId/audioconnect` | GET | Initialize Audio Connector |

## **📊 Logging & Monitoring**

The application provides comprehensive logging with different categories:

- **ℹ️ Info**: General application information
- **✅ Success**: Successful operations
- **⚠️ Warning**: Warnings and non-critical issues  
- **❌ Error**: Error conditions
- **🔄 Pipeline**: STT→Translation→TTS pipeline steps
- **🔊 Audio**: Audio processing metrics

### **Sample Log Output**
```
[2025-09-02T10:30:15.123Z] ✅ Audio Connector connected successfully {
  "sessionId": "1_MX4xM...",
  "connectionId": "ac_12345",
  "audioRate": "16kHz",
  "bidirectional": true
}

[2025-09-02T10:30:16.456Z] 🔄 PIPELINE 2: Speech-to-Text completed {
  "transcript": "Hola, ¿cómo estás?",
  "isFinal": true
}

[2025-09-02T10:30:16.789Z] 🔄 PIPELINE 3: Translation completed for Speaker 0 {
  "originalText": "Hola, ¿cómo estás?",
  "detectedLanguage": "es",
  "translatedText": "Hello, how are you?"
}
```

## **🛠️ Development**

### **Project Structure**
```
├── video-chat-server.js    # Main application server
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

### **Key Dependencies**
- **@vonage/video**: Video API integration
- **@deepgram/sdk**: Speech-to-text and text-to-speech
- **google-translate-api-x**: Translation services
- **express**: Web framework
- **ws**: WebSocket server
- **ejs**: Template engine

## **🔒 Security Considerations**

- Private keys and API credentials are not committed to repository
- CORS is configured for security
- Session tokens have appropriate scoping
- WebSocket connections are properly validated

## **🚨 Troubleshooting**

### **Audio Connector Issues**
- Ensure `mediaMode: "routed"` is set for video sessions
- Verify WebSocket URI is accessible from Vonage servers
- Check that port 443 (WSS) is properly configured

### **Translation Not Working**
- Verify Deepgram API key is valid and has sufficient credits
- Check that audio sample rate is 16kHz
- Ensure internet connectivity for Google Translate API

### **Connection Problems**
- Check firewall settings for WebSocket connections
- Verify ngrok tunnel is active (in development)
- Ensure all environment variables are properly set

## **📈 Performance Notes**

- Audio is processed in 640-byte chunks for optimal streaming
- Only non-English speech generates TTS to reduce processing
- Audio data logging is sampled to prevent log spam
- Graceful shutdown handling prevents resource leaks

## **🤝 Contributing**

1. Create a feature branch: `git checkout -b feature-name`
2. Make your changes with proper logging
3. Test the complete STT→Translation→TTS pipeline
4. Update documentation as needed
5. Submit a pull request

## **📄 License**

This project is licensed under the ISC License - see the package.json file for details.

## **🔗 Related Documentation**

- [Vonage Video API Docs](https://developer.vonage.com/en/video/overview)
- [Deepgram API Docs](https://developers.deepgram.com/)
- [Audio Connector Guide](https://developer.vonage.com/en/video/guides/audio-connector)
- [Google Translate API](https://cloud.google.com/translate/docs)

## **🔄 Refactoring Changelog**

### **Version 1.0 - Initial Refactor**

#### **Code Quality Improvements**
- ✅ **Enhanced Logging**: Added comprehensive logging system with timestamps, categories, and structured data
- ✅ **Error Handling**: Implemented proper try-catch blocks and error management throughout
- ✅ **Code Documentation**: Added detailed comments explaining the STT→Translation→TTS pipeline
- ✅ **Dependency Cleanup**: Removed 13 unused dependencies (54% reduction in package size)

#### **Architecture Improvements**
- ✅ **Session Management**: Improved session creation with proper error handling
- ✅ **WebSocket Management**: Enhanced connection handling with proper cleanup
- ✅ **Audio Processing**: Optimized audio buffer handling and chunking
- ✅ **Pipeline Monitoring**: Added step-by-step pipeline tracking and metrics

#### **Developer Experience**
- ✅ **Consistent Naming**: Applied consistent naming conventions throughout codebase
- ✅ **Structured Comments**: Added comprehensive inline documentation
- ✅ **Performance Logging**: Added audio processing metrics and connection monitoring
- ✅ **Graceful Shutdown**: Implemented proper server shutdown handling

#### **Technical Improvements**
- ✅ **Memory Management**: Proper cleanup of Deepgram connections and WebSocket resources
- ✅ **Audio Optimization**: Removed WAV headers and optimized chunk sizes for real-time streaming
- ✅ **Connection Stability**: Enhanced WebSocket error handling and reconnection logic
- ✅ **Monitoring**: Added detailed pipeline step logging for debugging and monitoring
