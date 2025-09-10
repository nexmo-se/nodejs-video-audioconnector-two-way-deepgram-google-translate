// Video Chat Client - Handles video session and audio connector streams
var apiKey = "";
var sessionId = "";
var token = "";
var session = "";
var stream_name = "video";

// Audio Connector stream name for translated audio playback
const AUDIO_CONNECTOR_STREAM_NAME = "translated_audio_connector";

// Global variables to expose session and publisher for connectionId access
window.currentSession = null;
window.currentPublisher = null;

// Connect to a video session with proper stream handling
window.startSession = (sessionId, token, apiKey) => {
  const queryString = window.location.search;
  console.log(queryString);
  const urlParams = new URLSearchParams(queryString);
  if (urlParams.has("stream_name")) {
    stream_name = urlParams.get("stream_name");
  }

  var deferred = new $.Deferred();

  // Initialize publisher for this client's video/audio
  var publisher = OT.initPublisher("publisher", {
    insertMode: "append",
    width: "100%",
    height: "100%",
    resolution: "640x480",
    name: stream_name,
  });

  // Log device changes for debugging
  publisher.on("videoInputDeviceChanged", (device) => {
    console.log("Video device changed:", device.label);
  });

  publisher.on("audioInputDeviceChanged", (device) => {
    console.log("Audio device changed:", device.label);
  });

  // Initialize and connect to Vonage session
  session = OT.initSession(apiKey, sessionId);

  // Store session globally for connectionId access
  window.currentSession = session;

  session.connect(token, async function (err) {
    if (err) {
      console.log("Session connection error:", err);
      deferred.resolve(false);
    } else {
      // Publish this client's stream
      session.publish(publisher);

      // Store publisher globally for connectionId access
      window.currentPublisher = publisher;

      console.log("Published local stream successfully");
      console.log("Connection ID:", session.connection.connectionId);

      deferred.resolve(true);

      // Handle new streams joining the session
      session.on("streamCreated", function (event) {
        const stream = event.stream;
        console.log("New stream detected:", {
          name: stream.name,
          hasAudio: stream.hasAudio,
          hasVideo: stream.hasVideo,
          videoType: stream.videoType,
          streamId: stream.streamId,
          connection: stream.connection?.connectionId,
          creationTime: stream.creationTime,
        });

        // ULTRA-CONSERVATIVE GLOBAL CHECK: If user has active translation,
        // be extremely cautious about subscribing to audio-only streams
        if (window.deepgram_in_use && stream.hasAudio && !stream.hasVideo) {
          console.log(
            "⚠️ GLOBAL SAFETY CHECK: User has active translation, examining audio-only stream carefully"
          );
        }

        // CORRECTED APPROACH: Use connectionData from token to identify Audio Connector streams
        // The server sets connectionData when generating the Audio Connector token
        let streamMeta = {};
        let tokenDataAvailable = false;
        try {
          if (stream.connection.data) {
            streamMeta = JSON.parse(stream.connection.data);
            tokenDataAvailable = true;
            console.log("✅ Token data successfully parsed:", streamMeta);
          } else {
            console.warn("⚠️ No connection data available for stream");
          }
        } catch (e) {
          console.warn("❌ Could not parse stream connection data:", e);
          streamMeta = {};
        }

        const isAudioConnectorByToken = streamMeta.type === "audio_connector";

        // Enhanced fallback detection for Audio Connector streams
        // Audio Connector streams have: hasAudio=true, hasVideo=false, empty/missing name
        const isAudioConnectorByProps =
          stream.hasAudio === true &&
          stream.hasVideo === false &&
          (!stream.name || stream.name.trim() === "") &&
          stream.videoType === undefined; // More specific check

        // Prefer token-based detection, fallback to properties only if token data unavailable
        const isAudioConnector = tokenDataAvailable
          ? isAudioConnectorByToken
          : isAudioConnectorByProps;

        const audioConnectorOwner = streamMeta.userId;
        const currentUserId = session.connection.connectionId;

        // Safe ownership check - only true if we have valid token data AND ownership matches
        const isOwnAudioConnector =
          tokenDataAvailable &&
          audioConnectorOwner &&
          audioConnectorOwner === currentUserId;

        console.log("🔍 Audio Connector detection and subscription check:", {
          streamConnectionId: stream.connection.connectionId,
          sessionConnectionId: session.connection.connectionId,
          streamConnectionData: stream.connection.data,
          tokenDataAvailable: tokenDataAvailable,
          parsedMeta: streamMeta,
          isAudioConnectorByToken: isAudioConnectorByToken,
          isAudioConnectorByProps: isAudioConnectorByProps,
          isAudioConnector: isAudioConnector,
          audioConnectorOwner: audioConnectorOwner,
          currentUserId: currentUserId,
          isOwnAudioConnector: isOwnAudioConnector,
          "window.deepgram_in_use": window.deepgram_in_use,
          decision: (() => {
            if (!isAudioConnector) {
              return "Not an Audio Connector - will handle as regular participant stream";
            } else if (!tokenDataAvailable && isAudioConnectorByProps) {
              return "Audio Connector detected by properties (no token data) - will subscribe as fallback";
            } else if (isOwnAudioConnector) {
              return "OWN Audio Connector - SUBSCRIBE for translated audio";
            } else if (window.deepgram_in_use) {
              return "OTHER user's Audio Connector + own translation active - SKIP to prevent feedback";
            } else {
              return "OTHER user's Audio Connector + no own translation - SUBSCRIBE to receive translations";
            }
          })(),
        });

        // Handle Audio Connector streams
        if (isAudioConnector) {
          // CRITICAL FIX: If we can't determine ownership reliably, be ultra-conservative
          if (!tokenDataAvailable || !audioConnectorOwner) {
            console.log(
              "❌ ULTRA-CONSERVATIVE: Skipping Audio Connector - no reliable ownership data available"
            );
            return; // Skip ALL Audio Connectors when ownership is uncertain
          }

          // ARCHITECTURE CLARIFICATION:
          // - Each user subscribes ONLY to their OWN Audio Connector
          // - Their own Audio Connector receives TTS audio FROM other users' speech
          // - We do NOT subscribe to other users' Audio Connectors
          // - Server routes TTS audio to the target user's Audio Connector
          if (!isOwnAudioConnector) {
            console.log(
              "🏗️ AUDIO ARCHITECTURE: Skipping OTHER user's Audio Connector - we only subscribe to our own",
              {
                ourUserId: currentUserId,
                streamOwner: audioConnectorOwner,
                isOwnStream: isOwnAudioConnector,
                reason:
                  "Each user only subscribes to their own Audio Connector to receive translations",
              }
            );
            return;
          }

          // FINAL SAFETY: Even for own Audio Connector, double-check the ownership
          if (isOwnAudioConnector) {
            const doubleCheck = audioConnectorOwner === currentUserId;
            if (!doubleCheck) {
              console.log(
                "❌ OWNERSHIP MISMATCH: Expected own Audio Connector but IDs don't match exactly",
                {
                  audioConnectorOwner,
                  currentUserId,
                  match: doubleCheck,
                }
              );
              return;
            }
          }

          console.log(
            `✅ SUBSCRIBING TO OWN AUDIO CONNECTOR: Receive translations from other users`,
            {
              isOwnAudioConnector,
              tokenDataAvailable,
              audioConnectorOwner,
              currentUserId,
              deepgramInUse: window.deepgram_in_use,
              streamId: stream.streamId,
              streamName: stream.name,
              purpose:
                "Our Audio Connector receives TTS audio when other users speak in different languages",
            }
          );

          // Create a completely hidden container for audio-only subscription
          const hiddenContainer = document.createElement("div");
          hiddenContainer.className = "audio-connector-hidden";
          hiddenContainer.id = `audio-connector-${stream.streamId}`; // Add ID for easier cleanup
          document.body.appendChild(hiddenContainer);

          // Subscribe to Audio Connector for translated audio playback
          const subscriber = session.subscribe(
            stream,
            hiddenContainer,
            {
              subscribeToVideo: false,
              subscribeToAudio: true,
              insertMode: "replace",
              width: 1,
              height: 1,
            },
            (err) => {
              if (err) {
                console.error("Audio Connector subscribe error:", err);
              } else {
                console.log(
                  `✅ OWN Audio Connector subscribed - ready to receive translations: ${stream.name} (ID: ${subscriber.id})`
                );
              }
            }
          );

          // Handle cleanup when destroyed
          subscriber.on("destroyed", function (event) {
            console.log("Audio Connector stream destroyed:", stream.name);
            // Remove the hidden container
            if (hiddenContainer.parentNode) {
              hiddenContainer.parentNode.removeChild(hiddenContainer);
            }
          });

          return; // Don't fall through to normal subscriber logic
        }

        // Regular participant stream - subscribe to both audio and video with UI rendering
        console.log(
          "Regular participant stream detected - subscribing to audio and video"
        );

        const subscriber = session.subscribe(
          stream,
          "subscriber",
          {
            insertMode: "append",
            width: "100%",
            height: "100%",
            resolution: "640x480",
            subscribeToAudio: true,
            subscribeToVideo: true,
          },
          (err) => {
            if (err) {
              console.error("Participant subscribe error:", err);
            } else {
              console.log(
                `Subscribed to participant stream: ${stream.name} (ID: ${subscriber.id})`
              );
            }
          }
        );

        // Handle stream cleanup when destroyed
        subscriber.on("destroyed", function (event) {
          console.log("Participant stream destroyed:", stream.name);
        });
      });

      // Handle streams leaving the session
      session.on("streamDestroyed", function (event) {
        console.log(
          "Stream left session:",
          event.stream?.name || "Unknown stream"
        );
      });

      // Handle other connections joining
      session.on("connectionCreated", function (event) {
        console.log(
          "New connection joined session:",
          event.connection.connectionId
        );
      });

      // Handle other connections leaving
      session.on("connectionDestroyed", function (event) {
        console.log("Connection left session:", event.connection.connectionId);
      });
    }
  });

  return deferred.promise();
};
