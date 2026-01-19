import {
  createAction,
  Property,
} from '@activepieces/pieces-framework';
import { httpClient, HttpMethod } from '@activepieces/pieces-common';
import { fisHorizonAuth } from '../..';

// ============================================================================
// POST Add Loan Account
// ============================================================================
/**
 * Loans - Add Loan Account
 * POST /accounts/loans
 * Add a new loan account. Before executing this transaction, the customer and
 * account number must exist in Relationship Management.
 */
export const loans_add = createAction({
  name: 'loans_add',
  auth: fisHorizonAuth,
  displayName: 'Loans - Add Loan Account',
  description: 'Add a new loan account. Before executing this transaction, the customer and account number must exist in Relationship Management.',
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
    // ==========================================================================
    // Base Loan Information (Required)
    // ==========================================================================
    productType: Property.ShortText({
      displayName: 'Product Type',
      description: 'Product Code (max 3 characters). User Defined.',
      required: true,
    }),
    accountNumber: Property.ShortText({
      displayName: 'Account Number',
      description: 'Account number (max 10 characters).',
      required: true,
    }),
    customerId: Property.ShortText({
      displayName: 'Customer ID',
      description: 'Customer Number. Right-justified, zero filled (max 14 characters).',
      required: true,
    }),
    branchNumber: Property.ShortText({
      displayName: 'Branch Number',
      description: 'Branch Number (max 3 characters).',
      required: true,
    }),
    systemType: Property.StaticDropdown({
      displayName: 'System Type',
      description: 'The type of loan system.',
      required: true,
      options: {
        options: [
          { label: '1 - Note', value: '1' },
          { label: '2 - Commitment', value: '2' },
          { label: '3 - Line of Credit', value: '3' },
          { label: '4 - Letter of Credit', value: '4' },
          { label: '5 - Revolving Line of Credit', value: '5' },
        ],
      },
    }),
    generalLedgerType: Property.ShortText({
      displayName: 'General Ledger Type',
      description: 'The general ledger type (4 digits, 0001-9999). Identifies the GL interface account in HORIZON General Ledger.',
      required: true,
    }),
    applicationCode: Property.StaticDropdown({
      displayName: 'Application Code',
      description: 'The application code for the loan.',
      required: true,
      options: {
        options: [
          { label: 'CC - Charge off-Commercial Loan', value: 'CC' },
          { label: 'CI - Charge off-Installment Loan', value: 'CI' },
          { label: 'CL - Commercial Loans', value: 'CL' },
          { label: 'CM - Charge off-Mortgage', value: 'CM' },
          { label: 'CR - Charge off-Real Estate', value: 'CR' },
          { label: 'IL - Installment Loans', value: 'IL' },
          { label: 'RE - Real Estate Secured', value: 'RE' },
        ],
      },
    }),
    demandFlag: Property.StaticDropdown({
      displayName: 'Demand Flag',
      description: 'Indicates if this is a demand loan.',
      required: false,
      options: {
        options: [
          { label: 'Blank - Not a Demand Loan', value: '' },
          { label: 'D - Demand Loan', value: 'D' },
          { label: 'M - Demand with Maturity', value: 'M' },
        ],
      },
    }),
    currentLoanAmount: Property.Number({
      displayName: 'Current Loan Amount',
      description: 'Current Loan Amount (max 999999999.99).',
      required: true,
    }),
    currentNoteDate: Property.ShortText({
      displayName: 'Current Note Date',
      description: 'Current Note Date (Format: CCYYMMDD).',
      required: true,
    }),
    currentNetProceed: Property.Number({
      displayName: 'Current Net Proceed',
      description: 'Current Net Proceed (max 999999999.99).',
      required: true,
    }),
    currentMaturityDate: Property.ShortText({
      displayName: 'Current Maturity Date',
      description: 'Required for all loan types if demandFlag is not D (Format: CCYYMMDD).',
      required: false,
    }),
    creditLineExpiration: Property.ShortText({
      displayName: 'Credit Line Expiration',
      description: 'Required if systemType is 5 (Format: CCYYMMDD).',
      required: false,
    }),
    firstPaymentDate: Property.ShortText({
      displayName: 'First Payment Date',
      description: 'First Payment Date (Format: CCYYMMDD).',
      required: true,
    }),
    interestRate: Property.Number({
      displayName: 'Interest Rate',
      description: 'Interest Rate (must be under 100%). Example: 5% = 0.0500000, 99% = 0.9900000.',
      required: true,
    }),
    annualPercentRate: Property.Number({
      displayName: 'Annual Percent Rate',
      description: 'APR (must be under 1000%). Example: 5% = 0.05000000, 100% = 1.00000000.',
      required: false,
    }),
    prepaymentPenalty: Property.ShortText({
      displayName: 'Prepayment Penalty',
      description: 'Prepayment Penalty (max 4 characters). User Defined.',
      required: false,
    }),
    minimumFinancialCharges: Property.Number({
      displayName: 'Minimum Financial Charges',
      description: 'Minimum Financial Charges (max 999999999.99).',
      required: false,
    }),
    maximumLateChargeOverride: Property.Number({
      displayName: 'Maximum Late Charge Override',
      description: 'Maximum Late Charge Override (max 999999999.99).',
      required: false,
    }),
    maximumLateChargeLoanToDate: Property.Number({
      displayName: 'Maximum Late Charges Loan To Date',
      description: 'Maximum Late Charges Loan To Date (max 999999999.99).',
      required: false,
    }),
    censusTract: Property.ShortText({
      displayName: 'Census Tract',
      description: 'Census tract number (max 8 characters).',
      required: false,
    }),
    paySplitOption: Property.StaticDropdown({
      displayName: 'Pay Split Option',
      description: 'Pay split option for the loan.',
      required: true,
      options: {
        options: [
          { label: '1 - Collect to date of payment', value: '1' },
          { label: '2 - Collect as billed', value: '2' },
          { label: '3 - Collect for scheduled balancing loans', value: '3' },
        ],
      },
    }),
    billOption: Property.StaticDropdown({
      displayName: 'Bill Option',
      description: 'Billing option for the loan.',
      required: true,
      options: {
        options: [
          { label: '0 - Do not send bills', value: '0' },
          { label: '1 - Send all bills', value: '1' },
          { label: '2 - Send final bill only', value: '2' },
          { label: '3 - Coupons used, do not bill', value: '3' },
          { label: '4 - Coupons used, send final bill', value: '4' },
          { label: '5 - ATS used, do not bill', value: '5' },
          { label: '6 - ATS used, send final bill', value: '6' },
          { label: '7 - ACH used, do not bill', value: '7' },
          { label: '8 - ACH used, send final bill', value: '8' },
          { label: '9 - ATS used, send notice', value: '9' },
        ],
      },
    }),
    yearBase: Property.StaticDropdown({
      displayName: 'Year Base',
      description: 'Year base calculation method.',
      required: true,
      options: {
        options: [
          { label: '0 - Actual/365', value: 0 },
          { label: '1 - 360/365', value: 1 },
          { label: '2 - 360/360', value: 2 },
          { label: '3 - Actual/360', value: 3 },
        ],
      },
    }),
    lateChargeCode: Property.StaticDropdown({
      displayName: 'Late Charge Code',
      description: 'Late charge calculation method.',
      required: true,
      options: {
        options: [
          { label: '0 - No Late Charge', value: '0' },
          { label: '1 - % of Payment Remaining', value: '1' },
          { label: '2 - % of Balance', value: '2' },
          { label: '3 - Flat Amount', value: '3' },
          { label: '4 - % of Regular Payment', value: '4' },
          { label: '5 - % of Remaining P & I (pay split 2 & 3)', value: '5' },
        ],
      },
    }),
    lateChargeCollectionMethod: Property.StaticDropdown({
      displayName: 'Late Charge Collection Method',
      description: 'Late charge collection method.',
      required: true,
      options: {
        options: [
          { label: 'A - From Accumulated Balance', value: 'A' },
          { label: 'B - Based on Billed Amount', value: 'B' },
        ],
      },
    }),
    ticklerCode: Property.ShortText({
      displayName: 'Tickler Code',
      description: 'Tickler Code (1 character). User Defined.',
      required: false,
    }),
    creditBureauAccount: Property.ShortText({
      displayName: 'Credit Bureau Account',
      description: 'Credit Bureau Account Type Code (2 characters). See API docs for valid values.',
      required: true,
    }),
    creditRiskCode: Property.ShortText({
      displayName: 'Credit Risk Code',
      description: 'Credit Risk Code (max 5 characters). User Defined.',
      required: false,
    }),
    callReportCode: Property.ShortText({
      displayName: 'Call Report Code',
      description: 'Call Report Code (max 5 characters). User Defined.',
      required: false,
    }),
    purposeCode: Property.ShortText({
      displayName: 'Purpose Code',
      description: 'Purpose Code (max 5 characters). User Defined.',
      required: false,
    }),
    reserveDisbursement: Property.StaticDropdown({
      displayName: 'Reserve Disbursement',
      description: 'Reserve disbursement method.',
      required: false,
      options: {
        options: [
          { label: 'E - When-earned reserve', value: 'E' },
          { label: 'P - When-paid reserve', value: 'P' },
          { label: 'U - Up-front reserve', value: 'U' },
        ],
      },
    }),
    lateChargeFactor: Property.ShortText({
      displayName: 'Late Charge Factor',
      description: 'Late Charge Factor (max 9 characters).',
      required: false,
    }),
    lateChargeWaiveCode: Property.StaticDropdown({
      displayName: 'Late Charge Waive Code',
      description: 'Late charge waive code.',
      required: false,
      options: {
        options: [
          { label: 'Blank - No Waive', value: '' },
          { label: 'B - Notice & Late Charge', value: 'B' },
          { label: 'L - Late Charge Only', value: 'L' },
          { label: 'N - Notice Only', value: 'N' },
          { label: 'X - Notice & Late Charge at Maturity', value: 'X' },
          { label: 'Y - Late Charge at Maturity', value: 'Y' },
        ],
      },
    }),
    loanOfficerApproval: Property.StaticDropdown({
      displayName: 'Loan Officer Approval',
      description: 'Loan officer approval type.',
      required: false,
      options: {
        options: [
          { label: 'Blank - No Override', value: '' },
          { label: 'A - Loan Committee Approval', value: 'A' },
          { label: 'O - Other Approval', value: 'O' },
        ],
      },
    }),
    officerCode1: Property.ShortText({
      displayName: 'Officer Code 1',
      description: 'Officer code 1 (max 3 characters). User Defined.',
      required: false,
    }),
    officerCode2: Property.ShortText({
      displayName: 'Officer Code 2',
      description: 'Officer code 2 (max 3 characters). User Defined.',
      required: false,
    }),
    originatingOfficer: Property.ShortText({
      displayName: 'Originating Officer',
      description: 'Originating Officer ID (max 3 characters).',
      required: false,
    }),
    lateChargeBenefitCostRatioPoint: Property.ShortText({
      displayName: 'Late Charge Benefit Cost Ratio Point',
      description: 'Late Charge Benefit Cost Ratio Point (1 character). User Defined.',
      required: false,
    }),
    lateChargeAssessmentCode: Property.StaticDropdown({
      displayName: 'Late Charge Assessment Code',
      description: 'Late charge assessment code.',
      required: true,
      options: {
        options: [
          { label: 'P - Antipyramiding not in effect', value: 'P' },
          { label: 'A - Antipyramiding in effect', value: 'A' },
        ],
      },
    }),
    couponMailLocation: Property.StaticDropdown({
      displayName: 'Coupon Mail Location',
      description: 'Coupon mail location.',
      required: false,
      options: {
        options: [
          { label: 'Blank - No coupon request', value: '' },
          { label: 'B - Mail to Bank Address', value: 'B' },
          { label: 'C - Mail to Customer Address', value: 'C' },
        ],
      },
    }),
    couponReprintFlag: Property.Checkbox({
      displayName: 'Coupon Reprint Flag',
      description: 'Coupon Reprint Flag. Required if Coupon Mail Location is set.',
      required: false,
    }),
    employeeCode: Property.ShortText({
      displayName: 'Employee Code',
      description: 'Employee Code identifies any relationship with the institution (1 character). User Defined.',
      required: false,
    }),
    tieredInterestRate: Property.ShortText({
      displayName: 'Tiered Interest Rate',
      description: 'Tiered Interest Rate (max 4 characters). User Defined.',
      required: false,
    }),
    tieredRateMethod: Property.StaticDropdown({
      displayName: 'Tiered Rate Method',
      description: 'Tiered rate method.',
      required: false,
      options: {
        options: [
          { label: 'S - Split Balance', value: 'S' },
          { label: 'W - Whole Balance', value: 'W' },
        ],
      },
    }),
    couponProcessingDate: Property.ShortText({
      displayName: 'Coupon Processing Date',
      description: 'Coupon Processing Date (Format: CCYYMMDD). Required if Coupon Mail Location is set.',
      required: false,
    }),
    couponQuantity: Property.Number({
      displayName: 'Coupon Quantity',
      description: 'Coupon Quantity (1-99).',
      required: false,
    }),
    couponMaxQuantity: Property.Number({
      displayName: 'Coupon Max Quantity',
      description: 'Coupon Max Quantity (1-99).',
      required: false,
    }),
    initialRate: Property.Number({
      displayName: 'Initial Rate',
      description: 'Initial Rate (must be under 100%). Example: 5% = 0.0500000.',
      required: false,
    }),
    initialRateExpirationDate: Property.ShortText({
      displayName: 'Initial Rate Expiration Date',
      description: 'Initial Rate Expiration Date (Format: CCYYMMDD). Required if initial rate is used.',
      required: false,
    }),
    homeMortgageDisclosureActLoanFlag: Property.Checkbox({
      displayName: 'Home Mortgage Disclosure Act Loan Flag',
      description: 'HMDA Loan Flag.',
      required: true,
    }),
    hmdaPreapproval: Property.StaticDropdown({
      displayName: 'HMDA Preapproval',
      description: 'HMDA Preapproval status.',
      required: false,
      options: {
        options: [
          { label: 'Blank', value: '' },
          { label: '1 - Preapproval requested', value: '1' },
          { label: '2 - Preapproval not requested', value: '2' },
          { label: '3 - Preapproval not applicable', value: '3' },
        ],
      },
    }),
    homeOwnershipAEquityProtectionActRateSpread: Property.Number({
      displayName: 'HOEPA Rate Spread',
      description: 'Home Ownership and Equity Protection Act Rate Spread (0-9.9999).',
      required: false,
    }),
    introductoryFixedRate: Property.Number({
      displayName: 'Introductory Fixed Rate',
      description: 'Introductory Fixed Rate (must be under 100%). Must be 0 if Introductory Global Index is set.',
      required: false,
    }),
    introductoryGlobalIndex: Property.ShortText({
      displayName: 'Introductory Global Index',
      description: 'Introductory Global Index (max 3 characters). Must be blank if Introductory Fixed Rate > 0.',
      required: false,
    }),
    introductoryAdjustmentFinancialTransitionRight: Property.Number({
      displayName: 'Introductory Adjustment',
      description: 'Introductory Adjustment. Can only be > 0 if Introductory Global Index is set.',
      required: false,
    }),
    introductoryAdjustmentMethod: Property.StaticDropdown({
      displayName: 'Introductory Adjustment Method',
      description: 'Required if Introductory Global Index is set.',
      required: false,
      options: {
        options: [
          { label: 'A - Add', value: 'A' },
          { label: 'P - Percent', value: 'P' },
          { label: 'S - Subtract', value: 'S' },
        ],
      },
    }),
    introductoryExpirationDate: Property.ShortText({
      displayName: 'Introductory Expiration Date',
      description: 'Introductory Expiration Date (Format: CCYYMMDD). Required if Introductory Rate applies.',
      required: false,
    }),
    permanentFixedRate: Property.Number({
      displayName: 'Permanent Fixed Rate',
      description: 'Permanent Fixed Rate (must be under 100%). Required if Introductory Expiration Date > 0 and no LNPRIM record exists.',
      required: false,
    }),
    projectPaymentZeroDue: Property.StaticDropdown({
      displayName: 'Project Payment / Zero Due',
      description: 'Project Payment / Zero Due option.',
      required: true,
      options: {
        options: [
          { label: '0 - No payment projection or zero due notice', value: '0' },
          { label: '1 - One payment projected and zero due notice produced', value: '1' },
          { label: '2 - One payment projected / zero due notice not produced', value: '2' },
          { label: '3 - No payment projected / zero due notice produced', value: '3' },
        ],
      },
    }),
    payInAdvanceFrequency: Property.StaticDropdown({
      displayName: 'Pay in Advance Frequency',
      description: 'Pay in Advance Frequency.',
      required: false,
      options: {
        options: [
          { label: 'E - Excess', value: 'E' },
          { label: 'M - Monthly', value: 'M' },
          { label: 'P - Payments', value: 'P' },
        ],
      },
    }),
    payInAdvanceIncrement: Property.ShortText({
      displayName: 'Pay in Advance Increment',
      description: 'Pay in Advance Increment (2 characters). 00-27 if E, 01 if M, 01-99 if P.',
      required: false,
    }),
    mlaFlag: Property.Checkbox({
      displayName: 'MLA Flag',
      description: 'Military Lending Act Flag.',
      required: true,
    }),
    // ==========================================================================
    // Interest Earnings (Required)
    // ==========================================================================
    interestEarnings: Property.Json({
      displayName: 'Interest Earnings',
      description: 'Interest earnings information (required). JSON object with fields: interestAccrualMethod, receivableType, interestCalculationMethod, rateIndexCode, adjustmentMethod, adjustmentValue, ceiling, ceilingOverride, floor, floorOverride, etc.',
      required: true,
    }),
    // ==========================================================================
    // Overlimit Control (Required)
    // ==========================================================================
    overlimitControl: Property.Json({
      displayName: 'Overlimit Control',
      description: 'Overlimit control information (required). JSON object with fields: monthlyLimitCode, monthlyLimitAmount, monthlyLimitCumulative, maxAdvanceAmount, advanceMaxAmount, advanceMinAmount, etc.',
      required: true,
    }),
    // ==========================================================================
    // Optional Segments
    // ==========================================================================
    lateCharges: Property.Json({
      displayName: 'Late Charges',
      description: 'Late charges information. JSON object with fields: billLateFees, minimumLateFees, lateFeeFreeDays, lateFeeGracePeriod, etc.',
      required: false,
    }),
    dealerReserve: Property.Json({
      displayName: 'Dealer Reserve',
      description: 'Dealer reserve information. JSON object with fields: dealerNumber, dealerRebatePercent, dealerFlatFee, etc.',
      required: false,
    }),
    insuranceEarnings: Property.Json({
      displayName: 'Insurance Earnings',
      description: 'Insurance earnings information. JSON array of insurance earnings records (max 99 items).',
      required: false,
    }),
    feeEarnings: Property.Json({
      displayName: 'Fee Earnings',
      description: 'Fee earnings information. JSON array of fee earnings records (max 99 items).',
      required: false,
    }),
    paymentSchedules: Property.Json({
      displayName: 'Payment Schedules',
      description: 'Payment schedules information. JSON array of payment schedule records (max 99 items).',
      required: false,
    }),
    paymentCalculationMethodsAndCycleControl: Property.Json({
      displayName: 'Payment Calculation Methods and Cycle Control',
      description: 'Payment calculation methods and cycle control information. JSON object.',
      required: false,
    }),
    skipPaymentSchedules: Property.Json({
      displayName: 'Skip Payment Schedules',
      description: 'Skip payment schedules information. JSON array of skip payment schedule records (max 99 items).',
      required: false,
    }),
    primeRateInformation: Property.Json({
      displayName: 'Prime Rate Information',
      description: 'Prime rate information. JSON object with fields: primeRateIndex, adjustmentMethod, adjustmentValue, ceiling, floor, etc.',
      required: false,
    }),
    escrowDetails: Property.Json({
      displayName: 'Escrow Details',
      description: 'Escrow details information. JSON object with fields: escrowUserGrouping, escrowInterestProfit, escrowInterestFrequency, escrowBalances (array), etc.',
      required: false,
    }),
    letterOfCredit: Property.Json({
      displayName: 'Letter of Credit',
      description: 'Letter of credit information. JSON object with fields: letterOfCreditType, beneficiaryName, expirationDate, etc.',
      required: false,
    }),
    userCodesAndOverrides: Property.Json({
      displayName: 'User Codes and Overrides',
      description: 'User codes and overrides information. JSON object with user-defined fields.',
      required: false,
    }),
    automaticTransfer: Property.Json({
      displayName: 'Automatic Transfer',
      description: 'Automatic transfer information. JSON object with fields: debitApplication (DD/SV/GL), debitAccountNumber, transferAmount, frequencyCode, frequencyIncrement, holdTransfer, availableBalanceCalculation, etc.',
      required: false,
    }),
    deferredFeesAndCosts: Property.Json({
      displayName: 'Deferred Fees and Costs',
      description: 'Deferred fees and costs information. JSON object.',
      required: false,
    }),
    masterLoan: Property.Json({
      displayName: 'Master Loan',
      description: 'Master loan information. JSON object with fields: masterLoanDescription, totalNumberOfActiveTranchesAllowed, etc.',
      required: false,
    }),
  },
  async run(context) {
    const auth = context.auth as any;
    const baseUrl = auth['baseUrl'];
    const organizationId = auth['organizationId'];
    const {
      xAuthorization,
      sourceId,
      // Base Loan Information
      productType,
      accountNumber,
      customerId,
      branchNumber,
      systemType,
      generalLedgerType,
      applicationCode,
      demandFlag,
      currentLoanAmount,
      currentNoteDate,
      currentNetProceed,
      currentMaturityDate,
      creditLineExpiration,
      firstPaymentDate,
      interestRate,
      annualPercentRate,
      prepaymentPenalty,
      minimumFinancialCharges,
      maximumLateChargeOverride,
      maximumLateChargeLoanToDate,
      censusTract,
      paySplitOption,
      billOption,
      yearBase,
      lateChargeCode,
      lateChargeCollectionMethod,
      ticklerCode,
      creditBureauAccount,
      creditRiskCode,
      callReportCode,
      purposeCode,
      reserveDisbursement,
      lateChargeFactor,
      lateChargeWaiveCode,
      loanOfficerApproval,
      officerCode1,
      officerCode2,
      originatingOfficer,
      lateChargeBenefitCostRatioPoint,
      lateChargeAssessmentCode,
      couponMailLocation,
      couponReprintFlag,
      employeeCode,
      tieredInterestRate,
      tieredRateMethod,
      couponProcessingDate,
      couponQuantity,
      couponMaxQuantity,
      initialRate,
      initialRateExpirationDate,
      homeMortgageDisclosureActLoanFlag,
      hmdaPreapproval,
      homeOwnershipAEquityProtectionActRateSpread,
      introductoryFixedRate,
      introductoryGlobalIndex,
      introductoryAdjustmentFinancialTransitionRight,
      introductoryAdjustmentMethod,
      introductoryExpirationDate,
      permanentFixedRate,
      projectPaymentZeroDue,
      payInAdvanceFrequency,
      payInAdvanceIncrement,
      mlaFlag,
      // Required segments
      interestEarnings,
      overlimitControl,
      // Optional segments
      lateCharges,
      dealerReserve,
      insuranceEarnings,
      feeEarnings,
      paymentSchedules,
      paymentCalculationMethodsAndCycleControl,
      skipPaymentSchedules,
      primeRateInformation,
      escrowDetails,
      letterOfCredit,
      userCodesAndOverrides,
      automaticTransfer,
      deferredFeesAndCosts,
      masterLoan,
    } = context.propsValue;

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

    // Build baseLoanInformation object
    const baseLoanInformation: Record<string, unknown> = {
      productType,
      accountNumber,
      customerId,
      branchNumber,
      systemType,
      generalLedgerType,
      applicationCode,
      currentLoanAmount,
      currentNoteDate,
      currentNetProceed,
      firstPaymentDate,
      interestRate,
      paySplitOption,
      billOption,
      yearBase,
      lateChargeCode,
      lateChargeCollectionMethod,
      creditBureauAccount,
      lateChargeAssessmentCode,
      homeMortgageDisclosureActLoanFlag,
      mlaFlag,
      projectPaymentZeroDue,
    };

    // Add optional base loan information fields
    if (demandFlag !== undefined && demandFlag !== null && demandFlag !== '') {
      baseLoanInformation['demandFlag'] = demandFlag;
    }
    if (currentMaturityDate !== undefined && currentMaturityDate !== null && currentMaturityDate !== '') {
      baseLoanInformation['currentMaturityDate'] = currentMaturityDate;
    }
    if (creditLineExpiration !== undefined && creditLineExpiration !== null && creditLineExpiration !== '') {
      baseLoanInformation['creditLineExpiration'] = creditLineExpiration;
    }
    if (annualPercentRate !== undefined && annualPercentRate !== null) {
      baseLoanInformation['annualPercentRate'] = annualPercentRate;
    }
    if (prepaymentPenalty !== undefined && prepaymentPenalty !== null && prepaymentPenalty !== '') {
      baseLoanInformation['prepaymentPenalty'] = prepaymentPenalty;
    }
    if (minimumFinancialCharges !== undefined && minimumFinancialCharges !== null) {
      baseLoanInformation['minimumFinancialCharges'] = minimumFinancialCharges;
    }
    if (maximumLateChargeOverride !== undefined && maximumLateChargeOverride !== null) {
      baseLoanInformation['maximumLateChargeOverride'] = maximumLateChargeOverride;
    }
    if (maximumLateChargeLoanToDate !== undefined && maximumLateChargeLoanToDate !== null) {
      baseLoanInformation['maximumLateChargeLoanToDate'] = maximumLateChargeLoanToDate;
    }
    if (censusTract !== undefined && censusTract !== null && censusTract !== '') {
      baseLoanInformation['censusTract'] = censusTract;
    }
    if (ticklerCode !== undefined && ticklerCode !== null && ticklerCode !== '') {
      baseLoanInformation['ticklerCode'] = ticklerCode;
    }
    if (creditRiskCode !== undefined && creditRiskCode !== null && creditRiskCode !== '') {
      baseLoanInformation['creditRiskCode'] = creditRiskCode;
    }
    if (callReportCode !== undefined && callReportCode !== null && callReportCode !== '') {
      baseLoanInformation['callReportCode'] = callReportCode;
    }
    if (purposeCode !== undefined && purposeCode !== null && purposeCode !== '') {
      baseLoanInformation['purposeCode'] = purposeCode;
    }
    if (reserveDisbursement !== undefined && reserveDisbursement !== null && reserveDisbursement !== '') {
      baseLoanInformation['reserveDisbursement'] = reserveDisbursement;
    }
    if (lateChargeFactor !== undefined && lateChargeFactor !== null && lateChargeFactor !== '') {
      baseLoanInformation['lateChargeFactor'] = lateChargeFactor;
    }
    if (lateChargeWaiveCode !== undefined && lateChargeWaiveCode !== null) {
      baseLoanInformation['lateChargeWaiveCode'] = lateChargeWaiveCode;
    }
    if (loanOfficerApproval !== undefined && loanOfficerApproval !== null) {
      baseLoanInformation['loanOfficerApproval'] = loanOfficerApproval;
    }
    if (officerCode1 !== undefined && officerCode1 !== null && officerCode1 !== '') {
      baseLoanInformation['officerCode1'] = officerCode1;
    }
    if (officerCode2 !== undefined && officerCode2 !== null && officerCode2 !== '') {
      baseLoanInformation['officerCode2'] = officerCode2;
    }
    if (originatingOfficer !== undefined && originatingOfficer !== null && originatingOfficer !== '') {
      baseLoanInformation['originatingOfficer'] = originatingOfficer;
    }
    if (lateChargeBenefitCostRatioPoint !== undefined && lateChargeBenefitCostRatioPoint !== null && lateChargeBenefitCostRatioPoint !== '') {
      baseLoanInformation['lateChargeBenefitCostRatioPoint'] = lateChargeBenefitCostRatioPoint;
    }
    if (couponMailLocation !== undefined && couponMailLocation !== null) {
      baseLoanInformation['couponMailLocation'] = couponMailLocation;
    }
    if (couponReprintFlag !== undefined && couponReprintFlag !== null) {
      baseLoanInformation['couponReprintFlag'] = couponReprintFlag;
    }
    if (employeeCode !== undefined && employeeCode !== null && employeeCode !== '') {
      baseLoanInformation['employeeCode'] = employeeCode;
    }
    if (tieredInterestRate !== undefined && tieredInterestRate !== null && tieredInterestRate !== '') {
      baseLoanInformation['tieredInterestRate'] = tieredInterestRate;
    }
    if (tieredRateMethod !== undefined && tieredRateMethod !== null && tieredRateMethod !== '') {
      baseLoanInformation['tieredRateMethod'] = tieredRateMethod;
    }
    if (couponProcessingDate !== undefined && couponProcessingDate !== null && couponProcessingDate !== '') {
      baseLoanInformation['couponProcessingDate'] = couponProcessingDate;
    }
    if (couponQuantity !== undefined && couponQuantity !== null) {
      baseLoanInformation['couponQuantity'] = couponQuantity;
    }
    if (couponMaxQuantity !== undefined && couponMaxQuantity !== null) {
      baseLoanInformation['couponMaxQuantity'] = couponMaxQuantity;
    }
    if (initialRate !== undefined && initialRate !== null) {
      baseLoanInformation['initialRate'] = initialRate;
    }
    if (initialRateExpirationDate !== undefined && initialRateExpirationDate !== null && initialRateExpirationDate !== '') {
      baseLoanInformation['initialRateExpirationDate'] = initialRateExpirationDate;
    }
    if (hmdaPreapproval !== undefined && hmdaPreapproval !== null) {
      baseLoanInformation['hmdaPreapproval'] = hmdaPreapproval;
    }
    if (homeOwnershipAEquityProtectionActRateSpread !== undefined && homeOwnershipAEquityProtectionActRateSpread !== null) {
      baseLoanInformation['homeOwnershipAEquityProtectionActRateSpread'] = homeOwnershipAEquityProtectionActRateSpread;
    }
    if (introductoryFixedRate !== undefined && introductoryFixedRate !== null) {
      baseLoanInformation['introductoryFixedRate'] = introductoryFixedRate;
    }
    if (introductoryGlobalIndex !== undefined && introductoryGlobalIndex !== null && introductoryGlobalIndex !== '') {
      baseLoanInformation['introductoryGlobalIndex'] = introductoryGlobalIndex;
    }
    if (introductoryAdjustmentFinancialTransitionRight !== undefined && introductoryAdjustmentFinancialTransitionRight !== null) {
      baseLoanInformation['introductoryAdjustmentFinancialTransitionRight'] = introductoryAdjustmentFinancialTransitionRight;
    }
    if (introductoryAdjustmentMethod !== undefined && introductoryAdjustmentMethod !== null && introductoryAdjustmentMethod !== '') {
      baseLoanInformation['introductoryAdjustmentMethod'] = introductoryAdjustmentMethod;
    }
    if (introductoryExpirationDate !== undefined && introductoryExpirationDate !== null && introductoryExpirationDate !== '') {
      baseLoanInformation['introductoryExpirationDate'] = introductoryExpirationDate;
    }
    if (permanentFixedRate !== undefined && permanentFixedRate !== null) {
      baseLoanInformation['permanentFixedRate'] = permanentFixedRate;
    }
    if (payInAdvanceFrequency !== undefined && payInAdvanceFrequency !== null && payInAdvanceFrequency !== '') {
      baseLoanInformation['payInAdvanceFrequency'] = payInAdvanceFrequency;
    }
    if (payInAdvanceIncrement !== undefined && payInAdvanceIncrement !== null && payInAdvanceIncrement !== '') {
      baseLoanInformation['payInAdvanceIncrement'] = payInAdvanceIncrement;
    }

    // Build request body with required segments
    const body: Record<string, unknown> = {
      baseLoanInformation,
      interestEarnings,
      overlimitControl,
    };

    // Add optional segments
    if (lateCharges !== undefined && lateCharges !== null) {
      body['lateCharges'] = lateCharges;
    }
    if (dealerReserve !== undefined && dealerReserve !== null) {
      body['dealerReserve'] = dealerReserve;
    }
    if (insuranceEarnings !== undefined && insuranceEarnings !== null) {
      body['insuranceEarnings'] = insuranceEarnings;
    }
    if (feeEarnings !== undefined && feeEarnings !== null) {
      body['feeEarnings'] = feeEarnings;
    }
    if (paymentSchedules !== undefined && paymentSchedules !== null) {
      body['paymentSchedules'] = paymentSchedules;
    }
    if (paymentCalculationMethodsAndCycleControl !== undefined && paymentCalculationMethodsAndCycleControl !== null) {
      body['paymentCalculationMethodsAndCycleControl'] = paymentCalculationMethodsAndCycleControl;
    }
    if (skipPaymentSchedules !== undefined && skipPaymentSchedules !== null) {
      body['skipPaymentSchedules'] = skipPaymentSchedules;
    }
    if (primeRateInformation !== undefined && primeRateInformation !== null) {
      body['primeRateInformation'] = primeRateInformation;
    }
    if (escrowDetails !== undefined && escrowDetails !== null) {
      body['escrowDetails'] = escrowDetails;
    }
    if (letterOfCredit !== undefined && letterOfCredit !== null) {
      body['letterOfCredit'] = letterOfCredit;
    }
    if (userCodesAndOverrides !== undefined && userCodesAndOverrides !== null) {
      body['userCodesAndOverrides'] = userCodesAndOverrides;
    }
    if (automaticTransfer !== undefined && automaticTransfer !== null) {
      body['automaticTransfer'] = automaticTransfer;
    }
    if (deferredFeesAndCosts !== undefined && deferredFeesAndCosts !== null) {
      body['deferredFeesAndCosts'] = deferredFeesAndCosts;
    }
    if (masterLoan !== undefined && masterLoan !== null) {
      body['masterLoan'] = masterLoan;
    }

    const response = await httpClient.sendRequest({
      method: HttpMethod.POST,
      url: `${baseUrl}/loans/v2/accounts/loans`,
      headers,
      body,
    });

    return response.body;
  },
});
