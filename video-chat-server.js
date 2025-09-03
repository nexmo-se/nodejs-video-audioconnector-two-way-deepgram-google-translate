// Enhanced multi-user language tracking
// sessionId -> { userId: { connectionId: websocketId, language: preferredLang, websocket: wsInstance } }
const sessionUsers = new Map();

/**
 * Helper function to add user to session tracking
 */
function addUserToSession(sessionId, userId, websocketId, websocketInstance) {
  if (!sessionUsers.has(sessionId)) {
    sessionUsers.set(sessionId, new Map());
  }

  const sessionMap = sessionUsers.get(sessionId);

  // Check if user already exists to preserve existing data (especially language preference)
  if (sessionMap.has(userId)) {
    const existingUser = sessionMap.get(userId);
    // Update connection info but preserve language and other settings
    existingUser.connectionId = websocketId;
    existingUser.websocket = websocketInstance;
    existingUser.isActive = true;
    // Keep existing language preference!

    log.info("User connection updated in session tracking", {
      sessionId,
      userId,
      connectionId: websocketId,
      preservedLanguage: existingUser.language,
      totalUsers: sessionMap.size,
    });
  } else {
    // New user - create fresh entry
    sessionMap.set(userId, {
      connectionId: websocketId,
      language: null, // Will be set when user selects language
      websocket: websocketInstance,
      isActive: true,
    });

    log.info("User added to session tracking", {
      sessionId,
      userId,
      connectionId: websocketId,
      totalUsers: sessionMap.size,
    });
  }
}

/**
 * Helper function to set user language preference
 */
function setUserLanguage(sessionId, userId, language) {
  if (sessionUsers.has(sessionId) && sessionUsers.get(sessionId).has(userId)) {
    sessionUsers.get(sessionId).get(userId).language = language;
    log.info("User language preference set", {
      sessionId,
      userId,
      language,
    });
    return true;
  }
  return false;
}

/**
 * Helper function to get all users in a session except the speaker
 */
function getOtherUsersInSession(sessionId, speakerUserId) {
  const users = [];
  if (sessionUsers.has(sessionId)) {
    const sessionMap = sessionUsers.get(sessionId);
    log.info("🔍 DEBUG: Checking users in session", {
      sessionId,
      speakerUserId,
      totalUsersInSession: sessionMap.size,
      allUserIds: Array.from(sessionMap.keys()),
    });

    for (const [userId, userInfo] of sessionMap) {
      log.info("🔍 DEBUG: Checking user", {
        userId,
        speakerUserId,
        isActive: userInfo.isActive,
        language: userInfo.language,
        isDifferentUser: userId !== speakerUserId,
      });

      if (userId !== speakerUserId && userInfo.isActive && userInfo.language) {
        users.push({
          userId,
          language: userInfo.language,
          websocket: userInfo.websocket,
          connectionId: userInfo.connectionId,
        });
        log.info("✅ Found other user for translation", {
          userId,
          language: userInfo.language,
        });
      }
    }
  } else {
    log.warning("❌ Session not found in sessionUsers", { sessionId });
  }

  log.info("🔍 DEBUG: getOtherUsersInSession result", {
    sessionId,
    speakerUserId,
    foundUsers: users.length,
    userLanguages: users.map((u) => ({
      userId: u.userId,
      language: u.language,
    })),
  });

  return users;
}
/**
 * Real-Time Video Chat with Multi-Language Translation
 *
 * This application provides a video chat platform with real-time speech translation.
 *
 * ARCHITECTURE OVERVIEW:
 * 1. Vonage Video API - Handles video/audio streaming between participants
 * 2. Audio Connector - Captures audio from video session
 * 3. Deepgram STT - Converts speech to text with speaker diarization
 * 4. Google Translate - Translates text between languages
 * 5. Deepgram TTS - Converts translated text back to speech
 * 6. WebSocket - Streams translated audio back to participants
 *
 * PIPELINE FLOW:
 * Audio Stream → STT → Translation → TTS → Audio Playback
 */

// Load environment variables from .env file
require("dotenv").config();

// Express.js web framework and middleware imports
var express = require("express");
var cors = require("cors"); // Cross-Origin Resource Sharing
var path = require("path"); // File path utilities
var cookieParser = require("cookie-parser"); // Cookie parsing middleware
var logger = require("morgan"); // HTTP request logging
var app = express();

// Vonage Video API imports for video session management
const { Auth } = require("@vonage/auth");
const { Video } = require("@vonage/video");

// WebSocket library for real-time communication
const ws = require("ws");

// Configure Express.js application
app.set("view engine", "ejs"); // Use EJS templating engine
app.use(logger("dev")); // Log HTTP requests in development format
app.use(cors()); // Enable CORS for all routes
app.use(express.json()); // Parse JSON request bodies
app.use(express.urlencoded({ extended: false })); // Parse URL-encoded bodies
app.use(cookieParser()); // Parse cookies from requests
app.use("/", express.static(path.join(__dirname, "views"))); // Serve static files

