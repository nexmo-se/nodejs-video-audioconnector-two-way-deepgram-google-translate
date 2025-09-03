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
 * CRITICAL: Audio Connector initialization endpoint
 * GET /:sessionId/audioconnect
 *
 * This endpoint starts the STT→Translation→TTS pipeline by:
 * 1. Connecting Vonage Audio Connector to the video session
 * 2. Routing session audio to our WebSocket server
 * 3. Enabling bidirectional audio for TTS playback
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
 * MAIN WEBSOCKET CONNECTION HANDLER
 *
 * This handles connections from:
 * 1. Vonage Audio Connector (sends audio from video session)
 * 2. Web clients (receive transcription updates)
 *
 * COMPLETE STT→TRANSLATION→TTS PIPELINE IMPLEMENTATION
 */
wsServer.on("connection", (websocket) => {
  // Assign unique ID to this WebSocket connection
  websocket.id = wsServer.getUniqueID();
  log.info("New WebSocket connection established", {
    connectionId: websocket.id,
  });

  // Initialize Deepgram connection for Speech-to-Text
  // This will be configured when Audio Connector sends setup message
  var dgConnection = deepgram.listen.live();

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
    // ===== AUDIO CONNECTOR INITIALIZATION (Vonage Video API) =====
    if (data.toString().includes("content-type")) {
      /**
       * AUDIO CONNECTOR SETUP MESSAGE
       * This is the first message sent by Vonage Audio Connector when establishing connection.
       * According to Audio Connector docs, it contains:
       * - content-type: "audio/l16;rate=16000" (Linear PCM format)
       * - event: "websocket:connected"
       * - Any custom headers from the REST API call
       *
       * This message triggers the initialization of our STT pipeline.
       */
      const messageData = JSON.parse(data);
      websocket.id = messageData["sessionid"];

      log.pipeline("INIT", "Audio Connector setup received", {
        sessionId: websocket.id,
        connectionType: "Audio Connector",
      });

      /**
       * PIPELINE STEP 1: Configure Deepgram STT
       *
       * Key configuration:
       * - language: "multi" - Detects multiple languages automatically
       * - diarize: true - Separates different speakers
       * - model: "nova-3" - Latest Deepgram model for accuracy
       */
      dgConnection = deepgram.listen.live({
        punctuate: true, // Add punctuation to transcripts
        interim_results: false, // Only process final results (more accurate)
        language: "multi", // Multi-language detection
        model: "nova-3", // Latest Deepgram model
        encoding: "linear16", // PCM audio format
        sample_rate: 16000, // 16kHz sample rate
        channel: 2, // Stereo audio
        diarize: true, // Speaker separation
      });

      log.pipeline("1", "Deepgram STT configured", {
        language: "multi-language",
        model: "nova-3",
        sampleRate: "16kHz",
        diarization: "enabled",
      });

      // ===== DEEPGRAM EVENT HANDLERS =====
      dgConnection.on(LiveTranscriptionEvents.Open, () => {
        log.success("Deepgram STT connection opened and ready");

        /**
         * CORE STT→TRANSLATION→TTS PIPELINE
         *
         * PIPELINE STEP 2: Process Speech-to-Text Results
         * Triggered when Deepgram completes transcription
         */
        dgConnection.on(LiveTranscriptionEvents.Transcript, async (data) => {
          try {
            // Extract transcript from Deepgram response
            const transcript = data.channel.alternatives[0].transcript;

            // Only process non-empty final transcripts
            if (transcript && transcript.trim() && data.is_final) {
              log.pipeline("2", "Speech-to-Text completed", {
                transcript: transcript,
                isFinal: data.is_final,
              });

              // ===== SPEAKER DIARIZATION =====
              // Group words by speaker for better translation context
              const words = data.channel.alternatives[0].words;
              const message_to_send = {};

              // Combine words by speaker to form complete sentences
              words.forEach(function each(word) {
                if (word.speaker in message_to_send) {
                  message_to_send[word.speaker] += " " + word.punctuated_word;
                } else {
                  message_to_send[word.speaker] = word.punctuated_word;
                }
              });

              log.info("Speaker diarization completed", {
                speakers: Object.keys(message_to_send),
                totalSpeakers: Object.keys(message_to_send).length,
              });

              // ===== PROCESS EACH SPEAKER'S SPEECH =====
              for (const [speaker, text] of Object.entries(message_to_send)) {
                /**
                 * PIPELINE STEP 3: Language Translation
                 * Translate speech to English using Google Translate
                 */
                const translationResult = await translate(text, { to: "en" });
                message_to_send[speaker] = translationResult.text;

                log.pipeline(
                  "3",
                  `Translation completed for Speaker ${speaker}`,
                  {
                    originalText: text,
                    detectedLanguage: translationResult.from.language.iso,
                    translatedText: translationResult.text,
                  }
                );

                /**
                 * PIPELINE STEP 4: Text-to-Speech Generation
                 * Only generate TTS if original language was not English
                 */
                if (!translationResult.from.language.iso.includes("en")) {
                  log.pipeline("4", `Generating TTS for non-English speech`, {
                    speaker,
                    originalLanguage: translationResult.from.language.iso,
                    textToSynthesize: translationResult.text,
                  });

                  // Generate English TTS audio from translated text
                  const response = await deepgram.speak.request(
                    { text: translationResult.text },
                    {
                      model: "aura-2-thalia-en", // High-quality English voice
                      encoding: "linear16", // PCM format for Audio Connector
                      container: "wav", // WAV container
                      sample_rate: 16000, // Match video session sample rate
                    }
                  );

                  // Get the audio stream from Deepgram TTS
                  const stream = await response.getStream();

                  /**
                   * PIPELINE STEP 5: Audio Playback
                   * Send TTS audio back to video session via Audio Connector
                   */
                  await playback_to_websocket(websocket, stream);
                } else {
                  log.info(
                    `Skipping TTS for Speaker ${speaker} - already English`
                  );
                }
              }

              // ===== SEND TRANSCRIPTION TO CLIENTS =====
              const transcriptionUpdate = {
                sessionid: websocket.id,
                messages: message_to_send,
                timestamp: new Date().toISOString(),
              };

              log.info("Sending transcription update to clients", {
                sessionId: websocket.id,
                messageCount: Object.keys(message_to_send).length,
              });

              // Send transcription updates to web clients for UI display
              wsServer.clients.forEach(function each(client) {
                if (client.id === "client_" + websocket.id) {
                  client.send(JSON.stringify(transcriptionUpdate));
                }
              });
            }
          } catch (error) {
            log.error("Pipeline processing failed", error);
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
      websocket.id = clientId;

      log.info("Client identified for transcription updates", {
        clientId: clientId,
        connectionType: "Web Client",
      });
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
        dgConnection.send(data); // Forward audio to Deepgram STT
        // Only log audio data periodically to avoid spam
        if (Math.random() < 0.001) {
          // Log ~0.1% of audio packets
          log.audio(`Audio data forwarded to Deepgram STT`, data.length);
        }
      }
    }
  });

  /**
   * CONNECTION CLEANUP
   * Properly close Deepgram connections when WebSocket disconnects
   */
  websocket.on("close", function close(code, reason) {
    log.warning("WebSocket connection closed", {
      connectionId: websocket.id,
      code: code,
      reason: reason?.toString(),
    });

    if (dgConnection != null) {
      dgConnection.requestClose(); // Clean up Deepgram connection
      log.info("Deepgram connection cleaned up");
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
 * Enable WebSocket upgrade support
 * This allows the HTTP server to handle WebSocket connections
 * Required for Audio Connector and client WebSocket communication
 */
server.on("upgrade", (request, socket, head) => {
  wsServer.handleUpgrade(request, socket, head, (socket) => {
    wsServer.emit("connection", socket, request);
  });
});

// Graceful shutdown handling
process.on("SIGTERM", () => {
  log.warning("SIGTERM received, starting graceful shutdown");
  server.close(() => {
    log.info("HTTP server closed");
    process.exit(0);
  });
});

process.on("SIGINT", () => {
  log.warning("SIGINT received, starting graceful shutdown");
  server.close(() => {
    log.info("HTTP server closed");
    process.exit(0);
  });
});

/**
 * COMPLETE PIPELINE SUMMARY:
 *
 * 1. AUDIO CAPTURE: Vonage Audio Connector captures audio from video session
 * 2. STT: Audio → Deepgram STT → Text (with speaker diarization)
 * 3. TRANSLATION: Text → Google Translate → English text
 * 4. TTS: English text → Deepgram TTS → Audio stream
 * 5. PLAYBACK: Audio stream → Audio Connector → Video session
 *
 * SUPPORTED LANGUAGES:
 * Auto-detected: English, Spanish, French, German, Hindi, Russian,
 * Portuguese, Japanese, Italian, Dutch (and more)
 *
 * REAL-TIME FEATURES:
 * - Speaker diarization (multiple speakers)
 * - Language auto-detection
 * - Live transcription display
 * - Bidirectional audio (both STT and TTS)
 */
