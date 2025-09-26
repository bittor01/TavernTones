# The Oracle API Server

The Oracle is a backend API server designed to provide an interface to 5etools D&D data for integration with an AnythingLLM agent. It allows for searching game data and generating encounters, traps, and characters through a conversational API.

## Setup and Installation

1.  **Install Dependencies:**
    Navigate to the project root directory and run the following command to install the necessary Node.js packages:
    ```bash
    npm install
    ```

2.  **Using Your Own Data (Optional):**
    This server uses a small set of mock data by default. To use your own comprehensive 5etools data, you must configure the `DATA_PATH` environment variable and mount your data directories. See the "Configuration for Custom Data" section for detailed instructions.

3.  **Start the Server:**
    To run the server, use the following command:
    ```bash
    npm start
    ```
    The server will start on port 3000 by default.

## Running with Docker Compose

For a more consistent and isolated environment, you can use Docker Compose to run the application.

1.  **Ensure Docker is installed** and running on your system.
2.  From the project root, run the following command:
    ```bash
    docker-compose up --build
    ```
The `--build` flag is only necessary the first time you run it, or after making changes to the source code. The server will be available at `http://localhost:3000`.

## Testing the Server

The project includes a comprehensive test suite using Jest. To run the tests, use the following command:

```bash
npm test
```

## General Configuration

### Port
You can change the default port by setting the `PORT` environment variable:
`export PORT=8080`

### API Key (Optional)
The API can be secured with an API key. To enable this, set the `API_KEY` environment variable.
`export API_KEY="your-secret-api-key"`

If this variable is set, all requests to the API must include a header `X-API-KEY` with the matching key value. If the variable is not set, no authentication is required.

### Session Reset
You can force a session to be cleared by including the header `resetSession: true` in your request. This is useful if a conversational flow gets stuck.

## API Endpoints

All endpoints are `POST` requests and live under the `/api/oracle/` path.

---

### Search Endpoints (Stateless)

The search endpoints have been designed to be stateless and follow a simple summary/details pattern.

#### 1. Search for an Item
First, make a request to a search endpoint with a `query`. The server will return an array of summarized objects that match the query.

*   **Request Body:**
    ```json
    {
      "query": "fireball"
    }
    ```
*   **Success Response (200 OK):**
    An array of items with identifying information, but without the full descriptive text.
    ```json
    [
      {
        "name": "Fireball",
        "source": "PHB",
        "level": 3,
        "school": "V"
      }
    ]
    ```

#### 2. Get Full Details
Next, use the `category`, `name`, and `source` from a summary object to call the `/details` endpoint.

*   **Request Body:**
    ```json
    {
      "category": "spells",
      "name": "Fireball",
      "source": "PHB"
    }
    ```
*   **Success Response (200 OK):**
    The full JSON object for the requested item, including all its descriptive text.

**Available Search Endpoints:**
*   `/api/oracle/spell`
*   `/api/oracle/item`
*   `/api/oracle/monster`
*   `/api/oracle/feat`
*   `/api/oracle/race`
*   `/api/oracle/background`
*   `/api/oracle/5e` (Searches all categories by name)
*   `/api/oracle/deep` (Searches all categories by name and content)
*   `/api/oracle/details` (Used to get full details for any item)

---

### Generator Endpoints

#### Stateless Generators
These generators perform their function in a single request-response cycle.

*   **`/api/oracle/vehicle-encounter`**
    *   **Request Body:** `{"tag": "water", "style": "balanced", "totalHp": 500, "numVehicles": 3}`
    *   **Response:** A generated encounter object with a list of vehicles.
*   **`/api/oracle/generate-hoard`**
    *   **Request Body:** `{"numItems": "1d6", "lootMultiplier": 1.5}`
    *   **Response:** An object containing the generated items.
*   **`/api/oracle/generate-shop`**
    *   **Request Body:** `{"numItems": 10, "priceMultiplier": 1.2}`
    *   **Response:** An object containing the generated items, each with a `price`.

#### Multi-Step Generators
These endpoints use a session-based, conversational flow. To ensure robustness against network errors, they use a `step` tracking system. **You must always send back the `step` you received from the previous response.**

**General Flow:**
1.  **Initial Request:** Send a request with a client-generated `sessionId`.
    ```json
    { "sessionId": "your-unique-session-id" }
    ```
2.  **Response:** The API will respond with a question and the current `step`.
    ```json
    {
        "step": "awaiting_tier",
        "message": "Please choose a tier for the trap:",
        "results": "1. Tier 1...\n2. Tier 2..."
    }
    ```
3.  **Subsequent Requests:** You respond with your `choice` and the `step` you are responding to.
    ```json
    {
        "sessionId": "your-unique-session-id",
        "step": "awaiting_tier",
        "choice": 1
    }
    ```
This continues until the generation is complete, at which point the API will return the final generated object.

**Available Multi-Step Endpoints:**
*   **`/api/oracle/generate-trap`**: Guides you through generating a trap by tier, type, and threat.
*   **`/api/oracle/generate-character`**: Guides you through creating a player character.
*   **`/api/oracle/generate-npc`**: Guides you through creating an NPC, with options for a simple concept or a full statblock suggestion.
*   **`/api/oracle/encounter`**: Guides you through generating a monster encounter.
    *   **Initial Request:**
        ```json
        {
          "sessionId": "your-enc-session-id",
          "creatureName": "goblin",
          "partyLevel": 1,
          "partySize": 4,
          "difficulty": "moderate"
        }
        ```
    *   **Note:** If multiple creatures match the `creatureName`, the API will enter a conversational flow to ask for clarification. Otherwise, it will return the encounter directly.