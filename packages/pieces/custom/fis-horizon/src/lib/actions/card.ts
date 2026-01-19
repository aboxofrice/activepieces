import {
  createAction,
  Property,
} from '@activepieces/pieces-framework';
import { httpClient, HttpMethod } from '@activepieces/pieces-common';
import { fisHorizonAuth } from '../..';

/**
 * Card - Inquiry
 * POST /cards/inquiry
 * Retrieve basic information relating to a card number.
 */
export const card_inquiry = createAction({
  name: 'card_inquiry',
  auth: fisHorizonAuth,
  displayName: 'Card - Inquiry',
  description: 'Retrieve basic information relating to a card number. This endpoint supports card tokenization.',
  props: {
    xAuthorization: Property.ShortText({
      displayName: 'Authorization Token',
      description: 'The authorization token obtained from the Get Token endpoint',
      required: true,
    }),
    sourceId: Property.ShortText({
      displayName: 'Source ID',
      description: 'Optional: 6 character ID provided by FIS',
      required: false,
    }),
    customerId: Property.ShortText({
      displayName: 'Customer ID',
      description: 'Specifies the unique identifier associated with a customer. Right-justified, zero filled, up to 14 digits',
      required: false,
    }),
    returnUppercase: Property.Checkbox({
      displayName: 'Return Uppercase',
      description: 'Return response in uppercase. Defaults to false if not sent',
      required: false,
      defaultValue: false,
    }),
    panPlainText: Property.ShortText({
      displayName: 'PAN (Plain Text)',
      description: 'Plain-text PAN. Should not be supplied for LIVE integration. Max 19 characters',
      required: false,
    }),
    panCipherText: Property.ShortText({
      displayName: 'PAN (Cipher Text)',
      description: 'Cipher text holds encrypted card number (as JWE). Reserved for future use',
      required: false,
    }),
    panAlias: Property.ShortText({
      displayName: 'PAN (Alias)',
      description: 'Tokenized representation of clear-text PAN. Max 19 characters',
      required: false,
    }),
  },
  async run(context) {
    const auth = context.auth as any;
    const baseUrl = auth['baseUrl'];
    const organizationId = auth['organizationId'];
    const { xAuthorization, sourceId, customerId, returnUppercase, panPlainText, panCipherText, panAlias } = context.propsValue;

    const uuid = crypto.randomUUID();

    const headers: Record<string, string> = {
      'accept': 'application/json',
      'Content-Type': 'application/json',
      'organization-id': organizationId,
      'uuid': uuid,
      'x-authorization': xAuthorization,
    };

    if (sourceId) {
      headers['source-id'] = sourceId;
    }

    const queryParams: Record<string, string> = {};
    if (customerId) {
      queryParams['customerId'] = customerId;
    }
    if (returnUppercase !== undefined) {
      queryParams['returnUppercase'] = String(returnUppercase);
    }

    const queryString = Object.keys(queryParams).length > 0
      ? '?' + new URLSearchParams(queryParams).toString()
      : '';

    const body: Record<string, unknown> = {
      pan: {
        plainText: panPlainText || '',
        cipherText: panCipherText || '',
        alias: panAlias || '',
      },
    };

    const response = await httpClient.sendRequest({
      method: HttpMethod.POST,
      url: `${baseUrl}/card/v2/cards/inquiry${queryString}`,
      headers,
      body,
    });

    return response.body;
  },
});

/**
 * Card - Inquiry by Account
 * POST /cards/applications/{applicationCode}/accounts/{accountNumber}/inquiry
 * Retrieve a list of cards attached to a given account.
 */
