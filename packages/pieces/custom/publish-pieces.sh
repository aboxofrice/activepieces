#!/bin/bash

# Script to build, version, and publish custom pieces to npm
# Usage: ./publish-pieces.sh [patch|minor|major] [piece1 piece2 ...]
# Examples:
#   ./publish-pieces.sh                      # Publish all pieces with patch bump
#   ./publish-pieces.sh minor                # Publish all pieces with minor bump
#   ./publish-pieces.sh patch fis-ibs        # Publish only fis-ibs with patch bump
#   ./publish-pieces.sh patch fis-ibs narmi  # Publish fis-ibs and narmi with patch bump

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Get the version bump type (default to patch)
VERSION_TYPE="${1:-patch}"

# Validate version type
if [[ ! "$VERSION_TYPE" =~ ^(patch|minor|major)$ ]]; then
  echo -e "${RED}Error: Invalid version type '$VERSION_TYPE'. Use patch, minor, or major.${NC}"
  exit 1
fi

# Get script directory (works even when called from different locations)
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CUSTOM_PIECES_DIR="$SCRIPT_DIR"
ROOT_DIR="$(cd "$SCRIPT_DIR/../../.." && pwd)"

# All available pieces
ALL_PIECES=(
  "narmi"
  "fiserv-premier"
  "icemortgage-encompass"
  "gelato"
  "plaid"
  "ncino"
  "kinective-placeholder"
  "fis-horizon"
  "fis-ibs"
  "fis-ibs-cards"
)

# Determine which pieces to publish
shift  # Remove the version type from arguments
if [ $# -gt 0 ]; then
  # Specific pieces provided as arguments
  PIECES=("$@")
else
  # No specific pieces, publish all
  PIECES=("${ALL_PIECES[@]}")
fi

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}Custom Pieces Publisher${NC}"
echo -e "${BLUE}========================================${NC}"
echo -e "Version bump type: ${YELLOW}${VERSION_TYPE}${NC}"
echo -e "Pieces to publish: ${YELLOW}${PIECES[*]}${NC}"
echo ""

# Check if logged in to npm, prompt login if not
echo -e "${BLUE}Checking npm authentication...${NC}"
NPM_USER=$(npm whoami 2>/dev/null) || NPM_USER=""
if [ -z "$NPM_USER" ]; then
  echo -e "${YELLOW}Not logged in to npm. Starting login...${NC}"
  if ! npm login; then
    echo -e "${RED}Error: npm login failed. Please try again.${NC}"
    exit 1
  fi
  echo -e "${GREEN}✓ Login completed${NC}"
else
  echo -e "${GREEN}✓ Logged in as: ${NPM_USER}${NC}"
fi
echo ""

# Function to publish a piece
publish_piece() {
  local piece_name=$1
  local piece_dir="${CUSTOM_PIECES_DIR}/${piece_name}"

  echo -e "${BLUE}========================================${NC}"
  echo -e "${BLUE}Processing: ${piece_name}${NC}"
  echo -e "${BLUE}========================================${NC}"

  # Check if directory exists
  if [ ! -d "$piece_dir" ]; then
    echo -e "${RED}✗ Directory not found: ${piece_dir}${NC}"
    return 1
  fi

  cd "$piece_dir"

  # Get current version
  CURRENT_VERSION=$(node -p "require('./package.json').version")
  echo -e "Current version: ${YELLOW}${CURRENT_VERSION}${NC}"

  # Increment version in package.json
  echo -e "${BLUE}Bumping version (${VERSION_TYPE})...${NC}"
  npm version $VERSION_TYPE --no-git-tag-version

  NEW_VERSION=$(node -p "require('./package.json').version")
  echo -e "New version: ${GREEN}${NEW_VERSION}${NC}"

  # Build the piece
  echo -e "${BLUE}Building piece...${NC}"
  cd "$ROOT_DIR"
  bunx nx build "pieces-${piece_name}" --skip-nx-cache

  if [ $? -ne 0 ]; then
    echo -e "${RED}✗ Build failed for ${piece_name}${NC}"
    return 1
  fi
  echo -e "${GREEN}✓ Build successful${NC}"

  # Navigate to dist folder
  DIST_DIR="${ROOT_DIR}/dist/packages/pieces/custom/${piece_name}"
  cd "$DIST_DIR"

  # Publish to npm
  echo -e "${BLUE}Publishing to npm...${NC}"
  npm publish --access public

  if [ $? -ne 0 ]; then
    echo -e "${RED}✗ Publish failed for ${piece_name}${NC}"
    return 1
  fi

  echo -e "${GREEN}✓ Successfully published ${piece_name}@${NEW_VERSION}${NC}"
  echo ""

  return 0
}

# Publish each piece
FAILED_PIECES=()
SUCCESSFUL_PIECES=()

for piece in "${PIECES[@]}"; do
  if publish_piece "$piece"; then
    SUCCESSFUL_PIECES+=("$piece")
  else
    FAILED_PIECES+=("$piece")
  fi
done

# Summary
echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}Publication Summary${NC}"
echo -e "${BLUE}========================================${NC}"

if [ ${#SUCCESSFUL_PIECES[@]} -gt 0 ]; then
  echo -e "${GREEN}✓ Successfully published (${#SUCCESSFUL_PIECES[@]}):${NC}"
  for piece in "${SUCCESSFUL_PIECES[@]}"; do
    echo -e "  - ${piece}"
  done
  echo ""
fi

if [ ${#FAILED_PIECES[@]} -gt 0 ]; then
  echo -e "${RED}✗ Failed to publish (${#FAILED_PIECES[@]}):${NC}"
  for piece in "${FAILED_PIECES[@]}"; do
    echo -e "  - ${piece}"
  done
  echo ""
  exit 1
fi

echo -e "${GREEN}All pieces published successfully!${NC}"
