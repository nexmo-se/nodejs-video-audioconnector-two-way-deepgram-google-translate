// Video Chat Client - Handles video session and audio connector streams
var apiKey = "";
var sessionId = "";
var token = "";
var session = "";
var stream_name = "video";

// Audio Connector stream name for translated audio playback
const AUDIO_CONNECTOR_STREAM_NAME = "translated_audio_connector";

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
  session.connect(token, async function (err) {
    if (err) {
      console.log("Session connection error:", err);
      deferred.resolve(false);
    } else {
      // Publish this client's stream
      session.publish(publisher);
      console.log("Published local stream successfully");

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

        // Audio Connector detection based on stream properties
        // Audio Connector streams have: hasAudio=true, hasVideo=false, empty/missing name
        const isAudioConnector =
          stream.hasAudio === true &&
          stream.hasVideo === false &&
          (!stream.name || stream.name.trim() === "");

        console.log("Audio Connector check:", {
          isAudioConnector: isAudioConnector,
          name: `"${stream.name}"`,
          hasAudio: stream.hasAudio,
          hasVideo: stream.hasVideo,
          videoType: stream.videoType,
        });

        if (isAudioConnector) {
          // Audio Connector stream - subscribe for audio but hide completely
          console.log(
            "Audio Connector stream detected - subscribing for translated audio (hidden)"
          );

          // Create a completely hidden container for audio-only subscription
          const hiddenContainer = document.createElement("div");
          hiddenContainer.style.cssText = `
            position: absolute !important;
            left: -10000px !important;
            top: -10000px !important;
            width: 1px !important;
            height: 1px !important;
            overflow: hidden !important;
            opacity: 0 !important;
            visibility: hidden !important;
            pointer-events: none !important;
          `;
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
                  `Audio Connector subscribed (hidden audio): ${stream.name} (ID: ${subscriber.id})`
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
    }
  });

  return deferred.promise();
};
// Session initialization complete
