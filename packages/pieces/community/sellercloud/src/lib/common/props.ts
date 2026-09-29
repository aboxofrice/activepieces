import { Property } from '@activepieces/pieces-framework';
import { tryCatch } from '@activepieces/shared';
import { sellercloudAuth } from '../auth';
import { sellercloudClient } from './client';

const warehouse = Property.Dropdown({
    auth: sellercloudAuth,
    displayName: 'Warehouse',
    required: true,
    refreshers: [],
    options: async ({ auth }) => {
        if (!auth) {
            return { disabled: true, options: [], placeholder: 'Connect SellerCloud first' };
        }
        const { data, error } = await tryCatch(() => sellercloudClient.listWarehouses({ auth: auth.props }));
        if (error) {
            return { disabled: true, options: [], placeholder: `Couldn't load warehouses: ${error.message}` };
        }
        return {
            disabled: false,
            options: [...data]
                .sort((a, b) => a.Name.localeCompare(b.Name))
                .map((w) => ({ label: `${w.Name} (${w.ID})`, value: w.ID })),
        };
    },
});

const updateType = Property.StaticDropdown({
    displayName: 'Update Type',
    description: 'Partial only changes the products in the file. Full also sets every other product in this warehouse to 0.',
    required: true,
    defaultValue: 'PARTIAL',
    options: {
        options: [
            { label: 'Partial (only products in the file)', value: 'PARTIAL' },
            { label: 'Full (products not in the file go to 0)', value: 'FULL' },
        ],
    },
});

const inventoryDate = Property.DateTime({
    displayName: 'Inventory Date',
    description: 'When the counts were taken. Defaults to now.',
    required: false,
});

const waitForCompletion = Property.Checkbox({
    displayName: 'Wait for Import to Finish',
    description: 'SellerCloud queues imports as a job. When on, this step polls the job and fails if the import fails.',
    required: false,
    defaultValue: true,
});

const timeoutSeconds = Property.Number({
    displayName: 'Wait Timeout (seconds)',
    description: 'How long to wait for the job before returning its current status.',
    required: false,
    defaultValue: 300,
});

export const sellercloudProps = {
    warehouse,
    updateType,
    inventoryDate,
    waitForCompletion,
    timeoutSeconds,
};
