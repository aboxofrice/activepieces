import {
  createAction,
  Property,
} from '@activepieces/pieces-framework';
import { httpClient, HttpMethod } from '@activepieces/pieces-common';
import { fisHorizonAuth } from '../..';

// ============================================================================
// GET Customer Collateral List
// ============================================================================
export const collateral_getCustomerCollateralList = createAction({
  name: 'collateral_getCustomerCollateralList',
  auth: fisHorizonAuth,
  displayName: 'Collateral - Get Customer Collateral List',
  description: 'Retrieve a list of collateral records for a given customer.',
  props: {
    customerId: Property.ShortText({
      displayName: 'Customer ID',
      description: 'The Customer Key. Right-justified, zero filled. Up to 14 digits.',
      required: true,
    }),
    horizonAuthorization: Property.ShortText({
      displayName: 'Horizon Authorization Token',
      description: 'The authorization token obtained from the Authorization - Get Token action.',
      required: true,
    }),
    sourceId: Property.ShortText({
      displayName: 'Source ID',
      description: 'Optional: 6 character ID provided by FIS',
      required: false,
    }),
  },
  async run(context) {
    const auth = context.auth as any;
    const baseUrl = auth.baseUrl;
    const organizationId = auth.organizationId;
    const { customerId, horizonAuthorization, sourceId } = context.propsValue;

    const uuid = crypto.randomUUID();

    const headers: Record<string, string> = {
      'accept': 'application/json',
      'Content-Type': 'application/json',
      'organization-id': organizationId,
      'uuid': uuid,
      'horizon-authorization': horizonAuthorization,
    };

    if (sourceId) {
      headers['source-id'] = sourceId;
    }

    const response = await httpClient.sendRequest({
      method: HttpMethod.GET,
      url: `${baseUrl}/collateral/v1/customers/${customerId}/collaterals`,
      headers,
    });

    return response.body;
  },
});