export const card_inquiry_by_account = createAction({
  name: 'card_inquiry_by_account',
  auth: fisHorizonAuth,
  displayName: 'Card - Inquiry by Account',
  description: 'Retrieve a list of cards attached to a given account and basic card information. This endpoint supports card tokenization.',
  props: {
    xAuthorization: Property.ShortText({
      displayName: 'Authorization Token',
      description: 'The authorization token obtained from the Get Token endpoint',
      required: true,
    }),
    sourceId: Property.ShortText({
      displayName: 'Source ID',
      description: 'Optional: 6 character ID provided by FIS',
      required: false,
    }),
    applicationCode: Property.ShortText({
      displayName: 'Application Code',
      description: 'Application Code (e.g., DD for Demand Deposit, SV for Savings)',
      required: true,
    }),
    accountNumber: Property.ShortText({
      displayName: 'Account Number',
      description: 'Account Number',
      required: true,
    }),
    numberToReturn: Property.Number({
      displayName: 'Number to Return',
      description: 'Number of records to return (max 99)',
      required: false,
    }),
    lastPanPlainText: Property.ShortText({
      displayName: 'Last PAN (Plain Text)',
      description: 'For pagination - Plain-text PAN of last record from previous request',
      required: false,
    }),
    lastPanCipherText: Property.ShortText({
      displayName: 'Last PAN (Cipher Text)',
      description: 'For pagination - Cipher text of last record from previous request',
      required: false,
    }),
    lastPanAlias: Property.ShortText({
      displayName: 'Last PAN (Alias)',
      description: 'For pagination - Tokenized PAN of last record from previous request',
      required: false,
    }),
  },
  async run(context) {
    const auth = context.auth as any;
    const baseUrl = auth['baseUrl'];
    const organizationId = auth['organizationId'];
    const { xAuthorization, sourceId, applicationCode, accountNumber, numberToReturn, lastPanPlainText, lastPanCipherText, lastPanAlias } = context.propsValue;

    const uuid = crypto.randomUUID();

    const headers: Record<string, string> = {
      'accept': 'application/json',
      'Content-Type': 'application/json',
      'organization-id': organizationId,
      'uuid': uuid,
      'x-authorization': xAuthorization,
    };

    if (sourceId) {
      headers['source-id'] = sourceId;
    }

    const queryParams: Record<string, string> = {};
    if (numberToReturn !== undefined) {
      queryParams['numberToReturn'] = String(numberToReturn);
    }

    const queryString = Object.keys(queryParams).length > 0
      ? '?' + new URLSearchParams(queryParams).toString()
      : '';

    const body: Record<string, unknown> = {};
    if (lastPanPlainText || lastPanCipherText || lastPanAlias) {
      body['lastPan'] = {
        plainText: lastPanPlainText || '',
        cipherText: lastPanCipherText || '',
        alias: lastPanAlias || '',
      };
    }

    const response = await httpClient.sendRequest({
      method: HttpMethod.POST,
      url: `${baseUrl}/card/v2/cards/applications/${applicationCode}/accounts/${accountNumber}/inquiry${queryString}`,
      headers,
      body,
    });

    return response.body;
  },
});

/**
 * Card - Maintain (Update)
 * PUT /cards
 * Maintain selected optional fields for a given card number.
 */
