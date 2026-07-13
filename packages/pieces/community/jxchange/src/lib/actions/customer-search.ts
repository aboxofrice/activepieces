import { createAction, Property } from '@activepieces/pieces-framework';
import { jxchangeAuth } from '../auth';
import { jxClient } from '../common/client';

export const customerSearch = createAction({
    auth: jxchangeAuth,
    name: 'customer_search',
    displayName: 'Search Customers',
    description: 'Search core customers by name, phone, tax ID, or account (CustSrch).',
    props: {
        lastName: Property.ShortText({
            displayName: 'Last Name',
            required: false,
        }),
        firstName: Property.ShortText({
            displayName: 'First Name',
            required: false,
        }),
        companyName: Property.ShortText({
            displayName: 'Company Name',
            description: 'Business/common name — use instead of first/last name for organizations.',
            required: false,
        }),
        phoneNumber: Property.ShortText({
            displayName: 'Phone Number',
            required: false,
        }),
        taxId: Property.ShortText({
            displayName: 'Tax ID',
            description: 'SSN or EIN, digits only.',
            required: false,
        }),
        acctId: Property.ShortText({
            displayName: 'Account Number',
            description: 'Find the customers attached to this account.',
            required: false,
        }),
        acctType: Property.ShortText({
            displayName: 'Account Type',
            description: 'Required when Account Number is set, e.g. D, S, T, L.',
            required: false,
        }),
        maxRecords: Property.Number({
            displayName: 'Max Records',
            required: false,
            defaultValue: 50,
        }),
    },
    async run(context) {
        const { lastName, firstName, companyName, phoneNumber, taxId, acctId, acctType, maxRecords } = context.propsValue;

        const personName = [companyName, firstName, lastName].some((v) => v)
            ? '<PersonName>'
                + jxClient.tag({ name: 'ComName', value: companyName })
                + jxClient.tag({ name: 'FirstName', value: firstName })
                + jxClient.tag({ name: 'LastName', value: lastName })
                + '</PersonName>'
            : '';
        const accountId = acctId
            ? jxClient.buildAccountId({ name: 'AccountId', acctId, acctType: acctType ?? '' })
            : '';

        const innerXml = jxClient.buildSrchMsgRqHdr({ auth: context.auth.props, maxRec: maxRecords ?? 50 })
            + personName
            + jxClient.tag({ name: 'PhoneNum', value: phoneNumber })
            + accountId
            + jxClient.tag({ name: 'TaxId', value: taxId });

        const response = await jxClient.call({
            auth: context.auth.props,
            service: 'Customer',
            operation: 'CustSrch',
            innerXml,
        });

        const recArray = response['CustSrchRecArray'] as Record<string, unknown> | undefined;
        return {
            customers: jxClient.asArray({ value: recArray?.['CustSrchRec'] }),
            raw: response,
        };
    },
});
