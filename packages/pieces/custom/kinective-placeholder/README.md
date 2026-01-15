# Kinective Placeholder Integration

This piece integrates with the Kinective API for comprehensive banking operations including party management, accounts, loans, collateral, and escrow.

## Authentication

The Kinective Placeholder piece uses custom authentication with EFXHeader:

- **Base URL**: The base URL for the Kinective API (e.g., https://api.kinective.com)
- **Organization ID**: Your Kinective Organization ID

## Available Actions (15 + Custom API Call)

### Party Actions (4)

#### Get Party
Get party information by Party ID or Tax ID.

#### Get Party List
Get a list of parties with optional filtering and pagination.

#### Add Party
Create a new party (person or organization).

#### Update Party
Update an existing party.

### Account Actions (3)

#### Account - Create
Create a new account (deposit or loan). Supports:
- Checking (DDA), Savings (SDA), CD (CDA), Money Market (MMA)
- Loans and Credit Lines
- Custom fields via JSON

#### Account - Get
Retrieve account information with optional balance and transaction history.

#### Account - Update
Update account status, interest rate, credit limit, or nickname.

### Collateral Actions (4)

#### Collateral - Add
Add collateral to a loan. Supports:
- Real Estate, Vehicle, Equipment, Securities, Cash, Other
- Property address (for real estate)
- VIN number (for vehicles)

#### Collateral - Get
Retrieve collateral information by ID.

#### Collateral - Update
Update collateral description and estimated value.

#### Collateral - Delete
Delete collateral from a loan.

### Escrow Actions (4)

#### Escrow - Add
Add escrow to a loan. Supports:
- Property Tax, Insurance, PMI, HOA, Other
- Payment frequency (Monthly, Quarterly, Semi-Annual, Annual)

#### Escrow - Get
Retrieve escrow information by ID.

#### Escrow - Update
Update escrow amount, frequency, or description.

#### Escrow - Delete
Delete escrow from a loan.

### Custom API Call
Make a custom API call to any Kinective endpoint with automatic EFXHeader injection.

## API Structure

This piece uses the same API structure as Fiserv:
- EFXHeader authentication with Organization ID and Transaction ID
- Party service endpoints (`/banking/efx/v1/partyservice/...`)
- Account service endpoints (`/banking/efx/v1/acctservice/...`)
- Loan service endpoints (`/banking/efx/v1/loanservice/...`)
- JSON request/response format

## Version

Current version: 0.0.1

## Author

vqnguyen1