export const card_maintain = createAction({
  name: 'card_maintain',
  auth: fisHorizonAuth,
  displayName: 'Card - Maintain',
  description: 'Maintain selected optional fields for a given card number. This endpoint supports card tokenization.',
  props: {
    xAuthorization: Property.ShortText({
      displayName: 'Authorization Token',
      description: 'The authorization token obtained from the Get Token endpoint',
      required: true,
    }),
    sourceId: Property.ShortText({
      displayName: 'Source ID',
      description: 'Optional: 6 character ID provided by FIS',
      required: false,
    }),
    panPlainText: Property.ShortText({
      displayName: 'PAN (Plain Text)',
      description: 'Plain-text PAN. Should not be supplied for LIVE integration. Max 19 characters',
      required: false,
    }),
    panCipherText: Property.ShortText({
      displayName: 'PAN (Cipher Text)',
      description: 'Cipher text holds encrypted card number (as JWE). Reserved for future use',
      required: false,
    }),
    panAlias: Property.ShortText({
      displayName: 'PAN (Alias)',
      description: 'Tokenized representation of clear-text PAN. Max 19 characters',
      required: false,
    }),
    changeType: Property.StaticDropdown({
      displayName: 'Change Type',
      description: 'Type of card change to perform',
      required: true,
      options: {
        options: [
          { label: 'N - New Card', value: 'N' },
          { label: 'I - Reissue Card', value: 'I' },
          { label: 'P - Repin Card', value: 'P' },
          { label: 'R - Repair Card', value: 'R' },
          { label: 'S - Preselect PIN', value: 'S' },
        ],
      },
    }),
    cardMaintenanceOverrideSent: Property.Json({
      displayName: 'Card Maintenance Override Fields',
      description: 'Array of override fields. Each item should have: segmentId (OPTF), fieldName, fieldValue. Example: [{"segmentId":"OPTF","fieldName":"CCSTAT","fieldValue":"C"}]',
      required: false,
    }),
  },
  async run(context) {
    const auth = context.auth as any;
    const baseUrl = auth['baseUrl'];
    const organizationId = auth['organizationId'];
    const { xAuthorization, sourceId, panPlainText, panCipherText, panAlias, changeType, cardMaintenanceOverrideSent } = context.propsValue;

    const uuid = crypto.randomUUID();

    const headers: Record<string, string> = {
      'accept': 'application/json',
      'Content-Type': 'application/json',
      'organization-id': organizationId,
      'uuid': uuid,
      'x-authorization': xAuthorization,
    };

    if (sourceId) {
      headers['source-id'] = sourceId;
    }

    const body: Record<string, unknown> = {
      pan: {
        plainText: panPlainText || '',
        cipherText: panCipherText || '',
        alias: panAlias || '',
      },
      changeType: changeType,
    };

    if (cardMaintenanceOverrideSent) {
      body['cardMaintenanceOverrideSent'] = cardMaintenanceOverrideSent;
    }

    const response = await httpClient.sendRequest({
      method: HttpMethod.PUT,
      url: `${baseUrl}/card/v2/cards`,
      headers,
      body,
    });

    return response.body;
  },
});

/**
 * Card - Add
 * POST /cards
 * Add a new card record for the bank.
 */
export const card_add = createAction({
  name: 'card_add',
  auth: fisHorizonAuth,
  displayName: 'Card - Add',
  description: 'Add a new card record for the bank. The transaction can generate a card number if a card number is not sent. This endpoint supports card tokenization.',
  props: {
    xAuthorization: Property.ShortText({
      displayName: 'Authorization Token',
      description: 'The authorization token obtained from the Get Token endpoint',
      required: true,
    }),
    sourceId: Property.ShortText({
      displayName: 'Source ID',
      description: 'Optional: 6 character ID provided by FIS',
      required: false,
    }),
    customerId: Property.ShortText({
      displayName: 'Customer ID',
      description: 'Card Holder Customer Key. Right-justified, zero filled, up to 14 digits',
      required: true,
    }),
    productType: Property.ShortText({
      displayName: 'Product Type',
      description: 'Card Holder Product Type (e.g., ATM, VDR). Max 3 characters',
      required: true,
    }),
    panPlainText: Property.ShortText({
      displayName: 'PAN (Plain Text)',
      description: 'Plain-text PAN. Should not be supplied for LIVE integration. Max 19 characters. If not provided, the system can generate one',
      required: false,
    }),
    panCipherText: Property.ShortText({
      displayName: 'PAN (Cipher Text)',
      description: 'Cipher text holds encrypted card number (as JWE). Reserved for future use',
      required: false,
    }),
    panAlias: Property.ShortText({
      displayName: 'PAN (Alias)',
      description: 'Tokenized representation of clear-text PAN. Max 19 characters',
      required: false,
    }),
    relatedAccountSent: Property.Json({
      displayName: 'Related Accounts',
      description: 'Array of related accounts (required). Each item should have: application (e.g., DD), accountNumber, primaryAccount (Y/N). Example: [{"application":"DD","accountNumber":"21","primaryAccount":"Y"}]',
      required: true,
    }),
    overrideAccountSent: Property.Json({
      displayName: 'Override Fields',
      description: 'Optional array of override fields. Each item should have: segmentId (OPTF), fieldName, fieldValue. Example: [{"segmentId":"OPTF","fieldName":"CCO1POSL","fieldValue":"1700"}]',
      required: false,
    }),
  },
  async run(context) {
    const auth = context.auth as any;
    const baseUrl = auth['baseUrl'];
    const organizationId = auth['organizationId'];
    const { xAuthorization, sourceId, customerId, productType, panPlainText, panCipherText, panAlias, relatedAccountSent, overrideAccountSent } = context.propsValue;

    const uuid = crypto.randomUUID();

    const headers: Record<string, string> = {
      'accept': 'application/json',
      'Content-Type': 'application/json',
      'organization-id': organizationId,
      'uuid': uuid,
      'x-authorization': xAuthorization,
    };

    if (sourceId) {
      headers['source-id'] = sourceId;
    }

    const body: Record<string, unknown> = {
      customerId: customerId,
      productType: productType,
      relatedAccountSent: relatedAccountSent,
    };

    if (panPlainText || panCipherText || panAlias) {
      body['pan'] = {
        plainText: panPlainText || '',
        cipherText: panCipherText || '',
        alias: panAlias || '',
      };
    }

    if (overrideAccountSent) {
      body['overrideAccountSent'] = overrideAccountSent;
    }

    const response = await httpClient.sendRequest({
      method: HttpMethod.POST,
      url: `${baseUrl}/card/v2/cards`,
      headers,
      body,
    });

    return response.body;
  },
});