// ============================================================================
// POST Add Collateral
// ============================================================================
export const collateral_addCollateral = createAction({
  name: 'collateral_addCollateral',
  auth: fisHorizonAuth,
  displayName: 'Collateral - Add Collateral',
  description: 'Add a collateral record for a given customer.',
  props: {
    customerId: Property.ShortText({
      displayName: 'Customer ID',
      description: 'The Customer Key. Right-justified, zero filled. Up to 14 digits.',
      required: true,
    }),
    horizonAuthorization: Property.ShortText({
      displayName: 'Horizon Authorization Token',
      description: 'The authorization token obtained from the Authorization - Get Token action.',
      required: true,
    }),
    sourceId: Property.ShortText({
      displayName: 'Source ID',
      description: 'Optional: 6 character ID provided by FIS',
      required: false,
    }),
    shortDescription: Property.ShortText({
      displayName: 'Short Description',
      description: 'Short description of the collateral (max 20 characters).',
      required: true,
    }),
    longDescription: Property.ShortText({
      displayName: 'Long Description',
      description: 'Long description of the collateral (max 45 characters).',
      required: true,
    }),
    collateralType: Property.ShortText({
      displayName: 'Collateral Type',
      description: 'The collateral type (max 5 characters).',
      required: false,
    }),
    branchNumber: Property.ShortText({
      displayName: 'Branch Number',
      description: 'The branch number (max 4 characters).',
      required: false,
    }),
    officer1: Property.ShortText({
      displayName: 'Officer 1',
      description: 'Officer 1 (max 3 characters).',
      required: false,
    }),
    officer2: Property.ShortText({
      displayName: 'Officer 2',
      description: 'Officer 2 (max 3 characters).',
      required: false,
    }),
    reviewPeriod: Property.StaticDropdown({
      displayName: 'Review Period',
      description: 'Review period type.',
      required: false,
      options: {
        options: [
          { label: 'Days', value: 'D' },
          { label: 'Months', value: 'M' },
        ],
      },
    }),
    reviewIncrement: Property.Number({
      displayName: 'Review Increment',
      description: 'Review increment (0-999).',
      required: false,
    }),
    expirationDate: Property.Number({
      displayName: 'Expiration Date',
      description: 'Expiration date in CCYYMMDD format (e.g., 20081101).',
      required: false,
    }),
    repricePeriod: Property.StaticDropdown({
      displayName: 'Reprice Period',
      description: 'Reprice period type.',
      required: false,
      options: {
        options: [
          { label: 'Days', value: 'D' },
          { label: 'Months', value: 'M' },
        ],
      },
    }),
    repriceIncrement: Property.Number({
      displayName: 'Reprice Increment',
      description: 'Reprice increment (0-999).',
      required: false,
    }),
    unitType: Property.ShortText({
      displayName: 'Unit Type',
      description: 'The unit type (max 5 characters).',
      required: false,
    }),
    pricePerUnit: Property.Number({
      displayName: 'Price Per Unit',
      description: 'Price per unit.',
      required: false,
    }),
    numberOfUnits: Property.Number({
      displayName: 'Number of Units',
      description: 'Number of units (0-9999999).',
      required: false,
    }),
    totalValue: Property.Number({
      displayName: 'Total Value',
      description: 'Total value of the collateral.',
      required: false,
    }),
    margin: Property.Number({
      displayName: 'Margin',
      description: 'Margin (0-9.99999999).',
      required: false,
    }),
    locationCode: Property.ShortText({
      displayName: 'Location Code',
      description: 'Location code (1 character).',
      required: false,
    }),
    repossessionDate: Property.Number({
      displayName: 'Repossession Date',
      description: 'Repossession date in CCYYMMDD format.',
      required: false,
    }),
    repossessionStatus: Property.ShortText({
      displayName: 'Repossession Status',
      description: 'Repossession status (max 5 characters).',
      required: false,
    }),
    dateCollateralSold: Property.Number({
      displayName: 'Date Collateral Sold',
      description: 'Date collateral was sold in CCYYMMDD format.',
      required: false,
    }),
    amountSold: Property.Number({
      displayName: 'Amount Sold',
      description: 'Amount the collateral was sold for.',
      required: false,
    }),
    originalPriceValue: Property.Number({
      displayName: 'Original Price Value',
      description: 'Original price value.',
      required: false,
    }),
    scratchpadNote1: Property.ShortText({
      displayName: 'Scratchpad Note 1',
      description: 'Scratchpad note 1 (max 70 characters).',
      required: false,
    }),
    scratchpadNote2: Property.ShortText({
      displayName: 'Scratchpad Note 2',
      description: 'Scratchpad note 2 (max 70 characters).',
      required: false,
    }),
    scratchpadNote3: Property.ShortText({
      displayName: 'Scratchpad Note 3',
      description: 'Scratchpad note 3 (max 70 characters).',
      required: false,
    }),
    scratchpadNote4: Property.ShortText({
      displayName: 'Scratchpad Note 4',
      description: 'Scratchpad note 4 (max 70 characters).',
      required: false,
    }),
    legalDescriptionCounter: Property.Number({
      displayName: 'Legal Description Counter',
      description: 'Legal description counter (0-99).',
      required: false,
    }),
    itemizationRecordCounter: Property.Number({
      displayName: 'Itemization Record Counter',
      description: 'Itemization record counter (0-99).',
      required: false,
    }),
    uccFilingCounter: Property.Number({
      displayName: 'UCC Filing Counter',
      description: 'UCC filing counter (0-99).',
      required: false,
    }),
    insurancePolicyCounter: Property.Number({
      displayName: 'Insurance Policy Counter',
      description: 'Insurance policy counter (0-99).',
      required: false,
    }),
    propertyCollateral: Property.Json({
      displayName: 'Property Collateral',
      description: 'Property collateral details as JSON object.',
      required: false,
    }),
    titledCollateral: Property.Json({
      displayName: 'Titled Collateral',
      description: 'Titled collateral details (vehicle) as JSON object.',
      required: false,
    }),
    securitiesCollateral: Property.Json({
      displayName: 'Securities Collateral',
      description: 'Securities collateral details as JSON object.',
      required: false,
    }),
    externalDepositsCollateral: Property.Json({
      displayName: 'External Deposits Collateral',
      description: 'External deposits collateral details as JSON object.',
      required: false,
    }),
    internalDepositsCollateral: Property.Json({
      displayName: 'Internal Deposits Collateral',
      description: 'Internal deposits collateral details as JSON object.',
      required: false,
    }),
    legalCollateral: Property.Json({
      displayName: 'Legal Collateral',
      description: 'Legal collateral details as JSON array.',
      required: false,
    }),
    itemizedCollateral: Property.Json({
      displayName: 'Itemized Collateral',
      description: 'Itemized collateral details as JSON array.',
      required: false,
    }),
    uccCollateral: Property.Json({
      displayName: 'UCC Collateral',
      description: 'UCC (Uniform Commercial Code) collateral details as JSON array.',
      required: false,
    }),
    insurancePolicyCollateral: Property.Json({
      displayName: 'Insurance Policy Collateral',
      description: 'Insurance policy collateral details as JSON array.',
      required: false,
    }),
  },
  async run(context) {
    const auth = context.auth as any;
    const baseUrl = auth.baseUrl;
    const organizationId = auth.organizationId;
    const {
      customerId,
      horizonAuthorization,
      sourceId,
      shortDescription,
      longDescription,
      collateralType,
      branchNumber,
      officer1,
      officer2,
      reviewPeriod,
      reviewIncrement,
      expirationDate,
      repricePeriod,
      repriceIncrement,
      unitType,
      pricePerUnit,
      numberOfUnits,
      totalValue,
      margin,
      locationCode,
      repossessionDate,
      repossessionStatus,
      dateCollateralSold,
      amountSold,
      originalPriceValue,
      scratchpadNote1,
      scratchpadNote2,
      scratchpadNote3,
      scratchpadNote4,
      legalDescriptionCounter,
      itemizationRecordCounter,
      uccFilingCounter,
      insurancePolicyCounter,
      propertyCollateral,
      titledCollateral,
      securitiesCollateral,
      externalDepositsCollateral,
      internalDepositsCollateral,
      legalCollateral,
      itemizedCollateral,
      uccCollateral,
      insurancePolicyCollateral,
    } = context.propsValue;

    const uuid = crypto.randomUUID();

    const headers: Record<string, string> = {
      'accept': 'application/json',
      'Content-Type': 'application/json',
      'organization-id': organizationId,
      'uuid': uuid,
      'horizon-authorization': horizonAuthorization,
    };

    if (sourceId) {
      headers['source-id'] = sourceId;
    }

    const body: Record<string, unknown> = {
      shortDescription,
      longDescription,
    };

    if (collateralType !== undefined && collateralType !== null && collateralType !== '') {
      body['collateralType'] = collateralType;
    }
    if (branchNumber !== undefined && branchNumber !== null && branchNumber !== '') {
      body['branchNumber'] = branchNumber;
    }
    if (officer1 !== undefined && officer1 !== null && officer1 !== '') {
      body['officer1'] = officer1;
    }
    if (officer2 !== undefined && officer2 !== null && officer2 !== '') {
      body['officer2'] = officer2;
    }
    if (reviewPeriod !== undefined && reviewPeriod !== null && reviewPeriod !== '') {
      body['reviewPeriod'] = reviewPeriod;
    }
    if (reviewIncrement !== undefined && reviewIncrement !== null) {
      body['reviewIncrement'] = reviewIncrement;
    }
    if (expirationDate !== undefined && expirationDate !== null) {
      body['expirationDate'] = expirationDate;
    }
    if (repricePeriod !== undefined && repricePeriod !== null && repricePeriod !== '') {
      body['repricePeriod'] = repricePeriod;
    }
    if (repriceIncrement !== undefined && repriceIncrement !== null) {
      body['repriceIncrement'] = repriceIncrement;
    }
    if (unitType !== undefined && unitType !== null && unitType !== '') {
      body['unitType'] = unitType;
    }
    if (pricePerUnit !== undefined && pricePerUnit !== null) {
      body['pricePerUnit'] = pricePerUnit;
    }
    if (numberOfUnits !== undefined && numberOfUnits !== null) {
      body['numberOfUnits'] = numberOfUnits;
    }
    if (totalValue !== undefined && totalValue !== null) {
      body['totalValue'] = totalValue;
    }
    if (margin !== undefined && margin !== null) {
      body['margin'] = margin;
    }
    if (locationCode !== undefined && locationCode !== null && locationCode !== '') {
      body['locationCode'] = locationCode;
    }
    if (repossessionDate !== undefined && repossessionDate !== null) {
      body['repossessionDate'] = repossessionDate;
    }
    if (repossessionStatus !== undefined && repossessionStatus !== null && repossessionStatus !== '') {
      body['repossessionStatus'] = repossessionStatus;
    }
    if (dateCollateralSold !== undefined && dateCollateralSold !== null) {
      body['dateCollateralSold'] = dateCollateralSold;
    }
    if (amountSold !== undefined && amountSold !== null) {
      body['amountSold'] = amountSold;
    }
    if (originalPriceValue !== undefined && originalPriceValue !== null) {
      body['originalPriceValue'] = originalPriceValue;
    }
    if (scratchpadNote1 !== undefined && scratchpadNote1 !== null && scratchpadNote1 !== '') {
      body['scratchpadNote1'] = scratchpadNote1;
    }
    if (scratchpadNote2 !== undefined && scratchpadNote2 !== null && scratchpadNote2 !== '') {
      body['scratchpadNote2'] = scratchpadNote2;
    }
    if (scratchpadNote3 !== undefined && scratchpadNote3 !== null && scratchpadNote3 !== '') {
      body['scratchpadNote3'] = scratchpadNote3;
    }
    if (scratchpadNote4 !== undefined && scratchpadNote4 !== null && scratchpadNote4 !== '') {
      body['scratchpadNote4'] = scratchpadNote4;
    }
    if (legalDescriptionCounter !== undefined && legalDescriptionCounter !== null) {
      body['legalDescriptionCounter'] = legalDescriptionCounter;
    }
    if (itemizationRecordCounter !== undefined && itemizationRecordCounter !== null) {
      body['itemizationRecordCounter'] = itemizationRecordCounter;
    }
    if (uccFilingCounter !== undefined && uccFilingCounter !== null) {
      body['uccFilingCounter'] = uccFilingCounter;
    }
    if (insurancePolicyCounter !== undefined && insurancePolicyCounter !== null) {
      body['insurancePolicyCounter'] = insurancePolicyCounter;
    }
    if (propertyCollateral !== undefined && propertyCollateral !== null) {
      body['propertyCollateral'] = propertyCollateral;
    }
    if (titledCollateral !== undefined && titledCollateral !== null) {
      body['titledCollateral'] = titledCollateral;
    }
    if (securitiesCollateral !== undefined && securitiesCollateral !== null) {
      body['securitiesCollateral'] = securitiesCollateral;
    }
    if (externalDepositsCollateral !== undefined && externalDepositsCollateral !== null) {
      body['externalDepositsCollateral'] = externalDepositsCollateral;
    }
    if (internalDepositsCollateral !== undefined && internalDepositsCollateral !== null) {
      body['internalDepositsCollateral'] = internalDepositsCollateral;
    }
    if (legalCollateral !== undefined && legalCollateral !== null) {
      body['legalCollateral'] = legalCollateral;
    }
    if (itemizedCollateral !== undefined && itemizedCollateral !== null) {
      body['itemizedCollateral'] = itemizedCollateral;
    }
    if (uccCollateral !== undefined && uccCollateral !== null) {
      body['uccCollateral'] = uccCollateral;
    }
    if (insurancePolicyCollateral !== undefined && insurancePolicyCollateral !== null) {
      body['insurancePolicyCollateral'] = insurancePolicyCollateral;
    }

    const response = await httpClient.sendRequest({
      method: HttpMethod.POST,
      url: `${baseUrl}/collateral/v1/customers/${customerId}/collaterals`,
      headers,
      body,
    });

    return response.body;
  },
});

