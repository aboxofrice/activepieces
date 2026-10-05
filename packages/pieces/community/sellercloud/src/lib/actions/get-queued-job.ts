import { sellercloudAuthProps } from '../auth';
import { createAction, Property } from '@activepieces/pieces-framework';
import { sellercloudAuth } from '../auth';
import { inventoryImport } from '../common/inventory';

export const getQueuedJob = createAction({
    auth: sellercloudAuth,
    name: 'get_queued_job',
    displayName: 'Get Queued Job',
    description: 'Get the status of a SellerCloud queued job (for example an inventory import), optionally waiting for it to finish.',
    props: {
        jobId: Property.Number({
            displayName: 'Job ID',
            required: true,
        }),
        wait: Property.Checkbox({
            displayName: 'Wait Until Finished',
            required: false,
            defaultValue: false,
        }),
        timeoutSeconds: Property.Number({
            displayName: 'Wait Timeout (seconds)',
            required: false,
            defaultValue: 300,
        }),
    },
    async run(context) {
        const { jobId, wait, timeoutSeconds } = context.propsValue;
        const auth = sellercloudAuthProps(context.auth);
        if (wait) {
            return inventoryImport.waitForJob({ auth, jobId, timeoutSeconds: timeoutSeconds ?? 300 });
        }
        return inventoryImport.getJob({ auth, jobId });
    },
});
