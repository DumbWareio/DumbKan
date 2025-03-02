# DumbKan Development

Because we're too dumb for complexity, development is super simple!

## Quick Start

1. Clone this repo
2. Navigate to the `dev` directory
3. Use our dumb-simple development script:

```bash
# Start development environment
./dev.sh up

# Stop development environment
./dev.sh down

# View logs
./dev.sh logs

# Rebuild without cache
./dev.sh rebuild

# Clean everything up
./dev.sh clean
```

## Development Environment Features

Our development setup is sophisticatedly simple:

* Builds from local Dockerfile instead of pulling image
* Mounts local directory for live code changes
* Uses development-specific settings
* Adds helpful labels for container identification
* Hot-reloading for faster development

## Development-specific Settings

The `docker-compose.dev.yml` includes:

* Local volume mounts for live code updates
* Development-specific environment variables
* Automatic container restart for development

This setup:
* Prevents local node_modules from interfering with container modules
* Preserves container's node_modules installed during build
* Avoids platform-specific module issues
* Keeps development simple and consistent across environments

## Directory Structure

```
dev/
├── README.md               # You are here!
├── docker-compose.dev.yml  # Development-specific Docker setup
├── dev.sh                 # Simple development helper script
```

That's it! We told you it was dumb simple! If you need more complexity, you're probably in the wrong place! 
