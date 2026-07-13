import { createAction, Property } from '@activepieces/pieces-framework';
import { symxchangeAuth } from '../auth';
import { symxClient } from '../common/client';

const TYPE_OPTIONS = [
    { label: 'Share', value: 'Share' },
    { label: 'Loan', value: 'Loan' },
    { label: 'GL', value: 'GL' },
];

export const transferFunds = createAction({
    auth: symxchangeAuth,
    name: 'transfer_funds',
    displayName: 'Transfer Funds',
    description: 'Transfer money between shares, loans, or GL accounts (Transactions service).',
    props: {
        donorAccountNumber: Property.ShortText({
            displayName: 'From Account Number',
            required: true,
        }),
        donorId: Property.ShortText({
            displayName: 'From Share/Loan ID',
            description: 'The share or loan ID within the donor account, e.g. 0000.',
            required: true,
        }),
        donorType: Property.StaticDropdown({
            displayName: 'From Type',
            required: true,
            defaultValue: 'Share',
            options: {
                options: TYPE_OPTIONS,
            },
        }),
        recipientAccountNumber: Property.ShortText({
            displayName: 'To Account Number',
            required: true,
        }),
        recipientId: Property.ShortText({
            displayName: 'To Share/Loan ID',
            description: 'The share or loan ID within the recipient account, e.g. 0000.',
            required: true,
        }),
        recipientType: Property.StaticDropdown({
            displayName: 'To Type',
            required: true,
            defaultValue: 'Share',
            options: {
                options: TYPE_OPTIONS,
            },
        }),
        amount: Property.Number({
            displayName: 'Amount',
            required: true,
        }),
        comment: Property.ShortText({
            displayName: 'Comment',
            description: 'Transaction description shown on the member record.',
            required: false,
        }),
    },
    async run(context) {
        const { donorAccountNumber, donorId, donorType, recipientAccountNumber, recipientId, recipientType, amount, comment } = context.propsValue;
        const innerXml = symxClient.buildCredentialsXml({ auth: context.auth.props })
            + symxClient.buildDeviceXml({ auth: context.auth.props })
            + symxClient.dtoTag({ name: 'DonorAccountNumber', value: donorAccountNumber })
            + symxClient.dtoTag({ name: 'DonorId', value: donorId })
            + symxClient.dtoTag({ name: 'DonorType', value: donorType })
            + symxClient.dtoTag({ name: 'RecipientAccountNumber', value: recipientAccountNumber })
            + symxClient.dtoTag({ name: 'RecipientId', value: recipientId })
            + symxClient.dtoTag({ name: 'RecipientType', value: recipientType })
            + symxClient.tag({ name: 'TransferAmount', value: amount })
            + symxClient.dtoTag({ name: 'Comment', value: comment });
        const response = await symxClient.call({
            auth: context.auth.props,
            service: 'transactions',
            operation: 'transfer',
            innerXml,
        });
        return {
            result: symxClient.unwrapResponse({ response }),
            raw: response,
        };
    },
});
