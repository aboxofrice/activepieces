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

// Three real behaviours, named by what they do rather than by the API's UpdateType flag:
// a Full import replaces the warehouse (verified: a listed product is set to the file
// value, an unlisted one goes to 0), a Partial import adds, and delta adjustments set
// only the listed products without touching anything else.
const writeMode = Property.StaticDropdown({
    displayName: 'Quantity Handling',
    description: 'How the file quantities are applied to this warehouse.',
    required: true,
    defaultValue: 'SET_LISTED',
    options: {
        options: [
            { label: 'Set only these products — leave other products untouched', value: 'SET_LISTED' },
            { label: 'Replace the warehouse — set these products, zero everything else (slow: a full import takes ~1 hour and blocks every other import account-wide)', value: 'REPLACE_WAREHOUSE' },
            { label: 'Add to current quantities', value: 'ADD' },
        ],
    },
});

const adjustmentReason = Property.ShortText({
    displayName: 'Adjustment Reason',
    description: 'Recorded against each adjustment in SellerCloud. Only used when setting only the listed products.',
    required: false,
    defaultValue: 'PDC inventory import',
});

const trustLastWritten = Property.Checkbox({
    displayName: 'Trust Last Written Quantities',
    description: 'When setting only the listed products, reuses what this flow last wrote instead of reading each one back. Much faster, but only safe when nothing else changes inventory in this warehouse.',
    required: false,
    defaultValue: false,
});

const zeroMissing = Property.Checkbox({
    displayName: 'Zero Products Missing From This Run',
    description: 'When setting only the listed products, any product this flow wrote previously but that is absent now is set to 0. Gives the same end state as replacing the warehouse, without the hours-long full import. Needs "Trust Last Written Quantities" history to know what was written before.',
    required: false,
    defaultValue: false,
});

const verifyAfterWrite = Property.Checkbox({
    displayName: 'Verify After Writing',
    description: 'Adjustments apply asynchronously. When on, this polls until the quantities settle and reports any that did not land.',
    required: false,
    defaultValue: true,
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
    writeMode,
    adjustmentReason,
    verifyAfterWrite,
    trustLastWritten,
    zeroMissing,
    inventoryDate,
    waitForCompletion,
    timeoutSeconds,
};
