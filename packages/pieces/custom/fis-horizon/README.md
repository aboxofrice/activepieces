# FIS Horizon

This piece provides integration with FIS Horizon banking APIs.

## Authentication

This piece requires the following authentication parameters:

- **Base URL**: The base URL for the FIS Horizon API (e.g., `https://api-gw-uat.fisglobal.com/rest/horizon`)
- **Organization ID**: Your FIS Organization ID (UUID format)
- **User ID**: Your FIS Horizon user ID
- **User Secret**: Your FIS Horizon user secret/password

## Available Actions

### Authorization - Get Token
Retrieve an authorization token using user credentials. This token is required for all other API calls.

### Customer - Search Relationship Summary
Search for customer relationship summary including account details.

### Custom API Call
Make custom API calls to any FIS Horizon endpoint.

## Usage

1. Configure your authentication credentials
2. Use the "Authorization - Get Token" action to obtain a JWT token
3. Use the JWT token in subsequent API calls via the x-authorization header
