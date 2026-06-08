# FIS IBS (Integrated Banking Solutions)

This piece provides integration with FIS IBS banking APIs.

## Authentication

This piece requires the following authentication parameters:

- **Base URL**: The base URL for the FIS IBS API (e.g., `https://api-gw-uat.fisglobal.com/rest`)
- **Organization ID**: Your FIS Organization ID
- **Source ID**: Source ID provided by FIS
- **Application ID**: Application ID for your integration
- **IBS Authorization**: Authorization token for IBS APIs

## Available Actions

### Customer - Get
Retrieve customer information by customer number.

### Customer - Search
Search for customers using various criteria.

### Custom API Call
Make custom API calls to any FIS IBS endpoint.

## API Categories

The FIS IBS platform includes many API categories:
- Customer Management
- Deposit Accounts
- Loan Accounts
- Cards
- Transfers
- Teller Operations
- And many more...

Use the Custom API Call action to access any endpoint not covered by specific actions.
