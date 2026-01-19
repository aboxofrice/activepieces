import {
  createAction,
  Property,
} from '@activepieces/pieces-framework';
import { httpClient, HttpMethod } from '@activepieces/pieces-common';
import { fisHorizonAuth } from '../..';

// ============================================================================
// POST /transactions - Add a transaction between two given internal accounts
// ============================================================================
export const transactions_add = createAction({
  name: 'transactions_add',
  auth: fisHorizonAuth,
  displayName: 'Transactions - Add',
  description: 'Add a transaction between two given internal accounts. The Transfer Transaction Process allows money to be transferred from one internal account to another and memo post if requested.',
  props: {
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
    effectiveDate: Property.Number({
      displayName: 'Effective Date',
      description: 'Effective date in YYYYMMDD format (e.g., 20200101). If zeros are sent, the effective date is automatically set to the current processing date.',
      required: true,
    }),
    amount: Property.Number({
      displayName: 'Amount',
      description: 'Transaction amount. Format: 13 numeric digits with two decimal places (e.g., 12345678901.23).',
      required: true,
    }),
    elementSource: Property.ShortText({
      displayName: 'Element Source',
      description: 'Element Source (max 3 characters). ALK = ALLink. If blank, defaults to ALK.',
      required: false,
    }),
    batchNumber: Property.Number({
      displayName: 'Batch Number',
      description: 'Batch number (0-999999). Not used for GL Transactions.',
      required: false,
    }),
    elementSubSource: Property.ShortText({
      displayName: 'Element Sub Source',
      description: 'User defined value that identifies transmitting vendor (max 5 characters). For Fidelity Online Banking, this value must be "OLB".',
      required: false,
    }),
    userId: Property.ShortText({
      displayName: 'User ID',
      description: 'User ID (max 10 characters).',
      required: false,
    }),
    memoPostFlag: Property.StaticDropdown({
      displayName: 'Memo Post Flag',
      description: 'Whether to memo post the transactions. Only DD and SV transactions are memo posted.',
      required: false,
      options: {
        options: [
          { label: 'Y - Memo post the transactions', value: 'Y' },
          { label: 'N - Do not memo post the transactions', value: 'N' },
        ],
      },
    }),
    overrideAvailableBalance: Property.StaticDropdown({
      displayName: 'Override Available Balance',
      description: 'Override available balance check.',
      required: false,
      options: {
        options: [
          { label: 'Y - Yes, Override', value: 'Y' },
          { label: 'N - No', value: 'N' },
        ],
      },
    }),
    nextBusinessDay: Property.StaticDropdown({
      displayName: 'Next Business Day',
      description: 'Post to next business day or current processing day.',
      required: false,
      options: {
        options: [
          { label: 'Y - Post the next business day', value: 'Y' },
          { label: 'N - Post current processing day', value: 'N' },
          { label: '(blank) - Use field SITNBD in file SI24x7BK', value: '' },
        ],
      },
    }),
    addCreditHoldFlag: Property.StaticDropdown({
      displayName: 'Add Credit Hold Flag',
      description: 'When credit side of transfer is DD or SV, add a hold.',
      required: false,
      options: {
        options: [
          { label: 'Y - Add a Hold to the Credit side', value: 'Y' },
          { label: 'N - Do not Add a Hold', value: 'N' },
        ],
      },
    }),
    holdTypeOverride: Property.ShortText({
      displayName: 'Hold Type Override',
      description: 'Hold type override (max 2 characters). When blank, Hold Type is pulled from TP Middleware Control screen.',
      required: false,
    }),
    holdExpirationDate: Property.Number({
      displayName: 'Hold Expiration Date',
      description: 'Hold expiration date in CCYYMMDD format (e.g., 20200101).',
      required: false,
    }),
    holdPayeeDescription: Property.ShortText({
      displayName: 'Hold Payee Description',
      description: 'Hold payee description (max 25 characters). Required when Add Credit Hold Flag is "Y".',
      required: false,
    }),
    // Debit Transfer Details
    debitTransactionApplicationCode: Property.StaticDropdown({
      displayName: 'Debit - Application Code',
      description: 'Application code for the debit side.',
      required: false,
      options: {
        options: [
          { label: 'BX - Safe Deposit Box Account', value: 'BX' },
          { label: 'DD - Demand Deposit Account', value: 'DD' },
          { label: 'SV - Savings', value: 'SV' },
          { label: 'RR - Ready Reserve', value: 'RR' },
          { label: 'LN - Loan (Installment, Commercial, Real Estate)', value: 'LN' },
          { label: 'ML - Mortgage Loan', value: 'ML' },
          { label: 'GL - General Ledger', value: 'GL' },
        ],
      },
    }),
    debitBranch: Property.Number({
      displayName: 'Debit - Branch',
      description: 'Branch number for debit side (0-9999). Valid for GL application only.',
      required: false,
    }),
    debitCostCenter: Property.Number({
      displayName: 'Debit - Cost Center',
      description: 'Cost center number for debit side (0-9999). Valid for GL application only.',
      required: false,
    }),
    debitAccountNumber: Property.ShortText({
      displayName: 'Debit - Account Number',
      description: 'Account number for debit side (max 20 characters).',
      required: false,
    }),
    debitTransactionCode: Property.Number({
      displayName: 'Debit - Transaction Code',
      description: 'Transaction code for debit side (0-9999).',
      required: false,
    }),
    debitTransactionDescription1: Property.ShortText({
      displayName: 'Debit - Description 1',
      description: 'Transaction description 1 for debit side (max 40 characters).',
      required: false,
    }),
    debitTransactionDescription2: Property.ShortText({
      displayName: 'Debit - Description 2',
      description: 'Transaction description 2 for debit side (max 40 characters).',
      required: false,
    }),
    debitTransactionDescription3: Property.ShortText({
      displayName: 'Debit - Description 3',
      description: 'Transaction description 3 for debit side (max 40 characters).',
      required: false,
    }),
    debitTransactionDescription4: Property.ShortText({
      displayName: 'Debit - Description 4',
      description: 'Transaction description 4 for debit side (max 40 characters).',
      required: false,
    }),
    debitTransactionDescription5: Property.ShortText({
      displayName: 'Debit - Description 5',
      description: 'Transaction description 5 for debit side (max 40 characters).',
      required: false,
    }),
    debitTransactionDescription6: Property.ShortText({
      displayName: 'Debit - Description 6',
      description: 'Transaction description 6 for debit side (max 40 characters).',
      required: false,
    }),
    debitTransactionDescription7: Property.ShortText({
      displayName: 'Debit - Description 7',
      description: 'Transaction description 7 for debit side (max 40 characters).',
      required: false,
    }),
    debitSerialNumber: Property.Number({
      displayName: 'Debit - Serial Number',
      description: 'Serial number for debit side (0-999999999999999).',
      required: false,
    }),
    debitSequenceNumber: Property.ShortText({
      displayName: 'Debit - Sequence Number',
      description: 'Sequence number / trace number for debit side (max 30 characters). Right justified, zero filled.',
      required: false,
    }),
    // Credit Transfer Details
    creditTransactionApplicationCode: Property.StaticDropdown({
      displayName: 'Credit - Application Code',
      description: 'Application code for the credit side.',
      required: false,
      options: {
        options: [
          { label: 'BX - Safe Deposit Box Account', value: 'BX' },
          { label: 'DD - Demand Deposit Account', value: 'DD' },
          { label: 'SV - Savings', value: 'SV' },
          { label: 'RR - Ready Reserve', value: 'RR' },
          { label: 'LN - Loan (Installment, Commercial, Real Estate)', value: 'LN' },
          { label: 'ML - Mortgage Loan', value: 'ML' },
          { label: 'GL - General Ledger', value: 'GL' },
        ],
      },
    }),
    creditBranch: Property.Number({
      displayName: 'Credit - Branch',
      description: 'Branch number for credit side (0-9999). Valid for GL application only.',
      required: false,
    }),
    creditCostCenter: Property.Number({
      displayName: 'Credit - Cost Center',
      description: 'Cost center number for credit side (0-9999). Valid for GL application only.',
      required: false,
    }),
    creditAccountNumber: Property.ShortText({
      displayName: 'Credit - Account Number',
      description: 'Account number for credit side (max 20 characters).',
      required: false,
    }),
    creditTransactionCode: Property.Number({
      displayName: 'Credit - Transaction Code',
      description: 'Transaction code for credit side (0-9999).',
      required: false,
    }),
    creditTransactionDescription1: Property.ShortText({
      displayName: 'Credit - Description 1',
      description: 'Transaction description 1 for credit side (max 40 characters).',
      required: false,
    }),
    creditTransactionDescription2: Property.ShortText({
      displayName: 'Credit - Description 2',
      description: 'Transaction description 2 for credit side (max 40 characters).',
      required: false,
    }),
    creditTransactionDescription3: Property.ShortText({
      displayName: 'Credit - Description 3',
      description: 'Transaction description 3 for credit side (max 40 characters).',
      required: false,
    }),
    creditTransactionDescription4: Property.ShortText({
      displayName: 'Credit - Description 4',
      description: 'Transaction description 4 for credit side (max 40 characters).',
      required: false,
    }),
    creditTransactionDescription5: Property.ShortText({
      displayName: 'Credit - Description 5',
      description: 'Transaction description 5 for credit side (max 40 characters).',
      required: false,
    }),
    creditTransactionDescription6: Property.ShortText({
      displayName: 'Credit - Description 6',
      description: 'Transaction description 6 for credit side (max 40 characters).',
      required: false,
    }),
    creditTransactionDescription7: Property.ShortText({
      displayName: 'Credit - Description 7',
      description: 'Transaction description 7 for credit side (max 40 characters).',
      required: false,
    }),
    creditSerialNumber: Property.Number({
      displayName: 'Credit - Serial Number',
      description: 'Serial number for credit side (0-999999999999999).',
      required: false,
    }),
    creditSequenceNumber: Property.ShortText({
      displayName: 'Credit - Sequence Number',
      description: 'Sequence number / trace number for credit side (max 30 characters). Right justified, zero filled.',
      required: false,
    }),
  },
  async run(context) {
    const auth = context.auth as any;
    const baseUrl = auth['baseUrl'];
    const organizationId = auth['organizationId'];
    const {
      horizonAuthorization,
      sourceId,
      effectiveDate,
      amount,
      elementSource,
      batchNumber,
      elementSubSource,
      userId,
      memoPostFlag,
      overrideAvailableBalance,
      nextBusinessDay,
      addCreditHoldFlag,
      holdTypeOverride,
      holdExpirationDate,
      holdPayeeDescription,
      debitTransactionApplicationCode,
      debitBranch,
      debitCostCenter,
      debitAccountNumber,
      debitTransactionCode,
      debitTransactionDescription1,
      debitTransactionDescription2,
      debitTransactionDescription3,
      debitTransactionDescription4,
      debitTransactionDescription5,
      debitTransactionDescription6,
      debitTransactionDescription7,
      debitSerialNumber,
      debitSequenceNumber,
      creditTransactionApplicationCode,
      creditBranch,
      creditCostCenter,
      creditAccountNumber,
      creditTransactionCode,
      creditTransactionDescription1,
      creditTransactionDescription2,
      creditTransactionDescription3,
      creditTransactionDescription4,
      creditTransactionDescription5,
      creditTransactionDescription6,
      creditTransactionDescription7,
      creditSerialNumber,
      creditSequenceNumber,
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
      effectiveDate,
      amount,
    };

    if (elementSource !== undefined && elementSource !== null && elementSource !== '') {
      body['elementSource'] = elementSource;
    }
    if (batchNumber !== undefined && batchNumber !== null) {
      body['batchNumber'] = batchNumber;
    }
    if (elementSubSource !== undefined && elementSubSource !== null && elementSubSource !== '') {
      body['elementSubSource'] = elementSubSource;
    }
    if (userId !== undefined && userId !== null && userId !== '') {
      body['userId'] = userId;
    }
    if (memoPostFlag !== undefined && memoPostFlag !== null && memoPostFlag !== '') {
      body['memoPostFlag'] = memoPostFlag;
    }
    if (overrideAvailableBalance !== undefined && overrideAvailableBalance !== null && overrideAvailableBalance !== '') {
      body['overrideAvailableBalance'] = overrideAvailableBalance;
    }
    if (nextBusinessDay !== undefined && nextBusinessDay !== null) {
      body['nextBusinessDay'] = nextBusinessDay;
    }
    if (addCreditHoldFlag !== undefined && addCreditHoldFlag !== null && addCreditHoldFlag !== '') {
      body['addCreditHoldFlag'] = addCreditHoldFlag;
    }
    if (holdTypeOverride !== undefined && holdTypeOverride !== null && holdTypeOverride !== '') {
      body['holdTypeOverride'] = holdTypeOverride;
    }
    if (holdExpirationDate !== undefined && holdExpirationDate !== null) {
      body['holdExpirationDate'] = holdExpirationDate;
    }
    if (holdPayeeDescription !== undefined && holdPayeeDescription !== null && holdPayeeDescription !== '') {
      body['holdPayeeDescription'] = holdPayeeDescription;
    }

    // Build debit object if any debit fields are provided
    const debit: Record<string, unknown> = {};
    if (debitTransactionApplicationCode !== undefined && debitTransactionApplicationCode !== null && debitTransactionApplicationCode !== '') {
      debit['transactionApplicationCode'] = debitTransactionApplicationCode;
    }
    if (debitBranch !== undefined && debitBranch !== null) {
      debit['branch'] = debitBranch;
    }
    if (debitCostCenter !== undefined && debitCostCenter !== null) {
      debit['costCenter'] = debitCostCenter;
    }
    if (debitAccountNumber !== undefined && debitAccountNumber !== null && debitAccountNumber !== '') {
      debit['accountNumber'] = debitAccountNumber;
    }
    if (debitTransactionCode !== undefined && debitTransactionCode !== null) {
      debit['transactionCode'] = debitTransactionCode;
    }
    if (debitTransactionDescription1 !== undefined && debitTransactionDescription1 !== null && debitTransactionDescription1 !== '') {
      debit['transactionDescription1'] = debitTransactionDescription1;
    }
    if (debitTransactionDescription2 !== undefined && debitTransactionDescription2 !== null && debitTransactionDescription2 !== '') {
      debit['transactionDescription2'] = debitTransactionDescription2;
    }
    if (debitTransactionDescription3 !== undefined && debitTransactionDescription3 !== null && debitTransactionDescription3 !== '') {
      debit['transactionDescription3'] = debitTransactionDescription3;
    }
    if (debitTransactionDescription4 !== undefined && debitTransactionDescription4 !== null && debitTransactionDescription4 !== '') {
      debit['transactionDescription4'] = debitTransactionDescription4;
    }
    if (debitTransactionDescription5 !== undefined && debitTransactionDescription5 !== null && debitTransactionDescription5 !== '') {
      debit['transactionDescription5'] = debitTransactionDescription5;
    }
    if (debitTransactionDescription6 !== undefined && debitTransactionDescription6 !== null && debitTransactionDescription6 !== '') {
      debit['transactionDescription6'] = debitTransactionDescription6;
    }
    if (debitTransactionDescription7 !== undefined && debitTransactionDescription7 !== null && debitTransactionDescription7 !== '') {
      debit['transactionDescription7'] = debitTransactionDescription7;
    }
    if (debitSerialNumber !== undefined && debitSerialNumber !== null) {
      debit['serialNumber'] = debitSerialNumber;
    }
    if (debitSequenceNumber !== undefined && debitSequenceNumber !== null && debitSequenceNumber !== '') {
      debit['sequenceNumber'] = debitSequenceNumber;
    }
    if (Object.keys(debit).length > 0) {
      body['debit'] = debit;
    }

    // Build credit object if any credit fields are provided
    const credit: Record<string, unknown> = {};
    if (creditTransactionApplicationCode !== undefined && creditTransactionApplicationCode !== null && creditTransactionApplicationCode !== '') {
      credit['transactionApplicationCode'] = creditTransactionApplicationCode;
    }
    if (creditBranch !== undefined && creditBranch !== null) {
      credit['branch'] = creditBranch;
    }
    if (creditCostCenter !== undefined && creditCostCenter !== null) {
      credit['costCenter'] = creditCostCenter;
    }
    if (creditAccountNumber !== undefined && creditAccountNumber !== null && creditAccountNumber !== '') {
      credit['accountNumber'] = creditAccountNumber;
    }
    if (creditTransactionCode !== undefined && creditTransactionCode !== null) {
      credit['transactionCode'] = creditTransactionCode;
    }
    if (creditTransactionDescription1 !== undefined && creditTransactionDescription1 !== null && creditTransactionDescription1 !== '') {
      credit['transactionDescription1'] = creditTransactionDescription1;
    }
    if (creditTransactionDescription2 !== undefined && creditTransactionDescription2 !== null && creditTransactionDescription2 !== '') {
      credit['transactionDescription2'] = creditTransactionDescription2;
    }
    if (creditTransactionDescription3 !== undefined && creditTransactionDescription3 !== null && creditTransactionDescription3 !== '') {
      credit['transactionDescription3'] = creditTransactionDescription3;
    }
    if (creditTransactionDescription4 !== undefined && creditTransactionDescription4 !== null && creditTransactionDescription4 !== '') {
      credit['transactionDescription4'] = creditTransactionDescription4;
    }
    if (creditTransactionDescription5 !== undefined && creditTransactionDescription5 !== null && creditTransactionDescription5 !== '') {
      credit['transactionDescription5'] = creditTransactionDescription5;
    }
    if (creditTransactionDescription6 !== undefined && creditTransactionDescription6 !== null && creditTransactionDescription6 !== '') {
      credit['transactionDescription6'] = creditTransactionDescription6;
    }
    if (creditTransactionDescription7 !== undefined && creditTransactionDescription7 !== null && creditTransactionDescription7 !== '') {
      credit['transactionDescription7'] = creditTransactionDescription7;
    }
    if (creditSerialNumber !== undefined && creditSerialNumber !== null) {
      credit['serialNumber'] = creditSerialNumber;
    }
    if (creditSequenceNumber !== undefined && creditSequenceNumber !== null && creditSequenceNumber !== '') {
      credit['sequenceNumber'] = creditSequenceNumber;
    }
    if (Object.keys(credit).length > 0) {
      body['credit'] = credit;
    }

    const response = await httpClient.sendRequest({
      method: HttpMethod.POST,
      url: `${baseUrl}/transactions/v1/transactions`,
      headers,
      body,
    });

    return response.body;
  },
});