// Translation and speech processing imports
const fetch = require("cross-fetch"); // HTTP client (polyfill)
const translate = require("google-translate-api-x"); // Google Translate API

// Deepgram SDK for Speech-to-Text (STT) and Text-to-Speech (TTS)
const { createClient, LiveTranscriptionEvents } = require("@deepgram/sdk");
const deepgram = createClient(process.env.DEEPGRAM_API_KEY);

// Validate Deepgram API key
if (!process.env.DEEPGRAM_API_KEY || process.env.DEEPGRAM_API_KEY.length < 10) {
  console.error("❌ Invalid or missing Deepgram API key!");
  console.error(
    "Current key:",
    process.env.DEEPGRAM_API_KEY
      ? `${process.env.DEEPGRAM_API_KEY.substring(0, 8)}...`
      : "undefined"
  );
  process.exit(1);
}

// Enhanced logging utility
const log = {
  info: (message, data = null) => {
    const timestamp = new Date().toISOString();
    console.log(
      `[${timestamp}] ℹ️  ${message}`,
      data ? JSON.stringify(data, null, 2) : ""
    );
  },
  success: (message, data = null) => {
    const timestamp = new Date().toISOString();
    console.log(
      `[${timestamp}] ✅ ${message}`,
      data ? JSON.stringify(data, null, 2) : ""
    );
  },
  warning: (message, data = null) => {
    const timestamp = new Date().toISOString();
    console.log(
      `[${timestamp}] ⚠️  ${message}`,
      data ? JSON.stringify(data, null, 2) : ""
    );
  },
  error: (message, error = null) => {
    const timestamp = new Date().toISOString();
    console.log(
      `[${timestamp}] ❌ ${message}`,
      error ? error.message || error : ""
    );
  },
  pipeline: (step, message, data = null) => {
    const timestamp = new Date().toISOString();
    console.log(
      `[${timestamp}] 🔄 PIPELINE ${step}: ${message}`,
      data ? JSON.stringify(data, null, 2) : ""
    );
  },
  audio: (message, bufferSize = null) => {
    const timestamp = new Date().toISOString();
    const size = bufferSize ? ` (${(bufferSize / 1024).toFixed(1)}KB)` : "";
    console.log(`[${timestamp}] 🔊 AUDIO: ${message}${size}`);
  },
};

log.info("Deepgram SDK initialized", { version: deepgram.version });

// Application configuration from environment variables
const appId = process.env.APP_ID; // Vonage Application ID
const port = process.env.PORT || 3002; // Server port (default: 3002)
const websocket_server_uri = process.env.WEBSOCKET_SERVER_URI; // WebSocket server URI

// Initialize Vonage Video API authentication
const credentials = new Auth({
  applicationId: appId,
  privateKey: "private.key", // Path to Vonage private key file
});

// Create Vonage Video client with authentication credentials
const options = {};
const videoClient = new Video(credentials, options);

// Global session state (TODO: Move to proper session management)
var sessionId = null;

/**
 * Creates a new Vonage Video session and renders the main page
 * @param {Object} res - Express response object
 * @param {Object} req - Express request object
 */
async function new_session(res, req) {
  try {
    // Create new video session with routed media mode for Audio Connector compatibility
    const session = await videoClient.createSession({ mediaMode: "routed" });

    // Store session ID globally (TODO: Use proper session management)
    sessionId = session.sessionId;

    // Generate client token for this session
    token = videoClient.generateClientToken(sessionId);

    log.success("New video session created", {
      sessionId: sessionId,
      mediaMode: "routed",
    });

    // Render the main video chat page with session details
    res.render("index.ejs", {
      sessionId: sessionId,
      token: token,
      appId: appId,
      websocket_server_uri: websocket_server_uri,
    });
  } catch (error) {
    log.error("Failed to create new session", error);
    res.status(500).send("Failed to create session");
  }
}

// ===== HTTP ROUTES =====

/**
 * Root route - Creates a new video session
 * GET /
 */
app.get("/", function (req, res) {
  new_session(res, req);
});

/**
 * Session route - Joins an existing session
 * GET /:sessionId
 */
app.get("/:sessionId", function (req, res) {
  token = videoClient.generateClientToken(sessionId);
  res.render("index.ejs", {
    sessionId: sessionId,
    token: token,
    appId: appId,
    websocket_server_uri: websocket_server_uri,
  });
});

/**
 * Join route - Alternative way to join a session
 * GET /:sessionId/join
 */
app.get("/:sessionId/join", function (req, res) {
  console.log(req.params);
  sessionId = req.params["sessionId"];
  token = videoClient.generateClientToken(sessionId);
  res.render("index.ejs", {
    sessionId: sessionId,
    token: token,
    appId: appId,
    websocket_server_uri: websocket_server_uri,
  });
});

/**
 * MULTI-USER: Per-user Audio Connector initialization endpoint
 * GET /:sessionId/audioconnect/:userId
 *
 * Each user gets their own Audio Connector connection for:
 * 1. Individual language preference handling
 * 2. Separate STT pipelines per user
 * 3. Targeted TTS delivery to other users
 * 4. No audio feedback loops
 */
