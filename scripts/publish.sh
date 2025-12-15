#!/bin/bash

# Get the directory where the script is located
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}╔════════════════════════════════════╗${NC}"
echo -e "${BLUE}║       xtc Release Publisher        ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════╝${NC}"
echo ""

# Load .env file if it exists
ENV_FILE="$PROJECT_DIR/.env"
if [ -f "$ENV_FILE" ]; then
    echo -e "Loading environment from ${YELLOW}.env${NC}"
    export $(grep -v '^#' "$ENV_FILE" | xargs)
    echo ""
fi

# Check if GH_TOKEN is set
if [ -z "$GH_TOKEN" ]; then
    echo -e "${RED}Error: GH_TOKEN is not set${NC}"
    echo ""
    echo "To fix this, add your token to .env file:"
    echo -e "  ${YELLOW}$ENV_FILE${NC}"
    echo ""
    echo "Or create a token at: https://github.com/settings/tokens"
    echo "(Required scope: repo)"
    echo ""
    exit 1
fi

echo -e "GitHub token: ${GREEN}✓ Found${NC}"
echo ""

# Get current version
CURRENT_VERSION=$(node -p "require('./package.json').version")
echo -e "Current version: ${YELLOW}${CURRENT_VERSION}${NC}"
echo ""

# Ask for new version
read -p "Enter new version (or press Enter to keep ${CURRENT_VERSION}): " NEW_VERSION

if [ -z "$NEW_VERSION" ]; then
    NEW_VERSION=$CURRENT_VERSION
    echo -e "Keeping version: ${GREEN}${NEW_VERSION}${NC}"
else
    echo -e "New version: ${GREEN}${NEW_VERSION}${NC}"
    
    # Update package.json version
    npm version $NEW_VERSION --no-git-tag-version
    
    if [ $? -ne 0 ]; then
        echo -e "${RED}Failed to update version${NC}"
        exit 1
    fi
fi

echo ""

# Ask which platform to build for
echo "Select platform to publish:"
echo "  1) macOS (arm64 + x64)"
echo "  2) Windows"
echo "  3) Linux"
echo "  4) All platforms"
echo ""
read -p "Enter choice [1-4]: " PLATFORM_CHOICE

case $PLATFORM_CHOICE in
    1)
        PLATFORM="mac"
        PLATFORM_NAME="macOS"
        ;;
    2)
        PLATFORM="win"
        PLATFORM_NAME="Windows"
        ;;
    3)
        PLATFORM="linux"
        PLATFORM_NAME="Linux"
        ;;
    4)
        PLATFORM="all"
        PLATFORM_NAME="All Platforms"
        ;;
    *)
        echo -e "${RED}Invalid choice${NC}"
        exit 1
        ;;
esac

echo ""
echo -e "${BLUE}Building for ${PLATFORM_NAME}...${NC}"
echo ""

# Build and publish
if [ "$PLATFORM" = "all" ]; then
    npm run build:electron && npm run build:renderer && npx electron-builder --mac --win --linux --publish always
else
    npm run publish:$PLATFORM
fi

if [ $? -ne 0 ]; then
    echo ""
    echo -e "${RED}Build failed!${NC}"
    exit 1
fi

echo ""
echo -e "${GREEN}════════════════════════════════════${NC}"
echo -e "${GREEN}  Build and publish complete! 🎉${NC}"
echo -e "${GREEN}════════════════════════════════════${NC}"
echo ""

# Ask if we should commit and tag
if [ "$NEW_VERSION" != "$CURRENT_VERSION" ]; then
    read -p "Commit version bump and create git tag? [y/N]: " SHOULD_TAG
    
    if [[ "$SHOULD_TAG" =~ ^[Yy]$ ]]; then
        git add package.json package-lock.json
        git commit -m "Release v${NEW_VERSION}"
        git tag -a "v${NEW_VERSION}" -m "Release v${NEW_VERSION}"
        
        read -p "Push to origin? [y/N]: " SHOULD_PUSH
        if [[ "$SHOULD_PUSH" =~ ^[Yy]$ ]]; then
            git push origin main --tags
            echo -e "${GREEN}Pushed to origin with tags${NC}"
        fi
    fi
fi

echo ""
echo -e "Next steps:"
echo -e "  1. Go to ${BLUE}https://github.com/ykim-24/xtc/releases${NC}"
echo -e "  2. Find the draft release for v${NEW_VERSION}"
echo -e "  3. Edit the release notes if needed"
echo -e "  4. Click 'Publish release'"
echo ""