// ============================================================================
// POST /batch-transactions - Add a batch of transactions for given internal accounts
// ============================================================================
export const transactions_add_batch = createAction({
  name: 'transactions_add_batch',
  auth: fisHorizonAuth,
  displayName: 'Transactions - Add Batch',
  description: 'Add a batch of transactions for given internal accounts. This transaction is used to import a batch of transactions for internal accounts.',
  props: {
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
    subSource: Property.ShortText({
      displayName: 'Sub Source',
      description: 'User defined value that identifies transmitting vendor (max 5 characters). For Fidelity Online Banking, this value must be "OLB".',
      required: false,
    }),
    controlAmount: Property.Number({
      displayName: 'Control Amount',
      description: 'Total amount of debits or credits (the higher amount). Format: 13 numeric digits including two decimal places.',
      required: true,
    }),
    totalTransactions: Property.Number({
      displayName: 'Total Transactions',
      description: 'Total number of transactions defined as part of the entire batch (0-999999999).',
      required: true,
    }),
    totalNumberOfRecords: Property.Number({
      displayName: 'Total Number of Records',
      description: 'Total number of records in this input string (0-999).',
      required: true,
    }),
    userId: Property.ShortText({
      displayName: 'User ID',
      description: 'User ID (max 10 characters).',
      required: false,
    }),
    overrideNsfBalances: Property.StaticDropdown({
      displayName: 'Override NSF Balances',
      description: 'Override non-sufficient funds.',
      required: true,
      options: {
        options: [
          { label: 'Y - Yes, Override', value: 'Y' },
          { label: 'N - No', value: 'N' },
        ],
      },
    }),
    nextBusinessDayTransaction: Property.StaticDropdown({
      displayName: 'Next Business Day Transaction',
      description: 'Post to next business day or current processing day.',
      required: true,
      options: {
        options: [
          { label: 'Y - Post the next business day', value: 'Y' },
          { label: 'N - Post current processing day', value: 'N' },
          { label: '(blank) - Use field SITNBD in file SI24x7BK', value: '' },
        ],
      },
    }),
    moreFlag: Property.StaticDropdown({
      displayName: 'More Flag',
      description: 'Indicates if there are more records.',
      required: true,
      options: {
        options: [
          { label: 'Y - There are more records', value: 'Y' },
          { label: 'N - There are no more records', value: 'N' },
        ],
      },
    }),
    firstNext: Property.StaticDropdown({
      displayName: 'First/Next',
      description: 'First request or next request for additional transactions.',
      required: true,
      options: {
        options: [
          { label: 'F - First request', value: 'F' },
          { label: 'N - Next request for additional transactions', value: 'N' },
        ],
      },
    }),
    transactionSequence: Property.Json({
      displayName: 'Transaction Sequence',
      description: 'Array of transaction objects. Each object should contain: amount, applicationCode (CD/DD/GL/RR/SV/BX/IR/LN/ML), effectiveDate (YYYYMMDD), account, transactionCode. Optional: branch, centerNumber, transactionDescription1-7, serialNumber, traceNumber, maintenanceDate, maintenanceTime.',
      required: false,
    }),
  },
  async run(context) {
    const auth = context.auth as any;
    const baseUrl = auth['baseUrl'];
    const organizationId = auth['organizationId'];
    const {
      horizonAuthorization,
      sourceId,
      subSource,
      controlAmount,
      totalTransactions,
      totalNumberOfRecords,
      userId,
      overrideNsfBalances,
      nextBusinessDayTransaction,
      moreFlag,
      firstNext,
      transactionSequence,
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
      controlAmount,
      totalTransactions,
      totalNumberOfRecords,
      overrideNsfBalances,
      nextBusinessDayTransaction,
      moreFlag,
      firstNext,
    };

    if (subSource !== undefined && subSource !== null && subSource !== '') {
      body['subSource'] = subSource;
    }
    if (userId !== undefined && userId !== null && userId !== '') {
      body['userId'] = userId;
    }
    if (transactionSequence !== undefined && transactionSequence !== null) {
      body['transactionSequence'] = transactionSequence;
    }

    const response = await httpClient.sendRequest({
      method: HttpMethod.POST,
      url: `${baseUrl}/transactions/v1/batch-transactions`,
      headers,
      body,
    });

    return response.body;
  },
});

