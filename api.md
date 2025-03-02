# DumbKan API Documentation

This document provides information about all available GET requests in the DumbKan API.

## Table of Contents

- [Authentication](#authentication)
  - [Get PIN Length](#get-pin-length)
  - [Get Login Page](#get-login-page)
  - [API Authorization](#api-authorization)
- [Boards](#boards)
  - [Get All Boards](#get-all-boards)
- [Tasks](#tasks)

---

## Authentication

### Get PIN Length

Retrieves the length of the configured PIN for client-side validation.

**Endpoint:** `GET /api/pin-length`

**Description:** Returns the length of the configured PIN to assist the client in setting up the PIN input UI. If no PIN is configured, returns 0.

**Response:**
```json
{
  "length": 4
}
```

### Get Login Page

Retrieves the login page HTML.

**Endpoint:** `GET /login`

**Description:** Returns the login page HTML with site title placeholders replaced with the configured site title.

**Response:** HTML content

### API Authorization

API endpoints can be authorized using two methods:

1. **Session-based authentication:** Using browser cookies after PIN entry
2. **API Key authentication:** Using the `X-API-Key` header with the `DUMB_SECRET` value

**Example API Key Usage:**
```bash
curl -H "X-API-Key: your_dumb_secret_value" https://your-dumbkan-instance/api/boards
```

**Description:** External services can use the API Key method to make authorized API calls without requiring session authentication.

---

## Boards

### Get All Boards

Retrieves all boards, sections, tasks, and the active board.

**Endpoint:** `GET /api/boards`

**Description:** Returns all data including boards, sections, tasks, and the active board ID. This is the main endpoint to load the application state.

**Authentication:** Required

**Response:**
```json
{
  "boards": {
    "board_1234": {
      "id": "board_1234",
      "name": "My First Board",
      "sectionOrder": ["section_5678", "section_9012", "section_3456"]
    },
    "board_5678": {
      "id": "board_5678",
      "name": "Project Tasks",
      "sectionOrder": ["section_7890", "section_1234", "section_5678"]
    }
  },
  "sections": {
    "section_5678": {
      "id": "section_5678",
      "name": "To Do",
      "boardId": "board_1234",
      "taskIds": ["task_1234", "task_5678"]
    },
    "section_9012": {
      "id": "section_9012",
      "name": "Doing",
      "boardId": "board_1234",
      "taskIds": ["task_9012"]
    },
    "section_3456": {
      "id": "section_3456",
      "name": "Done",
      "boardId": "board_1234",
      "taskIds": []
    },
    "section_7890": {
      "id": "section_7890",
      "name": "Backlog",
      "boardId": "board_5678",
      "taskIds": ["task_3456"]
    },
    "section_1234": {
      "id": "section_1234",
      "name": "In Progress",
      "boardId": "board_5678",
      "taskIds": []
    },
    "section_5678": {
      "id": "section_5678",
      "name": "Completed",
      "boardId": "board_5678",
      "taskIds": ["task_7890"]
    }
  },
  "tasks": {
    "task_1234": {
      "id": "task_1234",
      "title": "Complete documentation",
      "description": "Write API documentation for the project",
      "createdAt": "2023-02-15T08:30:00.000Z",
      "updatedAt": "2023-02-15T14:45:00.000Z",
      "sectionId": "section_5678",
      "boardId": "board_1234",
      "priority": "high",
      "status": "active",
      "tags": ["documentation", "important"],
      "assignee": null,
      "dueDate": "2023-02-20T23:59:59.000Z",
      "startDate": "2023-02-15T08:00:00.000Z"
    },
    "task_5678": {
      "id": "task_5678",
      "title": "Review pull requests",
      "description": "Review pending pull requests for the project",
      "createdAt": "2023-02-16T09:15:00.000Z",
      "updatedAt": "2023-02-16T09:15:00.000Z",
      "sectionId": "section_5678",
      "boardId": "board_1234",
      "priority": "medium",
      "status": "active",
      "tags": ["code-review"],
      "assignee": null,
      "dueDate": null,
      "startDate": null
    },
    "task_9012": {
      "id": "task_9012",
      "title": "Fix authentication bug",
      "description": "Address the authentication issue reported in ticket #123",
      "createdAt": "2023-02-14T13:45:00.000Z",
      "updatedAt": "2023-02-15T10:30:00.000Z",
      "sectionId": "section_9012",
      "boardId": "board_1234",
      "priority": "urgent",
      "status": "active",
      "tags": ["bug", "security"],
      "assignee": null,
      "dueDate": "2023-02-17T23:59:59.000Z",
      "startDate": "2023-02-14T13:00:00.000Z"
    },
    "task_3456": {
      "id": "task_3456",
      "title": "Plan next sprint",
      "description": "Prepare tasks and goals for the upcoming sprint",
      "createdAt": "2023-02-13T10:00:00.000Z",
      "updatedAt": "2023-02-13T10:00:00.000Z",
      "sectionId": "section_7890",
      "boardId": "board_5678",
      "priority": "high",
      "status": "active",
      "tags": ["planning", "management"],
      "assignee": null,
      "dueDate": "2023-02-19T23:59:59.000Z",
      "startDate": null
    },
    "task_7890": {
      "id": "task_7890",
      "title": "Update dependencies",
      "description": "Update project dependencies to the latest versions",
      "createdAt": "2023-02-10T11:30:00.000Z",
      "updatedAt": "2023-02-12T16:20:00.000Z",
      "sectionId": "section_5678",
      "boardId": "board_5678",
      "priority": "low",
      "status": "active",
      "tags": ["maintenance"],
      "assignee": null,
      "dueDate": null,
      "startDate": null
    }
  },
  "activeBoard": "board_1234"
}
```

---

## Tasks

There are no dedicated GET endpoints for individual tasks. Tasks are retrieved as part of the board data from the `/api/boards` endpoint.

---

## Note

The API uses a simple data model where:

1. **Boards** contain multiple **Sections** (columns)
2. **Sections** contain multiple **Tasks**
3. All data is returned in a single object when fetching boards

Authentication is required for all API endpoints except the login-related ones.

When errors occur, the API will return a JSON object with an `error` property containing a description of the error:

```json
{
  "error": "Error message here"
}
``` 