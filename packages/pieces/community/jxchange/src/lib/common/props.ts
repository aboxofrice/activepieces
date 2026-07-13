import { Property } from '@activepieces/pieces-framework';
import { JX_SERVICES } from './client';

function serviceDropdown({ description }: { description: string }) {
    return Property.StaticDropdown({
        displayName: 'Service',
        description,
        required: true,
        defaultValue: 'Inquiry',
        options: {
            options: JX_SERVICES.map((service) => ({ label: service, value: service })),
        },
    });
}

function acctTypeText({ displayName }: { displayName: string }) {
    return Property.ShortText({
        displayName,
        description: 'Core account type code, e.g. D (checking/DDA), S (savings), T (time deposit/CD), L (loan), G (general ledger).',
        required: true,
    });
}

export const jxProps = {
    serviceDropdown,
    acctTypeText,
};