app.get("/:sessionId/audioconnect/:userId", async function (req, res) {
  try {
    const sessionId = req.params["sessionId"];
    const userId = req.params["userId"];

    log.info("Per-user Audio Connector connection request", {
      sessionId,
      userId,
    });

    token = videoClient.generateClientToken(sessionId);

    // Connect Audio Connector for this specific user
    // Each user gets their own WebSocket connection
    const result = await videoClient.connectToWebsocket(sessionId, token, {
      uri: `${websocket_server_uri}?userId=${userId}`, // Include user ID in WebSocket URI
      headers: {
        sessionid: sessionId,
        userid: userId,
      },
      audioRate: 16000,
      bidirectional: true, // Enable TTS playback to this user
    });

    if (result.connectionId != null) {
      log.success("Per-user Audio Connector connected", {
        sessionId,
        userId,
        connectionId: result.connectionId,
        audioRate: "16kHz",
        bidirectional: true,
      });

      return res.json({
        success: true,
        message: "User-specific Audio Connector connected",
        userId: userId,
        connectionId: result.connectionId,
      });
    } else {
      log.error("Per-user Audio Connector connection failed", {
        sessionId,
        userId,
      });
      return res.status(500).json({
        success: false,
        message: "User Audio Connector failed to connect",
        userId: userId,
      });
    }
  } catch (error) {
    log.error("Per-user Audio Connector connection error", error);
    return res.status(500).json({
      success: false,
      message: "User Audio Connector connection failed",
      userId: req.params["userId"],
      error: error.message,
    });
  }
});

/**
 * LEGACY: Session-wide Audio Connector (deprecated in favor of per-user)
 * GET /:sessionId/audioconnect
 */
app.get("/:sessionId/audioconnect", async function (req, res) {
  try {
    const sessionId = req.params["sessionId"];
    log.info("Audio Connector connection request", { sessionId });

    token = videoClient.generateClientToken(sessionId);

    // Connect Audio Connector to the video session
    // This captures audio from all participants and sends to our WebSocket
    const result = await videoClient.connectToWebsocket(sessionId, token, {
      uri: websocket_server_uri, // Our WebSocket server URI
      headers: { sessionid: sessionId }, // Pass session ID in headers
      audioRate: 16000, // 16kHz sample rate (required by Deepgram)
      bidirectional: true, // Enable audio playback (TTS → session)
    });

    if (result.connectionId != null) {
      log.success("Audio Connector connected successfully", {
        sessionId,
        connectionId: result.connectionId,
        audioRate: "16kHz",
        bidirectional: true,
      });

      return res.json({
        success: true,
        message: "Audio Connector connected to socket",
        connectionId: result.connectionId,
      });
    } else {
      log.error(
        "Audio Connector connection failed - no connection ID returned"
      );
      return res.status(500).json({
        success: false,
        message: "Audio Connector failed to connect to socket",
      });
    }
  } catch (error) {
    log.error("Audio Connector connection error", error);
    return res.status(500).json({
      success: false,
      message: "Audio Connector connection failed",
      error: error.message,
    });
  }
});

// ===== WEBSOCKET SERVER & AUDIO PROCESSING =====

/**
 * WebSocket server for handling Audio Connector connections
 * This server receives audio from Vonage and processes it through the STT→TTS pipeline
 */
const wsServer = new ws.Server({ noServer: true });
log.info("WebSocket server initialized and ready for connections");

/**
 * Generate unique connection IDs for WebSocket clients
 */
wsServer.getUniqueID = function () {
  function s4() {
    return Math.floor((1 + Math.random()) * 0x10000)
      .toString(16)
      .substring(1);
  }
  return s4() + s4() + "-" + s4();
};

/**
 * AUDIO PROCESSING: Convert TTS response stream to audio buffer
 * @param {ReadableStream} response - Stream from Deepgram TTS API
 * @returns {Buffer} - Audio buffer ready for transmission
 */
const getAudioBuffer = async (response) => {
  const reader = response.getReader();
  const chunks = [];

  // Read all chunks from the stream
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
  }

  // Combine all chunks into a single buffer
  const dataArray = chunks.reduce(
    (acc, chunk) => Uint8Array.from([...acc, ...chunk]),
    new Uint8Array(0)
  );
  return Buffer.from(dataArray.buffer);
};

/**
 * AUDIO TRANSMISSION: Send TTS audio back to video session
 * @param {WebSocket} ws - WebSocket connection to Audio Connector
 * @param {ReadableStream} stream - Audio stream from Deepgram TTS
 *
 * PIPELINE STEP 5: TTS Audio → Video Session
 * - Converts TTS stream to buffer
 * - Removes WAV header (44 bytes)
 * - Chunks audio into 640-byte packets for transmission
 * - Sends to Audio Connector which plays in video session
 */
