#!/bin/bash

# Script to build custom pieces without publishing
# Usage: ./build-pieces.sh [piece1 piece2 ...]
# Examples:
#   ./build-pieces.sh                      # Build all pieces
#   ./build-pieces.sh fis-ibs              # Build only fis-ibs
#   ./build-pieces.sh fis-ibs narmi        # Build fis-ibs and narmi

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

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

# Determine which pieces to build
if [ $# -gt 0 ]; then
  # Specific pieces provided as arguments
  PIECES=("$@")
else
  # No specific pieces, build all
  PIECES=("${ALL_PIECES[@]}")
fi

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}Custom Pieces Builder${NC}"
echo -e "${BLUE}========================================${NC}"
echo -e "Root directory: ${YELLOW}${ROOT_DIR}${NC}"
echo -e "Pieces to build: ${YELLOW}${PIECES[*]}${NC}"
echo ""

# Verify ROOT_DIR contains nx.json
if [ ! -f "$ROOT_DIR/nx.json" ]; then
  echo -e "${RED}Error: nx.json not found in ${ROOT_DIR}${NC}"
  echo -e "${RED}Please run this script from the correct location.${NC}"
  exit 1
fi

# Function to build a piece
build_piece() {
  local piece_name=$1
  local piece_dir="${CUSTOM_PIECES_DIR}/${piece_name}"

  echo -e "${BLUE}----------------------------------------${NC}"
  echo -e "${BLUE}Building: ${piece_name}${NC}"
  echo -e "${BLUE}----------------------------------------${NC}"

  # Check if directory exists
  if [ ! -d "$piece_dir" ]; then
    echo -e "${RED}✗ Directory not found: ${piece_dir}${NC}"
    return 1
  fi

  # Get current version
  cd "$piece_dir"
  CURRENT_VERSION=$(node -p "require('./package.json').version")
  echo -e "Version: ${YELLOW}${CURRENT_VERSION}${NC}"

  # Build the piece
  echo -e "${BLUE}Running nx build...${NC}"
  cd "$ROOT_DIR"
  bunx nx build "pieces-${piece_name}" --skip-nx-cache

  if [ $? -ne 0 ]; then
    echo -e "${RED}✗ Build failed for ${piece_name}${NC}"
    return 1
  fi

  echo -e "${GREEN}✓ Successfully built ${piece_name}@${CURRENT_VERSION}${NC}"
  echo ""

  return 0
}

# Build each piece
FAILED_PIECES=()
SUCCESSFUL_PIECES=()

for piece in "${PIECES[@]}"; do
  if build_piece "$piece"; then
    SUCCESSFUL_PIECES+=("$piece")
  else
    FAILED_PIECES+=("$piece")
  fi
done

# Summary
echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}Build Summary${NC}"
echo -e "${BLUE}========================================${NC}"

if [ ${#SUCCESSFUL_PIECES[@]} -gt 0 ]; then
  echo -e "${GREEN}✓ Successfully built (${#SUCCESSFUL_PIECES[@]}):${NC}"
  for piece in "${SUCCESSFUL_PIECES[@]}"; do
    echo -e "  - ${piece}"
  done
  echo ""
fi

if [ ${#FAILED_PIECES[@]} -gt 0 ]; then
  echo -e "${RED}✗ Failed to build (${#FAILED_PIECES[@]}):${NC}"
  for piece in "${FAILED_PIECES[@]}"; do
    echo -e "  - ${piece}"
  done
  echo ""
  exit 1
fi

echo -e "${GREEN}All pieces built successfully!${NC}"
echo -e "Build output: ${YELLOW}${ROOT_DIR}/dist/packages/pieces/custom/${NC}"