// ============================================================================
// POST /memo-transactions - Add a memo post to a given account
// ============================================================================
export const transactions_add_memo = createAction({
  name: 'transactions_add_memo',
  auth: fisHorizonAuth,
  displayName: 'Transactions - Add Memo',
  description: 'Add a memo post to a given account. This transaction is designed to add a memo post to a given account.',
  props: {
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
    applicationCode: Property.StaticDropdown({
      displayName: 'Application Code',
      description: 'Application code. All applications write to TELTHS file, only DD/SV/LN/CD/IR update balances.',
      required: true,
      options: {
        options: [
          { label: 'DD - Demand Deposits', value: 'DD' },
          { label: 'SV - Savings', value: 'SV' },
          { label: 'LN - Loans', value: 'LN' },
          { label: 'CD - Certificate', value: 'CD' },
          { label: 'IR - Retirement', value: 'IR' },
        ],
      },
    }),
    accountNumber: Property.ShortText({
      displayName: 'Account Number',
      description: 'Account number (max 20 characters).',
      required: true,
    }),
    transactionAmount: Property.Number({
      displayName: 'Transaction Amount',
      description: 'Transaction amount. This amount should always be positive.',
      required: true,
    }),
    transactionPostDate: Property.ShortText({
      displayName: 'Transaction Post Date',
      description: 'Transaction post date in YYYYMMDD format (e.g., 20210630).',
      required: false,
    }),
    transactionCode: Property.ShortText({
      displayName: 'Transaction Code',
      description: 'Transaction code (max 4 characters). If zeros is sent, 0020 is used when Debit or Credit equals "C" and 0090 when "D".',
      required: false,
    }),
    debitCreditFlag: Property.StaticDropdown({
      displayName: 'Debit/Credit Flag',
      description: 'Transaction type - Debit or Credit. Only one of Transaction Code or Debit/Credit Flag is required.',
      required: false,
      options: {
        options: [
          { label: 'D - Debit', value: 'D' },
          { label: 'C - Credit', value: 'C' },
        ],
      },
    }),
    transactionCheckNumber: Property.Number({
      displayName: 'Transaction Check Number',
      description: 'Check number of the transaction, if applicable (0-999999999999999).',
      required: false,
    }),
    transactionDescription1: Property.ShortText({
      displayName: 'Transaction Description 1',
      description: 'Description line 1 of the transaction (max 40 characters).',
      required: false,
    }),
    transactionDescription2: Property.ShortText({
      displayName: 'Transaction Description 2',
      description: 'Description line 2 of the transaction (max 40 characters).',
      required: false,
    }),
    updateBalanceFile: Property.StaticDropdown({
      displayName: 'Update Balance File',
      description: 'Updates available balance. When "Y" or blank: DD/SV updates Memo Debit/Credits today fields, CD/IR updates Available balance and Memo Debit/Credits today fields.',
      required: false,
      options: {
        options: [
          { label: 'Y - Update Balance Files', value: 'Y' },
          { label: 'N - Do not update Balance Files', value: 'N' },
          { label: '(blank) - Update Balance Files', value: '' },
        ],
      },
    }),
    updateTellerActivityFile: Property.StaticDropdown({
      displayName: 'Update Teller Activity File',
      description: 'All applications will write to/update TELTHS file.',
      required: false,
      options: {
        options: [
          { label: 'Y - Update TELTHS', value: 'Y' },
          { label: 'N - Do not update TELTHS', value: 'N' },
          { label: '(blank) - Update TELTHS', value: '' },
        ],
      },
    }),
    updateCTFABalance: Property.StaticDropdown({
      displayName: 'Update CTFA Balance',
      description: 'Updates available balance. CTFABAL is the Available Balance file on the core. Applies to DD/SV and LN accounts only.',
      required: false,
      options: {
        options: [
          { label: 'Y - Update CTFABAL', value: 'Y' },
          { label: 'N - Do not update CTFABAL', value: 'N' },
          { label: '(blank) - Update CTFABAL', value: '' },
        ],
      },
    }),
    nextDayMode: Property.StaticDropdown({
      displayName: 'Next Day Mode',
      description: 'When Next Day Mode is used (Y or X), the API will set the transaction date to be the Next Processing Date from the HORIZON Calendar.',
      required: false,
      options: {
        options: [
          { label: 'Y - Next Day Mode and write to DDNBDM file', value: 'Y' },
          { label: 'X - Next Day Mode, but do not write to DDNBDM file', value: 'X' },
          { label: '(blank) - Current Day Mode', value: '' },
        ],
      },
    }),
    ignoreDynamicTransferRelationship: Property.StaticDropdown({
      displayName: 'Ignore Dynamic Transfer Relationship',
      description: 'If ignoring Dynamic Transfer Relationships, then Dynamic Transfer will not be generated.',
      required: false,
      options: {
        options: [
          { label: 'I - Ignore Dynamic Transfer Relationships', value: 'I' },
          { label: '(blank) - Do not Ignore', value: '' },
        ],
      },
    }),
    availableBalanceCalculationOverride: Property.StaticDropdown({
      displayName: 'Available Balance Calculation Override',
      description: 'Override for available balance calculation. Only use if the Account availability was retrieved by calling the Available Balance API with one of these values.',
      required: false,
      options: {
        options: [
          { label: 'A - Current Balance - Holds', value: 'A' },
          { label: 'B - Current Balance - Holds - Bank Float', value: 'B' },
          { label: 'C - Current Balance - Bank Float', value: 'C' },
          { label: 'D - Current Balance - Holds - Customer Float', value: 'D' },
          { label: 'E - Current Balance - Customer Float', value: 'E' },
          { label: 'F - Current Balance', value: 'F' },
          { label: '(blank) - Use Avail Calc Cd from bank control records', value: '' },
        ],
      },
    }),
    includeRROverride: Property.StaticDropdown({
      displayName: 'Include RR Override',
      description: 'Indicates whether the Ready Reserve should be included in Available Balance.',
      required: false,
      options: {
        options: [
          { label: 'Y - Include DD\'s RR Avail in Available Balance', value: 'Y' },
          { label: 'N - Do not include DD\'s RR Avail', value: 'N' },
          { label: '(blank) - Include DD\'s RR Avail in Available Balance', value: '' },
        ],
      },
    }),
    includeODOverride: Property.StaticDropdown({
      displayName: 'Include OD Override',
      description: 'Indicates whether the OD Amount should be included in the Available Balance. Applies to DD & SV only.',
      required: false,
      options: {
        options: [
          { label: 'Y - Include OD Amount in Available Balance', value: 'Y' },
          { label: 'N - Do not include OD Amount', value: 'N' },
          { label: '(blank) - Use Account Type Default', value: '' },
        ],
      },
    }),
    subSource: Property.ShortText({
      displayName: 'Sub Source',
      description: 'Transaction sub source (max 5 characters). For HORIZON channels, the Sub-Source of the Memo Post transaction must be the same as the Source of the real transaction.',
      required: false,
    }),
    batchId: Property.ShortText({
      displayName: 'Batch ID',
      description: 'Transaction batch ID (max 6 characters).',
      required: false,
    }),
    traceNumber: Property.ShortText({
      displayName: 'Trace Number',
      description: 'Transaction trace number to facilitate uniqueness of an incoming transaction (max 30 characters).',
      required: false,
    }),
    amountToAvailableBalance: Property.Number({
      displayName: 'Amount to Available Balance',
      description: 'Amount used to update DD/SV/CD/IR Available Balance, Memo Debits, and Credits today fields. Positive increases, negative decreases.',
      required: false,
    }),
    amountToCurrentBalance: Property.Number({
      displayName: 'Amount to Current Balance',
      description: 'Amount used to write to TELTHS and in the calculation of the Running Current Balance. Positive increases, negative decreases.',
      required: false,
    }),
  },
  async run(context) {
    const auth = context.auth as any;
    const baseUrl = auth['baseUrl'];
    const organizationId = auth['organizationId'];
    const {
      horizonAuthorization,
      sourceId,
      applicationCode,
      accountNumber,
      transactionAmount,
      transactionPostDate,
      transactionCode,
      debitCreditFlag,
      transactionCheckNumber,
      transactionDescription1,
      transactionDescription2,
      updateBalanceFile,
      updateTellerActivityFile,
      updateCTFABalance,
      nextDayMode,
      ignoreDynamicTransferRelationship,
      availableBalanceCalculationOverride,
      includeRROverride,
      includeODOverride,
      subSource,
      batchId,
      traceNumber,
      amountToAvailableBalance,
      amountToCurrentBalance,
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
      applicationCode,
      accountNumber,
      transactionAmount,
    };

    if (transactionPostDate !== undefined && transactionPostDate !== null && transactionPostDate !== '') {
      body['transactionPostDate'] = transactionPostDate;
    }
    if (transactionCode !== undefined && transactionCode !== null && transactionCode !== '') {
      body['transactionCode'] = transactionCode;
    }
    if (debitCreditFlag !== undefined && debitCreditFlag !== null && debitCreditFlag !== '') {
      body['debitCreditFlag'] = debitCreditFlag;
    }
    if (transactionCheckNumber !== undefined && transactionCheckNumber !== null) {
      body['transactionCheckNumber'] = transactionCheckNumber;
    }
    if (transactionDescription1 !== undefined && transactionDescription1 !== null && transactionDescription1 !== '') {
      body['transactionDescription1'] = transactionDescription1;
    }
    if (transactionDescription2 !== undefined && transactionDescription2 !== null && transactionDescription2 !== '') {
      body['transactionDescription2'] = transactionDescription2;
    }
    if (updateBalanceFile !== undefined && updateBalanceFile !== null) {
      body['updateBalanceFile'] = updateBalanceFile;
    }
    if (updateTellerActivityFile !== undefined && updateTellerActivityFile !== null) {
      body['updateTellerActivityFile'] = updateTellerActivityFile;
    }
    if (updateCTFABalance !== undefined && updateCTFABalance !== null) {
      body['updateCTFABalance'] = updateCTFABalance;
    }
    if (nextDayMode !== undefined && nextDayMode !== null) {
      body['nextDayMode'] = nextDayMode;
    }
    if (ignoreDynamicTransferRelationship !== undefined && ignoreDynamicTransferRelationship !== null) {
      body['ignoreDynamicTransferRelationship'] = ignoreDynamicTransferRelationship;
    }
    if (availableBalanceCalculationOverride !== undefined && availableBalanceCalculationOverride !== null) {
      body['availableBalanceCalculationOverride'] = availableBalanceCalculationOverride;
    }
    if (includeRROverride !== undefined && includeRROverride !== null) {
      body['includeRROverride'] = includeRROverride;
    }
    if (includeODOverride !== undefined && includeODOverride !== null) {
      body['includeODOverride'] = includeODOverride;
    }
    if (subSource !== undefined && subSource !== null && subSource !== '') {
      body['subSource'] = subSource;
    }
    if (batchId !== undefined && batchId !== null && batchId !== '') {
      body['batchId'] = batchId;
    }
    if (traceNumber !== undefined && traceNumber !== null && traceNumber !== '') {
      body['traceNumber'] = traceNumber;
    }
    if (amountToAvailableBalance !== undefined && amountToAvailableBalance !== null) {
      body['amountToAvailableBalance'] = amountToAvailableBalance;
    }
    if (amountToCurrentBalance !== undefined && amountToCurrentBalance !== null) {
      body['amountToCurrentBalance'] = amountToCurrentBalance;
    }

    const response = await httpClient.sendRequest({
      method: HttpMethod.POST,
      url: `${baseUrl}/transactions/v1/memo-transactions`,
      headers,
      body,
    });

    return response.body;
  },
});