const playback_to_websocket = async (ws, stream) => {
  try {
    if (stream) {
      // Convert the TTS stream to an audio buffer
      const buffer = await getAudioBuffer(stream);

      // Remove the WAV header (first 44 bytes) - Audio Connector expects raw PCM
      const audioData = buffer.subarray(44, buffer.length);

      log.audio(`TTS audio prepared for transmission`, audioData.length);
      log.pipeline(
        "5",
        `Sending ${(audioData.length / 1024).toFixed(
          1
        )}KB audio to video session`
      );

      // Send audio in 640-byte chunks (optimal for real-time streaming)
      let chunksSent = 0;
      for (let i = 0; i <= audioData.length; i += 640) {
        ws.send(audioData.subarray(i, i + 640));
        chunksSent++;
      }

      log.success(`Audio transmission completed: ${chunksSent} chunks sent`);
    } else {
      log.error("No audio stream provided for playback");
    }
  } catch (error) {
    log.error("Audio transmission failed", error);
  }
};

/**
 * ENHANCED MULTI-USER WEBSOCKET CONNECTION HANDLER
 *
 * This handles connections from:
 * 1. Per-user Audio Connectors (sends audio from individual users)
 * 2. Web clients (receive transcription updates and set language preferences)
 *
 * NEW MULTI-USER PIPELINE IMPLEMENTATION
 */
