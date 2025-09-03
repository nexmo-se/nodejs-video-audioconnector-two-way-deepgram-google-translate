const fs = require("fs");
const { exec } = require("child_process");
const path = require("path");
const ngrok = require("ngrok");

// Path to the .env file
const envPath = path.join(__dirname, ".env");

// Function to update the .env file
function updateEnvFile(key, value) {
  let envContent = fs.readFileSync(envPath, "utf8");
  const regex = new RegExp(`^${key}=.*`, "m");

  if (regex.test(envContent)) {
    envContent = envContent.replace(regex, `${key}=${value}`);
  } else {
    envContent += `\n${key}=${value}`;
  }

  fs.writeFileSync(envPath, envContent, "utf8");
  console.log(`Updated ${key} in .env file.`);
}

// Start ngrok and update the .env file
(async function () {
  try {
    console.log("Starting ngrok...");
    const url = await ngrok.connect(3002);
    console.log(`ngrok URL: ${url}`);

    // Ensure the URL uses the WebSocket protocol
    const websocketUrl = url.replace("https://", "wss://");
    console.log(`WebSocket URL: ${websocketUrl}`);

    // Update the .env file
    updateEnvFile("WEBSOCKET_SERVER_URI", websocketUrl);

    // Start the Node.js server
    console.log("Starting Node.js server...");
    const serverProcess = exec("nodemon video-chat-server.js");

    serverProcess.stdout.on("data", (data) => {
      console.log(`[Server]: ${data}`);
    });

    serverProcess.stderr.on("data", (data) => {
      console.error(`[Server Error]: ${data}`);
    });

    serverProcess.on("close", (code) => {
      console.log(`Server process exited with code ${code}`);
    });
  } catch (error) {
    console.error(`Error with ngrok: ${error.message}`);
  }
})();
