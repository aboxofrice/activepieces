import {
  createAction,
  Property,
} from '@activepieces/pieces-framework';
import { httpClient, HttpMethod } from '@activepieces/pieces-common';
import { kinectivePlaceholderAuth } from '../..';

export const createAccount = createAction({
  name: 'account_create',
  auth: kinectivePlaceholderAuth,
  displayName: 'Account - Create',
  description: 'Create a new account (deposit or loan)',
  props: {
    accountType: Property.StaticDropdown({
      displayName: 'Account Type',
      description: 'Type of account to create',
      required: true,
      options: {
        options: [
          { label: 'Checking (DDA)', value: 'DDA' },
          { label: 'Savings (SDA)', value: 'SDA' },
          { label: 'Certificate of Deposit (CDA)', value: 'CDA' },
          { label: 'Money Market (MMA)', value: 'MMA' },
          { label: 'Loan', value: 'LOAN' },
          { label: 'Credit Line (CRD)', value: 'CRD' },
        ],
      },
    }),
    partyId: Property.ShortText({
      displayName: 'Party ID',
      description: 'The ID of the party (customer) for this account',
      required: true,
    }),
    branchId: Property.ShortText({
      displayName: 'Branch ID',
      description: 'Branch identifier where account is opened',
      required: false,
    }),
    productCode: Property.ShortText({
      displayName: 'Product Code',
      description: 'Product code for the account type',
      required: false,
    }),
    openingBalance: Property.Number({
      displayName: 'Opening Balance',
      description: 'Initial deposit amount (for deposit accounts)',
      required: false,
    }),
    interestRate: Property.Number({
      displayName: 'Interest Rate',
      description: 'Interest rate percentage',
      required: false,
    }),
    loanAmount: Property.Number({
      displayName: 'Loan Amount',
      description: 'Principal loan amount (for loan accounts)',
      required: false,
    }),
    loanTerm: Property.Number({
      displayName: 'Loan Term (months)',
      description: 'Loan term in months (for loan accounts)',
      required: false,
    }),
    customFields: Property.Json({
      displayName: 'Custom Fields (JSON)',
      description: 'Additional fields to include in the request body',
      required: false,
    }),
  },
  async run(context) {
    const auth = context.auth as any;
    const baseUrl = auth.baseUrl;
    const organizationId = auth.organizationId;
    const {
      accountType, partyId, branchId, productCode,
      openingBalance, interestRate, loanAmount, loanTerm,
      customFields
    } = context.propsValue;

    const trnId = crypto.randomUUID();

    const requestBody: any = {
      AcctType: accountType,
      PartyAcctRelInfo: {
        PartyRef: {
          PartyKeys: {
            PartyId: partyId,
          },
        },
      },
    };

    if (branchId || productCode) {
      requestBody.AcctInfo = {};
      if (branchId) requestBody.AcctInfo.BranchId = branchId;
      if (productCode) requestBody.AcctInfo.ProductCode = productCode;
    }

    if (accountType !== 'LOAN' && (openingBalance || interestRate)) {
      if (!requestBody.AcctInfo) requestBody.AcctInfo = {};
      requestBody.AcctInfo.DepositAcctInfo = {};
      if (openingBalance) requestBody.AcctInfo.DepositAcctInfo.OpeningBalance = openingBalance;
      if (interestRate) requestBody.AcctInfo.DepositAcctInfo.Rate = interestRate;
    }

    if (accountType === 'LOAN' && (loanAmount || loanTerm)) {
      if (!requestBody.AcctInfo) requestBody.AcctInfo = {};
      requestBody.AcctInfo.LoanAcctInfo = {};
      if (loanAmount) requestBody.AcctInfo.LoanAcctInfo.PrincipalAmt = loanAmount;
      if (loanTerm) requestBody.AcctInfo.LoanAcctInfo.TermMonths = loanTerm;
    }

    if (customFields) {
      Object.assign(requestBody, customFields);
    }

    const response = await httpClient.sendRequest({
      method: HttpMethod.POST,
      url: `${baseUrl}/banking/efx/v1/acctservice/accounts`,
      headers: {
        'accept': 'application/json',
        'EFXHeader': JSON.stringify({
          OrganizationId: organizationId,
          TrnId: trnId,
        }),
        'Content-Type': 'application/json',
      },
      body: requestBody,
    });

    return response.body;
  },
});
