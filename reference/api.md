api server is at 192.168.0.165:78


## API Endpoints

All endpoints are `POST` requests and live under the `/api/oracle/` path unless otherwise specified.

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

#### V2 Generator Endpoints (Recommended)
These endpoints support a modern, form-based UI flow for generating NPCs.

*   **`GET /api/oracle/v2/generate-npc/options`**: Fetches all initial data for a form (species, classes, backgrounds, CRs).
*   **`GET /api/oracle/v2/generate-npc/lineages/:speciesName`**: Fetches available lineages (subraces) for a given species.
*   **`GET /api/oracle/v2/generate-npc/subclasses/:className`**: Fetches available subclasses for a given class.
*   **`POST /api/oracle/v2/generate-npc-statblock`**: Generates `easy`, `medium`, and `hard` statblock suggestions for a given CR.
    *   **Request Body:** `{"cr": "5"}`
*   **`POST /api/oracle/v2/generate-npc/create`**: Creates the final NPC based on form selections. Any omitted fields are randomized.
    *   **Request Body:** `{"mode": "npc", "species": "Elf", "class": "Fighter", "cr": "5"}`

#### Stateless Generators
These generators perform their function in a single request-response cycle.

*   **`/api/oracle/vehicle-encounter`**
    *   **Request Body:** `{"tag": "water", "style": "balanced", "totalHp": 500, "numVehicles": 3}`
*   **`/api/oracle/generate-hoard`**
    *   **Request Body:** `{"numItems": "1d6", "lootMultiplier": 1.5}`
*   **`/api/oracle/generate-shop`**
    *   **Request Body:** `{"numItems": 10, "priceMultiplier": 1.2}`

#### Legacy Multi-Step Generators
These endpoints use a session-based, conversational flow. **You must always send back the `step` you received from the previous response.**

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
This continues until the generation is complete.

**Available Endpoints:**
*   `/api/oracle/generate-trap`**: Guides you through generating a trap by tier, type, and threat.
*   `/api/oracle/generate-hazard`**: A simplified generator for creating a hazard by tier and threat.
*   `/api/oracle/generate-character`**: Guides you through creating a player character.
*   `/api/oracle/generate-npc`**: **(DEPRECATED)** Superseded by the V2 endpoints.
*   `/api/oracle/encounter`**: Guides you through generating a monster encounter.
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