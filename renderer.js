document.addEventListener('DOMContentLoaded', () => {
    let isPlaying = false;
    const playPauseButton = document.getElementById('playPauseButton');
    const selectFileButton = document.getElementById('selectFileButton');
    const selectedFileLabel = document.getElementById('selectedFileLabel');
    const exitButton = document.getElementById('exitButton');
    const logArea = document.getElementById('logArea'); // Logging area
    const maxLogEntries = 25;

    let selectedFilePath = null;

    // Function to log messages to the log area
    function logMessage(message) {
        const logEntry = document.createElement('div');
        logEntry.textContent = `> ${message}`;
        logArea.appendChild(logEntry);
        if (logArea.children.length > maxLogEntries) {
            logArea.removeChild(logArea.firstChild);
        }
        logArea.scrollTop = logArea.scrollHeight; // Auto-scroll to bottom
    }

    selectFileButton.addEventListener('click', () => {
        window.electron.ipcRenderer.invoke('open-file-dialog').then(filePath => {
            if (filePath) {
                selectedFilePath = filePath; // Store the selected file path
                selectedFileLabel.textContent = filePath; // Display selected file path
                playPauseButton.disabled = false; // Enable play/pause button
                logMessage(`Selected file: ${filePath}`); // Log file selection
            }
        });
    });

    playPauseButton.addEventListener('click', () => {
        if (isPlaying) {
            window.electron.ipcRenderer.send('pause-music'); // Use window.electron for IPC
            playPauseButton.textContent = 'Play';
        } else {
            if (selectedFilePath) {
                window.electron.ipcRenderer.send('play-music', selectedFilePath); // Send the selected file path
                playPauseButton.textContent = 'Pause';
            } else {
                logMessage('No file selected'); // Log error if no file selected
            }
        }
        isPlaying = !isPlaying;
    });

    exitButton.addEventListener('click', () => {
        logMessage('Exiting now.');
        window.electron.ipcRenderer.send('exit-app'); // Use window.electron for IPC
    });

    // Listen for log messages from the main process
    window.electron.ipcRenderer.on('log-message', (event, message) => {
        logMessage(message);
    });
});