/**
 * Card - Details Inquiry
 * POST /cards/details-inquiry
 * Retrieve card member details based on the input card number.
 */
export const card_details_inquiry = createAction({
  name: 'card_details_inquiry',
  auth: fisHorizonAuth,
  displayName: 'Card - Details Inquiry',
  description: 'Retrieve card member details based on the input card number. Returns details of all the members for the requested card number. This endpoint supports card tokenization.',
  props: {
    xAuthorization: Property.ShortText({
      displayName: 'Authorization Token',
      description: 'The authorization token obtained from the Get Token endpoint',
      required: true,
    }),
    sourceId: Property.ShortText({
      displayName: 'Source ID',
      description: 'Optional: 6 character ID provided by FIS',
      required: false,
    }),
    panPlainText: Property.ShortText({
      displayName: 'PAN (Plain Text)',
      description: 'Plain-text PAN. Should not be supplied for LIVE integration. Max 19 characters',
      required: false,
    }),
    panCipherText: Property.ShortText({
      displayName: 'PAN (Cipher Text)',
      description: 'Cipher text holds encrypted card number (as JWE). Reserved for future use',
      required: false,
    }),
    panAlias: Property.ShortText({
      displayName: 'PAN (Alias)',
      description: 'Tokenized representation of clear-text PAN. Max 19 characters',
      required: false,
    }),
  },
  async run(context) {
    const auth = context.auth as any;
    const baseUrl = auth['baseUrl'];
    const organizationId = auth['organizationId'];
    const { xAuthorization, sourceId, panPlainText, panCipherText, panAlias } = context.propsValue;

    const uuid = crypto.randomUUID();

    const headers: Record<string, string> = {
      'accept': 'application/json',
      'Content-Type': 'application/json',
      'organization-id': organizationId,
      'uuid': uuid,
      'x-authorization': xAuthorization,
    };

    if (sourceId) {
      headers['source-id'] = sourceId;
    }

    const body: Record<string, unknown> = {
      pan: {
        plainText: panPlainText || '',
        cipherText: panCipherText || '',
        alias: panAlias || '',
      },
    };

    const response = await httpClient.sendRequest({
      method: HttpMethod.POST,
      url: `${baseUrl}/card/v2/cards/details-inquiry`,
      headers,
      body,
    });

    return response.body;
  },
});