// ============================================================================
// POST Add Collateral Account Relationships
// ============================================================================
export const collateral_addCollateralAccountRelationships = createAction({
  name: 'collateral_addCollateralAccountRelationships',
  auth: fisHorizonAuth,
  displayName: 'Collateral - Add Collateral Account Relationships',
  description: 'Add a relationship between loans or mortgage loans to a collateral record.',
  props: {
    applicationCode: Property.StaticDropdown({
      displayName: 'Application Code',
      description: 'The application of the loan account.',
      required: true,
      options: {
        options: [
          { label: 'Loan (LN)', value: 'LN' },
          { label: 'Mortgage Loan (ML)', value: 'ML' },
        ],
      },
    }),
    accountNumber: Property.ShortText({
      displayName: 'Account Number',
      description: 'The account number of the loan (max 10 characters).',
      required: true,
    }),
    collateralId: Property.ShortText({
      displayName: 'Collateral ID',
      description: 'The unique collateral identification number (max 14 characters).',
      required: true,
    }),
    horizonAuthorization: Property.ShortText({
      displayName: 'Horizon Authorization Token',
      description: 'The authorization token obtained from the Authorization - Get Token action.',
      required: true,
    }),
    sourceId: Property.ShortText({
      displayName: 'Source ID',
      description: 'Optional: 6 character ID provided by FIS',
      required: false,
    }),
    primaryRelationshipFlag: Property.StaticDropdown({
      displayName: 'Primary Relationship Flag',
      description: 'Indicates whether this collateral record is the primary piece of collateral for the loan.',
      required: false,
      options: {
        options: [
          { label: 'Yes', value: 'Y' },
          { label: 'No', value: 'N' },
        ],
      },
    }),
    fixedAmountOfValue: Property.Number({
      displayName: 'Fixed Amount of Value',
      description: 'The amount of the collateral being pledged to the loan. Use this OR Percentage of Value, not both.',
      required: false,
    }),
    percentageOfValue: Property.Number({
      displayName: 'Percentage of Value',
      description: 'The percent of the collateral value being pledged to the loan (e.g., 0.0005 for 0.05%). Use this OR Fixed Amount of Value, not both.',
      required: false,
    }),
  },
  async run(context) {
    const auth = context.auth as any;
    const baseUrl = auth.baseUrl;
    const organizationId = auth.organizationId;
    const {
      applicationCode,
      accountNumber,
      collateralId,
      horizonAuthorization,
      sourceId,
      primaryRelationshipFlag,
      fixedAmountOfValue,
      percentageOfValue,
    } = context.propsValue;

    const uuid = crypto.randomUUID();

    const headers: Record<string, string> = {
      'accept': 'application/json',
      'Content-Type': 'application/json',
      'organization-id': organizationId,
      'uuid': uuid,
      'horizon-authorization': horizonAuthorization,
    };

    if (sourceId) {
      headers['source-id'] = sourceId;
    }

    const queryParams: string[] = [];
    if (primaryRelationshipFlag !== undefined && primaryRelationshipFlag !== null && primaryRelationshipFlag !== '') {
      queryParams.push(`primaryRelationshipFlag=${encodeURIComponent(primaryRelationshipFlag)}`);
    }
    if (fixedAmountOfValue !== undefined && fixedAmountOfValue !== null) {
      queryParams.push(`fixedAmountOfValue=${encodeURIComponent(fixedAmountOfValue.toString())}`);
    }
    if (percentageOfValue !== undefined && percentageOfValue !== null) {
      queryParams.push(`percentageOfValue=${encodeURIComponent(percentageOfValue.toString())}`);
    }

    const queryString = queryParams.length > 0 ? `?${queryParams.join('&')}` : '';

    const response = await httpClient.sendRequest({
      method: HttpMethod.POST,
      url: `${baseUrl}/collateral/v1/accounts/${applicationCode}/${accountNumber}/collaterals/${collateralId}${queryString}`,
      headers,
    });

    return response.body;
  },
});