wsServer.on("connection", (websocket, request) => {
  // Parse URL to extract user ID if present
  const url = new URL(request.url, `http://${request.headers.host}`);
  const userIdFromUrl = url.searchParams.get("userId");

  // Assign unique ID to this WebSocket connection
  websocket.id = wsServer.getUniqueID();
  websocket.userId = userIdFromUrl; // Store user ID for per-user processing
  websocket.sessionId = null; // Will be set from Audio Connector headers
  websocket.userLanguage = null; // Will be set when user selects language
  websocket.isAudioConnector = !!userIdFromUrl; // Flag to distinguish connection types

  log.info("New WebSocket connection established", {
    connectionId: websocket.id,
    userId: websocket.userId,
    connectionType: websocket.userId
      ? "Per-User Audio Connector"
      : "Web Client",
  });

  // Initialize Deepgram connection variable - will be configured when Audio Connector sends setup message
  var dgConnection = null;

  // Buffer for combining partial transcripts into complete sentences
  var transcriptBuffer = "";
  var lastTranscriptTime = 0;
  var transcriptTimeout = null;

  /**
   * MESSAGE HANDLER - Routes different types of WebSocket messages
   *
   * AUDIO CONNECTOR PROTOCOL (from Vonage Video API):
   * 1. "content-type" field - First message from Audio Connector
   *    - Source: Vonage Audio Connector WebSocket (automatic)
   *    - Purpose: Initialize connection with audio format details
   *    - Format: {"content-type":"audio/l16;rate=16000","event":"websocket:connected"}
   *    - Documentation: https://tokbox.com/developer/guides/audio-connector#first-message
   *    - Triggers: STT pipeline initialization with Deepgram
   *
   * 2. Binary audio data - Continuous stream from Audio Connector
   *    - Source: Vonage Audio Connector WebSocket (automatic)
   *    - Purpose: Raw PCM audio for transcription (640-byte frames, 20ms each)
   *    - Format: Linear PCM 16-bit, 16kHz sample rate, 50 frames/second
   *    - Documentation: https://tokbox.com/developer/guides/audio-connector#binary-audio-messages
   *    - Triggers: STT→Translation→TTS pipeline processing
   *
   * CUSTOM CLIENT PROTOCOL (from index.ejs):
   * 3. "set_id" command - Client identification message
   *    - Source: index.ejs line 79 (sent on page load)
   *    - Purpose: Register web client to receive transcription updates
   *    - Format: {"command":"set_id","id":"client_<%=sessionId%>"}
   *    - Triggers: Client registration for transcript broadcasting
   *
   * 4. "close_audio_connector" command - Cleanup request
   *    - Source: index.ejs line 126 (sent on page unload/beforeunload)
   *    - Purpose: Request shutdown of Audio Connector for session cleanup
   *    - Format: {"command":"close_audio_connector","sessionid":"<%=sessionId%>"}
   *    - Triggers: Audio Connector connection termination and resource cleanup
   */
  websocket.on("message", function message(data, isBinary) {
    // ===== PER-USER AUDIO CONNECTOR INITIALIZATION =====
    if (data.toString().includes("content-type")) {
      /**
       * ENHANCED AUDIO CONNECTOR SETUP MESSAGE FOR MULTI-USER
       * Now handles per-user Audio Connector connections with individual language processing
       */
      const messageData = JSON.parse(data);
      const sessionId = messageData["sessionid"];
      const userId = messageData["userid"] || websocket.userId;

      // Set connection identifiers
      websocket.sessionId = sessionId;
      websocket.userId = userId;

      // Add user to session tracking
      addUserToSession(sessionId, userId, websocket.id, websocket);

      log.pipeline("INIT", "Per-user Audio Connector setup", {
        sessionId: sessionId,
        userId: userId,
        connectionId: websocket.id,
        connectionType: "Per-User Audio Connector",
      });

      /**
       * PIPELINE STEP 1: Configure Deepgram STT for Individual User Processing
       *
       * Using simplified configuration for better reliability:
       * - Basic settings to ensure connection stability
       * - Removed advanced features that might cause connection issues
       */
      try {
        dgConnection = deepgram.listen.live({
          // === BASIC REQUIRED SETTINGS ===
          language: "multi", // Multi-language detection for Spanish→English translation
          model: "nova-2", // Use stable Nova 2 model
          encoding: "linear16", // PCM audio format
          sample_rate: 16000, // 16kHz sample rate
          channels: 1, // Mono audio

          // === PROCESSING SETTINGS (SIMPLIFIED) ===
          interim_results: false, // Only final results to avoid splitting
          punctuate: true, // Add punctuation
          diarize: false, // No diarization
        });

        log.pipeline("1", "Deepgram STT configured with basic settings", {
          language: "Multi-language (for Spanish→English translation)",
          model: "nova-2",
          sampleRate: "16kHz",
          encoding: "linear16",
          channels: 1,
          interimResults: "disabled (final only)",
          note: "Using basic settings for stability",
        });
      } catch (configError) {
        log.error("Failed to configure Deepgram connection", {
          error: configError.message,
          apiKey: process.env.DEEPGRAM_API_KEY ? "present" : "missing",
        });
        return;
      }

      // ===== DEEPGRAM EVENT HANDLERS =====
      dgConnection.on(LiveTranscriptionEvents.Open, () => {
        log.success("Deepgram STT connection opened and ready");
      });

      dgConnection.on(LiveTranscriptionEvents.Error, (error) => {
        log.error("Deepgram connection error", error);
        // Don't call requestClose here to avoid infinite loop
      });

      // ===== UTTERANCE DETECTION EVENTS =====
      dgConnection.on(LiveTranscriptionEvents.UtteranceEnd, (data) => {
        log.info("🗣️ Utterance ended", {
          duration: data.duration_ms ? `${data.duration_ms}ms` : "unknown",
          trigger: "utterance_end_ms timeout or silence detected",
        });
      });

      dgConnection.on(LiveTranscriptionEvents.SpeechStarted, (data) => {
        log.info("🎤 Speech started", {
          timestamp: data.timestamp || "unknown",
        });
      });

      // Debug: Add metadata event to see if Deepgram is processing audio
      dgConnection.on(LiveTranscriptionEvents.Metadata, (data) => {
        log.info("📊 Deepgram metadata received", {
          metadata: data,
        });
      });

      // Wait a moment for Deepgram connection to fully establish
      setTimeout(() => {
        log.info("Deepgram connection initialization complete", {
          connectionState: dgConnection.getReadyState(),
        });
      }, 1000);

      /**
       * CORE STT→TRANSLATION→TTS PIPELINE
       *
       * PIPELINE STEP 2: Process Speech-to-Text Results
       * Triggered when Deepgram completes transcription
       *
       * Enhanced with utterance detection debugging and error handling
       */
      dgConnection.on(LiveTranscriptionEvents.Transcript, async (data) => {
        // Reduced logging for cleaner output during sentence processing

        try {
          // Validate Deepgram response structure
          if (
            !data ||
            !data.channel ||
            !data.channel.alternatives ||
            !data.channel.alternatives[0]
          ) {
            log.warning("Invalid Deepgram response structure", { data });
            return;
          }

          // Extract transcript from Deepgram response
          const transcript = data.channel.alternatives[0].transcript;

          // Only log final transcripts to reduce noise
          if (transcript && transcript.trim() && data.is_final) {
            log.info("📝 Final transcript", {
              transcript: transcript,
              confidence: data.channel.alternatives[0].confidence,
            });
          }

          // Only process non-empty final transcripts
          if (transcript && transcript.trim() && data.is_final) {
            // SENTENCE BUFFERING LOGIC to combine partial sentences
            const currentTime = Date.now();

            // Clear any existing timeout
            if (transcriptTimeout) {
              clearTimeout(transcriptTimeout);
              transcriptTimeout = null;
            }

            // If this is the first transcript or more than 2 seconds since last one, start new buffer
            if (!transcriptBuffer || currentTime - lastTranscriptTime > 2000) {
              transcriptBuffer = transcript;
            } else {
              // Combine with previous transcript (add space if needed)
              transcriptBuffer +=
                transcriptBuffer.endsWith(".") ||
                transcriptBuffer.endsWith("!") ||
                transcriptBuffer.endsWith("?")
                  ? ` ${transcript}`
                  : ` ${transcript}`;
            }

            lastTranscriptTime = currentTime;

            // Set timeout to process the buffered sentence after 1.5 seconds of silence
            transcriptTimeout = setTimeout(async () => {
              try {
                await processCompleteTranscript(transcriptBuffer, websocket);
                transcriptBuffer = "";
                transcriptTimeout = null;
              } catch (processError) {
                log.error("Error processing complete transcript", {
                  error: processError.message,
                  transcript: transcriptBuffer,
                });
              }
            }, 1500);

            // Only log buffering for sentences longer than single words
            if (transcriptBuffer.split(" ").length > 2) {
              log.info("📝 Buffering sentence", {
                parts: transcriptBuffer.split(" ").length + " words",
                willProcessIn: "1.5s",
              });
            }
          }
        } catch (error) {
          log.error("Pipeline processing failed", {
            error: error.message,
            stack: error.stack,
            userId: websocket.id,
          });
        }

        // ENHANCED: Multi-user translation processing function
        async function processCompleteTranscript(
          completeTranscript,
          speakerWebSocket
        ) {
          try {
            const speakerUserId = speakerWebSocket.userId;
            const sessionId = speakerWebSocket.sessionId;

            log.pipeline("2", "Processing complete sentence from user", {
              speakerUserId: speakerUserId,
              sessionId: sessionId,
              length: completeTranscript.length + " chars",
              words: completeTranscript.split(" ").length,
            });

            // ===== SEND ORIGINAL TRANSCRIPTION TO SPEAKER =====
            // Send the speaker's own transcription to their web client first
            const speakerTranscriptionUpdate = {
              type: "transcription",
              speakerUserId: speakerUserId,
              timestamp: new Date().toLocaleTimeString("en-US", {
                hour12: true,
                hour: "numeric",
                minute: "2-digit",
              }),
              originalText: completeTranscript,
              translatedText: completeTranscript, // Same as original for speaker
              sourceLanguage: "auto",
              targetLanguage: "original",
            };

            // Send to speaker's web client
            wsServer.clients.forEach(function each(client) {
              if (
                client.sessionId === sessionId &&
                client.readyState === client.OPEN &&
                !client.isAudioConnector // This is a web client, not an Audio Connector
              ) {
                try {
                  client.send(JSON.stringify(speakerTranscriptionUpdate));
                  log.info("Original transcription sent to web client", {
                    speakerUserId: speakerUserId,
                    clientUserId: client.userId,
                    text: completeTranscript,
                  });
                } catch (sendError) {
                  log.warning("Failed to send transcription to client", {
                    clientUserId: client.userId,
                    error: sendError.message,
                  });
                }
              }
            });

            // ===== MULTI-USER TRANSLATION LOGIC =====
            // Get all other users in this session who need translations
            const otherUsers = getOtherUsersInSession(sessionId, speakerUserId);

            if (otherUsers.length === 0) {
              log.info("No other users found to receive translations", {
                sessionId,
                speakerUserId,
                transcript: completeTranscript,
              });
              return; // Still return since we already sent to speaker
            }

            log.info(`Processing translations for ${otherUsers.length} users`, {
              speakerUserId,
              sessionId,
              recipients: otherUsers.map((u) => ({
                userId: u.userId,
                language: u.language,
              })),
            });

            // Process translation for each user in the session
            for (const user of otherUsers) {
              try {
                // Translate to user's preferred language
                let translationResult;
                try {
                  translationResult = await translate(completeTranscript, {
                    to: user.language,
                  });
                } catch (translateError) {
                  log.error("Translation failed, using original text", {
                    error: translateError.message,
                    originalText: completeTranscript,
                    targetLanguage: user.language,
                    targetUserId: user.userId,
                  });
                  translationResult = {
                    text: completeTranscript,
                    from: { language: { iso: "unknown" } },
                  };
                }

                log.pipeline("3", "Translation completed", {
                  speakerUserId: speakerUserId,
                  targetUserId: user.userId,
                  fromLang: translationResult.from?.language?.iso || "auto",
                  toLang: user.language,
                  textLength: translationResult.text.length + " chars",
                });

                // Only generate TTS if the detected language is different from target language
                if (translationResult.from?.language?.iso !== user.language) {
                  // Create Text-to-Speech for this user
                  const response = await deepgram.speak.request(
                    { text: translationResult.text },
                    {
                      model: "aura-asteria-en", // TODO: Use language-specific models
                      encoding: "linear16",
                      container: "wav",
                    }
                  );

                  const stream = await response.getStream();
                  if (!stream) {
                    log.error("No audio stream received from Deepgram TTS", {
                      targetUserId: user.userId,
                      text: translationResult.text,
                    });
                    continue;
                  }

                  log.pipeline("4", "TTS generated for user", {
                    speakerUserId: speakerUserId,
                    targetUserId: user.userId,
                    language: user.language,
                  });

                  // Send TTS audio to this specific user's Audio Connector
                  if (user.websocket.readyState === user.websocket.OPEN) {
                    await playback_to_websocket(user.websocket, stream);

                    log.pipeline("5", "TTS audio sent to user", {
                      speakerUserId: speakerUserId,
                      targetUserId: user.userId,
                      method: "Audio Connector",
                    });
                  } else {
                    log.warning("User WebSocket not ready for TTS playback", {
                      targetUserId: user.userId,
                      state: user.websocket.readyState,
                    });
                  }
                } else {
                  log.info("Skipping TTS - same language detected", {
                    speakerUserId: speakerUserId,
                    targetUserId: user.userId,
                    detectedLang: translationResult.from?.language?.iso,
                    targetLang: user.language,
                  });
                }

                // Send transcription update to user's web client
                const transcriptionUpdate = {
                  type: "transcription",
                  speakerUserId: speakerUserId,
                  timestamp: new Date().toLocaleTimeString("en-US", {
                    hour12: true,
                    hour: "numeric",
                    minute: "2-digit",
                  }),
                  originalText: completeTranscript,
                  translatedText: translationResult.text,
                  sourceLanguage:
                    translationResult.from?.language?.iso || "auto",
                  targetLanguage: user.language,
                };

                // Find and send to user's web client connection
                wsServer.clients.forEach(function each(client) {
                  if (
                    client.userId === user.userId &&
                    client.readyState === client.OPEN &&
                    client.sessionId === sessionId &&
                    !client.isAudioConnector // This is a web client, not an Audio Connector
                  ) {
                    try {
                      client.send(JSON.stringify(transcriptionUpdate));
                      log.info("Transcription sent to user's web client", {
                        speakerUserId: speakerUserId,
                        targetUserId: user.userId,
                        text: translationResult.text,
                      });
                    } catch (sendError) {
                      log.warning("Failed to send transcription to user", {
                        targetUserId: user.userId,
                        error: sendError.message,
                      });
                    }
                  }
                });
              } catch (userProcessingError) {
                log.error("Failed to process translation for user", {
                  speakerUserId: speakerUserId,
                  targetUserId: user.userId,
                  error: userProcessingError.message,
                  transcript: completeTranscript,
                });
              }
            }
          } catch (error) {
            log.error("Complete transcript processing failed", {
              error: error.message,
              stack: error.stack,
              transcript: completeTranscript,
              speakerUserId: speakerWebSocket.userId,
            });
          }
        }
      });

      // Handle Deepgram connection events
      dgConnection.on(LiveTranscriptionEvents.Close, (closeEvent) => {
        log.warning("Deepgram connection closed", {
          type: closeEvent.type,
          timeStamp: closeEvent.timeStamp,
        });
        dgConnection.requestClose();
      });

      dgConnection.on(LiveTranscriptionEvents.Error, (error) => {
        log.error("Deepgram connection error", error);
        dgConnection.requestClose();
      });
    }

    // ===== CLIENT IDENTIFICATION (from index.ejs line 79) =====
    else if (data.toString().includes("set_id")) {
      /**
       * CLIENT REGISTRATION MESSAGE
       * Sent by web clients to identify themselves for receiving transcription updates.
       *
       * Source: index.ejs line 79 - executed on page load
       * Code: websocket.send(JSON.stringify({command:"set_id", id:"client_<%=sessionId%>"}));
       * Purpose: Allows server to broadcast transcriptions to specific web clients
       * Trigger: Page load event in browser
       */
      const messageData = JSON.parse(data);
      const clientId = messageData["id"];
      const sessionId = messageData["sessionId"];
      const userId = messageData["userId"]; // connectionId from frontend

      websocket.id = clientId;
      websocket.sessionId = sessionId;
      websocket.userId = userId;

      // Add user to session tracking for language preferences
      if (sessionId && userId) {
        addUserToSession(sessionId, userId, websocket.id, websocket);

        log.info("Client identified and added to session tracking", {
          clientId: clientId,
          sessionId: sessionId,
          userId: userId,
          connectionType: "Web Client",
        });
      } else {
        log.info("Client identified for transcription updates", {
          clientId: clientId,
          connectionType: "Web Client",
        });
      }
    }

    // ===== ENHANCED LANGUAGE PREFERENCE SETTING =====
    else if (data.toString().includes("set_preferred_language")) {
      const messageData = JSON.parse(data);
      const sessionId = messageData["sessionid"];
      const userId = messageData["userid"] || websocket.userId;
      const language = messageData["language"];

      // Set language preference using new multi-user tracking
      if (setUserLanguage(sessionId, userId, language)) {
        log.info("Language preference set for user", {
          sessionId,
          userId,
          language,
          connectionId: websocket.id,
        });

        // Broadcast language change to other users in session
        const otherUsers = getOtherUsersInSession(sessionId, userId);
        const languageUpdate = {
          type: "user_language_changed",
          userId: userId,
          language: language,
          timestamp: new Date().toISOString(),
        };

        otherUsers.forEach((user) => {
          if (user.websocket.readyState === user.websocket.OPEN) {
            try {
              user.websocket.send(JSON.stringify(languageUpdate));
            } catch (error) {
              log.warning("Failed to broadcast language change", {
                error: error.message,
                targetUserId: user.userId,
              });
            }
          }
        });
      } else {
        log.warning("Failed to set language preference - user not found", {
          sessionId,
          userId,
          language,
        });
      }
    }

    // ===== CLEANUP REQUEST (from index.ejs line 126) =====
    else if (data.toString().includes("close_audio_connector")) {
      /**
       * AUDIO CONNECTOR SHUTDOWN REQUEST
       * Sent by web clients to request cleanup of Audio Connector resources.
       *
       * Source: index.ejs line 126 - executed on page unload/beforeunload
       * Code: websocket.send(JSON.stringify({command:"close_audio_connector", sessionid:"<%=sessionId%>"}));
       * Purpose: Graceful shutdown of Audio Connector to prevent resource leaks
       * Trigger: Page unload/close events in browser
       */
      const messageData = JSON.parse(data);
      const sessionId = messageData["sessionid"];

      log.warning("Audio Connector shutdown requested", { sessionId });

      // Close Audio Connector connection and cleanup resources
      wsServer.clients.forEach(function each(client) {
        if (client.id === sessionId) {
          client.close(); // This will also close the Deepgram connection
          log.success("Audio Connector connection closed", { sessionId });
        }
      });
    }

    // ===== BINARY AUDIO DATA PROCESSING (from Audio Connector) =====
    else {
      /**
       * AUDIO CONNECTOR BINARY DATA
       * Raw PCM audio data sent continuously by Vonage Audio Connector.
       *
       * According to Audio Connector documentation:
       * - Format: Linear PCM 16-bit, 16kHz sample rate
       * - Frame size: 640 bytes (20ms of audio)
       * - Frequency: 50 frames per second
       * - Purpose: Real-time audio transcription and translation
       *
       * This audio data flows through our STT→Translation→TTS pipeline.
       */
      /**
       * PIPELINE STEP 1: Audio Stream → STT
       * Raw audio data from Audio Connector sent to Deepgram for transcription
       */
      if (dgConnection != null && dgConnection.getReadyState() == 1) {
        try {
          dgConnection.send(data); // Forward audio to Deepgram STT
          // Only log audio data periodically to avoid spam
          if (Math.random() < 0.001) {
            // Log ~0.1% of audio packets
            log.audio(`Audio data forwarded to Deepgram STT`, data.length);
          }
        } catch (audioError) {
          log.error("Failed to send audio to Deepgram", {
            error: audioError.message,
            dgConnectionState: dgConnection.getReadyState(),
          });
        }
      } else {
        // Only log connection state issues occasionally to avoid spam
        if (Math.random() < 0.01) {
          // Log ~1% of failed audio packets
          if (dgConnection == null) {
            log.warning("Deepgram connection is null, cannot send audio");
          } else {
            log.warning("Deepgram connection not ready, buffering audio", {
              state: dgConnection.getReadyState(),
              stateDescription:
                dgConnection.getReadyState() === 0
                  ? "CONNECTING"
                  : dgConnection.getReadyState() === 2
                  ? "CLOSING"
                  : dgConnection.getReadyState() === 3
                  ? "CLOSED"
                  : "UNKNOWN",
            });
          }
        }
      }
    }
  });

  /**
   * ENHANCED CONNECTION CLEANUP for Multi-User Architecture
   * Properly close Deepgram connections and remove user from session tracking
   */
  websocket.on("close", function close(code, reason) {
    log.warning("WebSocket connection closed", {
      connectionId: websocket.id,
      userId: websocket.userId,
      sessionId: websocket.sessionId,
      code: code,
      reason: reason?.toString(),
    });

    // Clean up user from session tracking
    if (websocket.sessionId && websocket.userId) {
      if (sessionUsers.has(websocket.sessionId)) {
        const sessionMap = sessionUsers.get(websocket.sessionId);
        if (sessionMap.has(websocket.userId)) {
          sessionMap.get(websocket.userId).isActive = false;
          sessionMap.delete(websocket.userId);

          log.info("User removed from session tracking", {
            sessionId: websocket.sessionId,
            userId: websocket.userId,
            remainingUsers: sessionMap.size,
          });

          // Remove session if no users left
          if (sessionMap.size === 0) {
            sessionUsers.delete(websocket.sessionId);
            log.info("Session removed - no users remaining", {
              sessionId: websocket.sessionId,
            });
          }
        }
      }
    }

    // Clean up Deepgram connection
    if (dgConnection != null) {
      dgConnection.requestClose();
      log.info("Deepgram connection cleaned up", {
        userId: websocket.userId,
      });
    }
  });

  websocket.on("error", function error(err) {
    log.error("WebSocket connection error", err);
  });
});

// ===== SERVER INITIALIZATION =====

/**
 * Start the HTTP server
 */
const server = app.listen(port, () => {
  log.success(`Server started successfully`, {
    port: port,
    environment: process.env.NODE_ENV || "development",
    websocketUri: websocket_server_uri,
  });
});

/**
 * Attach WebSocket server to HTTP server
 * This handles the WebSocket upgrade requests
 */
server.on("upgrade", (request, socket, head) => {
  log.info("WebSocket upgrade request received", {
    url: request.url,
    headers: request.headers,
  });

  wsServer.handleUpgrade(request, socket, head, (websocket) => {
    wsServer.emit("connection", websocket, request);
  });
});
