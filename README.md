# DumbKan - Simple Kanban Board

A lightweight, mobile-friendly Kanban board application for managing tasks and projects. Built with vanilla JavaScript and Node.js.

![dumbkan](https://github.com/user-attachments/assets/80d32ace-a8b9-476b-a235-df857c1d0c36)


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
- Remove columns with confirmation (fixing)
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

## Environment Variables

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| PORT | Port for the server to listen on | 3000 | No |
| DUMBKAN_PIN | PIN protection (4-10 digits) | - | No |

## PIN Protection
When `DUMBKAN_PIN` is set, the app requires PIN verification before accessing or modifying boards. The PIN must be 4-10 digits long.

## Data Persistence
Task data is stored in `/app/data/tasks.json`. When using Docker, mount this directory as a volume to persist data between container restarts.


## Easypanel

DumbKan has a one-click deployment template on [Easypanel](https://easypanel.io), a self-hosted Docker deployment platform.

[![Deploy on Easypanel][easypanel-btn]][easypanel-deploy]

[easypanel-btn]: https://easypanel.io/img/deploy-on-easypanel-40.svg
[easypanel-deploy]: https://easypanel.io/templates/dumbkan

## Getting Started

### Option 1: Docker (Recommended)
1. Pull the image:
   ```bash
   docker pull dumbwareio/dumbkan:latest
   ```

2. Run the container:
   ```bash
   docker run -d -p 3000:3000 -v $(pwd)/data:/app/data --env-file .env dumbwareio/dumbkan:latest
   ```

3. Open your browser and navigate to:
   ```
   http://localhost:3000
   ```

### Option 2: Local Installation
1. Clone the repository:
   ```bash
   git clone https://github.com/dumbwareio/dumbkan.git
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

## Support the Project

<a href="https://www.buymeacoffee.com/dumbware" target="_blank">
  <img src="https://cdn.buymeacoffee.com/buttons/v2/default-yellow.png" alt="Buy Me A Coffee" height="60">
</a>

## Contributing

Feel free to submit issues and enhancement requests! 