// ============================================================================
// GET Collateral Account Inquiry
// ============================================================================
export const collateral_collateralAccountInquiry = createAction({
  name: 'collateral_collateralAccountInquiry',
  auth: fisHorizonAuth,
  displayName: 'Collateral - Collateral Account Inquiry',
  description: 'Retrieve basic information relating to a collateral account.',
  props: {
    applicationCode: Property.StaticDropdown({
      displayName: 'Application Code',
      description: 'Application Code. Valid Value: CT = Collateral Tracking',
      required: true,
      options: {
        options: [
          { label: 'Collateral Tracking (CT)', value: 'CT' },
        ],
      },
    }),
    accountNumber: Property.ShortText({
      displayName: 'Account Number',
      description: 'Up to 20 digit zero filled account number.',
      required: true,
    }),
    horizonAuthorization: Property.ShortText({
      displayName: 'Horizon Authorization Token',
      description: 'The authorization token obtained from the Authorization - Get Token action.',
      required: true,
    }),
    sourceId: Property.ShortText({
      displayName: 'Source ID',
      description: 'Optional: 6 character ID provided by FIS',
      required: false,
    }),
    customerId: Property.ShortText({
      displayName: 'Customer ID',
      description: 'Optional: Specifies the unique identifier associated with a customer. Right-justified, zero filled. Up to 14 digits.',
      required: false,
    }),
    returnUppercase: Property.StaticDropdown({
      displayName: 'Return Uppercase',
      description: 'Optional: Return data in uppercase.',
      required: false,
      options: {
        options: [
          { label: 'Yes', value: 'Y' },
          { label: 'No', value: 'N' },
        ],
      },
    }),
  },
  async run(context) {
    const auth = context.auth as any;
    const baseUrl = auth.baseUrl;
    const organizationId = auth.organizationId;
    const {
      applicationCode,
      accountNumber,
      horizonAuthorization,
      sourceId,
      customerId,
      returnUppercase,
    } = context.propsValue;

    const uuid = crypto.randomUUID();

    const headers: Record<string, string> = {
      'accept': 'application/json',
      'Content-Type': 'application/json',
      'organization-id': organizationId,
      'uuid': uuid,
      'horizon-authorization': horizonAuthorization,
    };

    if (sourceId) {
      headers['source-id'] = sourceId;
    }

    const queryParams: string[] = [];
    if (customerId !== undefined && customerId !== null && customerId !== '') {
      queryParams.push(`customerId=${encodeURIComponent(customerId)}`);
    }
    if (returnUppercase !== undefined && returnUppercase !== null && returnUppercase !== '') {
      queryParams.push(`returnUppercase=${encodeURIComponent(returnUppercase)}`);
    }

    const queryString = queryParams.length > 0 ? `?${queryParams.join('&')}` : '';

    const response = await httpClient.sendRequest({
      method: HttpMethod.GET,
      url: `${baseUrl}/collateral/v1/accounts/${applicationCode}/${accountNumber}${queryString}`,
      headers,
    });

    return response.body;
  },
});
