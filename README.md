# DumbKan - Simple Kanban Board

A lightweight, mobile-friendly Kanban board application for managing tasks and projects. Built with vanilla JavaScript and Node.js.

## Features

### 🎯 Task Management
- Create, edit, and delete tasks easily
- Double-click (desktop) or double-tap (mobile) to edit tasks
- Drag and drop tasks between columns
- Smooth animations and visual feedback during interactions

### 📱 Mobile-Optimized
- Responsive design that works on all devices
- Touch-friendly interface
- Double-tap to edit tasks on mobile
- Easy task movement with touch gestures

### 📋 Board Management
- Multiple boards support (Work, Personal, etc.)
- Create and delete boards
- Switch between boards instantly
- Persistent board state

### 📊 Column Management
- Add new columns for custom workflows
- Edit column names inline
- Remove columns with confirmation
- Drag tasks between columns

### 🎨 Theme Support
- Light and dark mode
- System theme detection
- Smooth theme transitions
- Theme persistence across sessions

### 💾 Data Persistence
- Automatic saving of changes
- Persistent across page refreshes
- JSON-based storage
- No database required

## Quick Start

### Running Locally
```bash
npm install
npm start
```

### Using Docker
```bash
# Build the image
docker build -t dumbkan .

# Run the container
docker run -p 3000:3000 -v $(pwd)/data:/app/data --env-file .env dumbkan
```

## Environment Variables

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| PORT | Port for the server to listen on | 3000 | No |
| DUMBKAN_PIN | PIN protection (4-10 digits) | - | No |

## PIN Protection
When `DUMBKAN_PIN` is set, the app requires PIN verification before accessing or modifying boards. The PIN must be 4-10 digits long.

## Data Persistence
Task data is stored in `data/tasks.json`. When using Docker, mount this directory as a volume to persist data between container restarts.

## Getting Started

1. Clone the repository:
   ```bash
   git clone https://github.com/abiteman/dumbkan.git
   cd dumbkan
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Start the server:
   ```bash
   npm start
   ```

4. Open your browser and navigate to:
   ```
   http://localhost:3000
   ```

## Usage Guide

### Managing Tasks
- Click "Add Task" to create a new task
- Double-click (or double-tap on mobile) to edit a task
- Drag and drop tasks between columns
- Delete tasks using the delete button in the edit modal

### Working with Boards
- Click the board name to open the board selector
- Use "Manage Boards" to add or remove boards
- Each board maintains its own columns and tasks

### Customizing Columns
- Click "Add Column" to create a new column
- Click a column name to edit it
- Use the remove icon (×) to delete a column

### Theme Switching
- Click the sun/moon icon to toggle between light and dark modes
- Theme automatically syncs with system preferences
- Theme choice persists across sessions

## Technical Details

- Built with vanilla JavaScript - no frameworks
- Node.js backend with Express
- File-based JSON storage
- Responsive CSS with modern features
- Mobile-first design approach

## Contributing

Feel free to submit issues and enhancement requests! 