// ============================================================================
// POST /memo-transactions-delete - Remove a memo post from a given account
// ============================================================================
export const transactions_delete_memo = createAction({
  name: 'transactions_delete_memo',
  auth: fisHorizonAuth,
  displayName: 'Transactions - Delete Memo',
  description: 'Remove a memo post from a given account. This transaction is designed to remove a memo post from a given account.',
  props: {
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
    applicationCode: Property.StaticDropdown({
      displayName: 'Application Code',
      description: 'Application code. All applications write to TELTHS file, only DD/SV/LN/CD/IR update balances.',
      required: true,
      options: {
        options: [
          { label: 'DD - Demand Deposits', value: 'DD' },
          { label: 'SV - Savings', value: 'SV' },
          { label: 'LN - Loans', value: 'LN' },
          { label: 'CD - Certificate', value: 'CD' },
          { label: 'IR - Retirement', value: 'IR' },
        ],
      },
    }),
    accountNumber: Property.ShortText({
      displayName: 'Account Number',
      description: 'Account number (max 20 characters).',
      required: true,
    }),
    transactionAmount: Property.Number({
      displayName: 'Transaction Amount',
      description: 'Transaction amount. This amount should always be positive.',
      required: true,
    }),
    deleteMode: Property.StaticDropdown({
      displayName: 'Delete Mode',
      description: 'Delete mode. Error Correct mode requires all input parameters match the original transaction EXACTLY.',
      required: true,
      options: {
        options: [
          { label: 'E - Error Correct Mode', value: 'E' },
          { label: 'D - EFT PreAuth Delete Mode', value: 'D' },
        ],
      },
    }),
    transactionPostDate: Property.ShortText({
      displayName: 'Transaction Post Date',
      description: 'Transaction post date in YYYYMMDD format (e.g., 20210630).',
      required: false,
    }),
    transactionCode: Property.ShortText({
      displayName: 'Transaction Code',
      description: 'Transaction code (max 4 characters).',
      required: false,
    }),
    debitCreditFlag: Property.StaticDropdown({
      displayName: 'Debit/Credit Flag',
      description: 'Transaction type - Debit or Credit.',
      required: false,
      options: {
        options: [
          { label: 'D - Debit', value: 'D' },
          { label: 'C - Credit', value: 'C' },
        ],
      },
    }),
    transactionCheckNumber: Property.Number({
      displayName: 'Transaction Check Number',
      description: 'Check number of the transaction, if applicable (0-999999999999999).',
      required: false,
    }),
    transactionDescription1: Property.ShortText({
      displayName: 'Transaction Description 1',
      description: 'Description line 1 of the transaction (max 40 characters).',
      required: false,
    }),
    transactionDescription2: Property.ShortText({
      displayName: 'Transaction Description 2',
      description: 'Description line 2 of the transaction (max 40 characters).',
      required: false,
    }),
    updateBalanceFile: Property.StaticDropdown({
      displayName: 'Update Balance File',
      description: 'Updates available balance.',
      required: false,
      options: {
        options: [
          { label: 'Y - Update Balance Files', value: 'Y' },
          { label: 'N - Do not update Balance Files', value: 'N' },
          { label: '(blank) - Update Balance Files', value: '' },
        ],
      },
    }),
    updateTellerActivityFile: Property.StaticDropdown({
      displayName: 'Update Teller Activity File',
      description: 'All applications will write to/update TELTHS file.',
      required: false,
      options: {
        options: [
          { label: 'Y - Update TELTHS', value: 'Y' },
          { label: 'N - Do not update TELTHS', value: 'N' },
          { label: '(blank) - Update TELTHS', value: '' },
        ],
      },
    }),
    updateCTFABalance: Property.StaticDropdown({
      displayName: 'Update CTFA Balance',
      description: 'Updates available balance. CTFABAL is the Available Balance file on the core. Applies to DD/SV and LN accounts only.',
      required: false,
      options: {
        options: [
          { label: 'Y - Update CTFABAL', value: 'Y' },
          { label: 'N - Do not update CTFABAL', value: 'N' },
          { label: '(blank) - Update CTFABAL', value: '' },
        ],
      },
    }),
    nextDayMode: Property.StaticDropdown({
      displayName: 'Next Day Mode',
      description: 'When Next Day Mode is used (Y or X), the API will set the transaction date to be the Next Processing Date from the HORIZON Calendar.',
      required: false,
      options: {
        options: [
          { label: 'Y - Next Day Mode and write to DDNBDM file', value: 'Y' },
          { label: 'X - Next Day Mode, but do not write to DDNBDM file', value: 'X' },
          { label: '(blank) - Current Day Mode', value: '' },
        ],
      },
    }),
    ignoreDynamicTransferRelationship: Property.StaticDropdown({
      displayName: 'Ignore Dynamic Transfer Relationship',
      description: 'If ignoring Dynamic Transfer Relationships, then Dynamic Transfer will not be generated.',
      required: false,
      options: {
        options: [
          { label: 'I - Ignore Dynamic Transfer Relationships', value: 'I' },
          { label: '(blank) - Do not Ignore', value: '' },
        ],
      },
    }),
    availableBalanceCalculationOverride: Property.StaticDropdown({
      displayName: 'Available Balance Calculation Override',
      description: 'Override for available balance calculation.',
      required: false,
      options: {
        options: [
          { label: 'A - Current Balance - Holds', value: 'A' },
          { label: 'B - Current Balance - Holds - Bank Float', value: 'B' },
          { label: 'C - Current Balance - Bank Float', value: 'C' },
          { label: 'D - Current Balance - Holds - Customer Float', value: 'D' },
          { label: 'E - Current Balance - Customer Float', value: 'E' },
          { label: 'F - Current Balance', value: 'F' },
          { label: '(blank) - Use Avail Calc Cd from bank control records', value: '' },
        ],
      },
    }),
    includeRROverride: Property.StaticDropdown({
      displayName: 'Include RR Override',
      description: 'Indicates whether the Ready Reserve should be included in Available Balance.',
      required: false,
      options: {
        options: [
          { label: 'Y - Include DD\'s RR Avail in Available Balance', value: 'Y' },
          { label: 'N - Do not include DD\'s RR Avail', value: 'N' },
          { label: '(blank) - Include DD\'s RR Avail in Available Balance', value: '' },
        ],
      },
    }),
    includeODOverride: Property.StaticDropdown({
      displayName: 'Include OD Override',
      description: 'Indicates whether the OD Amount should be included in the Available Balance. Applies to DD & SV only.',
      required: false,
      options: {
        options: [
          { label: 'Y - Include OD Amount in Available Balance', value: 'Y' },
          { label: 'N - Do not include OD Amount', value: 'N' },
          { label: '(blank) - Use Account Type Default', value: '' },
        ],
      },
    }),
    subSource: Property.ShortText({
      displayName: 'Sub Source',
      description: 'Transaction sub source (max 5 characters).',
      required: false,
    }),
    batchId: Property.ShortText({
      displayName: 'Batch ID',
      description: 'Transaction batch ID (max 6 characters).',
      required: false,
    }),
    traceNumber: Property.ShortText({
      displayName: 'Trace Number',
      description: 'Transaction trace number to facilitate uniqueness (max 30 characters).',
      required: false,
    }),
    amountToAvailableBalance: Property.Number({
      displayName: 'Amount to Available Balance',
      description: 'Amount used to update DD/SV/CD/IR Available Balance, Memo Debits, and Credits today fields.',
      required: false,
    }),
    amountToCurrentBalance: Property.Number({
      displayName: 'Amount to Current Balance',
      description: 'Amount used to write to TELTHS and in the calculation of the Running Current Balance.',
      required: false,
    }),
  },
  async run(context) {
    const auth = context.auth as any;
    const baseUrl = auth['baseUrl'];
    const organizationId = auth['organizationId'];
    const {
      horizonAuthorization,
      sourceId,
      applicationCode,
      accountNumber,
      transactionAmount,
      deleteMode,
      transactionPostDate,
      transactionCode,
      debitCreditFlag,
      transactionCheckNumber,
      transactionDescription1,
      transactionDescription2,
      updateBalanceFile,
      updateTellerActivityFile,
      updateCTFABalance,
      nextDayMode,
      ignoreDynamicTransferRelationship,
      availableBalanceCalculationOverride,
      includeRROverride,
      includeODOverride,
      subSource,
      batchId,
      traceNumber,
      amountToAvailableBalance,
      amountToCurrentBalance,
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
      applicationCode,
      accountNumber,
      transactionAmount,
      deleteMode,
    };

    if (transactionPostDate !== undefined && transactionPostDate !== null && transactionPostDate !== '') {
      body['transactionPostDate'] = transactionPostDate;
    }
    if (transactionCode !== undefined && transactionCode !== null && transactionCode !== '') {
      body['transactionCode'] = transactionCode;
    }
    if (debitCreditFlag !== undefined && debitCreditFlag !== null && debitCreditFlag !== '') {
      body['debitCreditFlag'] = debitCreditFlag;
    }
    if (transactionCheckNumber !== undefined && transactionCheckNumber !== null) {
      body['transactionCheckNumber'] = transactionCheckNumber;
    }
    if (transactionDescription1 !== undefined && transactionDescription1 !== null && transactionDescription1 !== '') {
      body['transactionDescription1'] = transactionDescription1;
    }
    if (transactionDescription2 !== undefined && transactionDescription2 !== null && transactionDescription2 !== '') {
      body['transactionDescription2'] = transactionDescription2;
    }
    if (updateBalanceFile !== undefined && updateBalanceFile !== null) {
      body['updateBalanceFile'] = updateBalanceFile;
    }
    if (updateTellerActivityFile !== undefined && updateTellerActivityFile !== null) {
      body['updateTellerActivityFile'] = updateTellerActivityFile;
    }
    if (updateCTFABalance !== undefined && updateCTFABalance !== null) {
      body['updateCTFABalance'] = updateCTFABalance;
    }
    if (nextDayMode !== undefined && nextDayMode !== null) {
      body['nextDayMode'] = nextDayMode;
    }
    if (ignoreDynamicTransferRelationship !== undefined && ignoreDynamicTransferRelationship !== null) {
      body['ignoreDynamicTransferRelationship'] = ignoreDynamicTransferRelationship;
    }
    if (availableBalanceCalculationOverride !== undefined && availableBalanceCalculationOverride !== null) {
      body['availableBalanceCalculationOverride'] = availableBalanceCalculationOverride;
    }
    if (includeRROverride !== undefined && includeRROverride !== null) {
      body['includeRROverride'] = includeRROverride;
    }
    if (includeODOverride !== undefined && includeODOverride !== null) {
      body['includeODOverride'] = includeODOverride;
    }
    if (subSource !== undefined && subSource !== null && subSource !== '') {
      body['subSource'] = subSource;
    }
    if (batchId !== undefined && batchId !== null && batchId !== '') {
      body['batchId'] = batchId;
    }
    if (traceNumber !== undefined && traceNumber !== null && traceNumber !== '') {
      body['traceNumber'] = traceNumber;
    }
    if (amountToAvailableBalance !== undefined && amountToAvailableBalance !== null) {
      body['amountToAvailableBalance'] = amountToAvailableBalance;
    }
    if (amountToCurrentBalance !== undefined && amountToCurrentBalance !== null) {
      body['amountToCurrentBalance'] = amountToCurrentBalance;
    }

    const response = await httpClient.sendRequest({
      method: HttpMethod.POST,
      url: `${baseUrl}/transactions/v1/memo-transactions-delete`,
      headers,
      body,
    });

    return response.body;
  },
});
