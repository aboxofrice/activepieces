import {
  createAction,
  Property,
} from '@activepieces/pieces-framework';
import { httpClient, HttpMethod } from '@activepieces/pieces-common';
import { kinectivePlaceholderAuth } from '../..';

export const addCollateral = createAction({
  name: 'collateral_add',
  auth: kinectivePlaceholderAuth,
  displayName: 'Collateral - Add',
  description: 'Add collateral to a loan',
  props: {
    loanId: Property.ShortText({
      displayName: 'Loan ID',
      description: 'The ID of the loan to add collateral to',
      required: true,
    }),
    collateralType: Property.StaticDropdown({
      displayName: 'Collateral Type',
      description: 'Type of collateral',
      required: true,
      options: {
        options: [
          { label: 'Real Estate', value: 'RealEstate' },
          { label: 'Vehicle', value: 'Vehicle' },
          { label: 'Equipment', value: 'Equipment' },
          { label: 'Securities', value: 'Securities' },
          { label: 'Cash', value: 'Cash' },
          { label: 'Other', value: 'Other' },
        ],
      },
    }),
    description: Property.LongText({
      displayName: 'Description',
      description: 'Detailed description of the collateral',
      required: true,
    }),
    estimatedValue: Property.Number({
      displayName: 'Estimated Value',
      description: 'Estimated value of the collateral',
      required: true,
    }),
    propertyAddress: Property.LongText({
      displayName: 'Property Address',
      description: 'Address of the collateral (for real estate)',
      required: false,
    }),
    vinNumber: Property.ShortText({
      displayName: 'VIN Number',
      description: 'Vehicle Identification Number (for vehicles)',
      required: false,
    }),
  },
  async run(context) {
    const auth = context.auth as any;
    const baseUrl = auth.baseUrl;
    const organizationId = auth.organizationId;
    const { loanId, collateralType, description, estimatedValue, propertyAddress, vinNumber } = context.propsValue;

    const trnId = crypto.randomUUID();

    const requestBody: any = {
      LoanKeys: {
        LoanId: loanId,
      },
      CollateralInfo: {
        CollateralType: collateralType,
        Description: description,
        EstimatedValue: estimatedValue,
      },
    };

    if (propertyAddress && collateralType === 'RealEstate') {
      requestBody.CollateralInfo.PropertyAddress = propertyAddress;
    }

    if (vinNumber && collateralType === 'Vehicle') {
      requestBody.CollateralInfo.VINNumber = vinNumber;
    }

    const response = await httpClient.sendRequest({
      method: HttpMethod.POST,
      url: `${baseUrl}/banking/efx/v1/loanservice/collateral`,
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
