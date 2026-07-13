import { createPiece } from '@activepieces/pieces-framework';
import { PieceCategory } from '@activepieces/shared';
import { accountHistorySearch } from './lib/actions/account-history-search';
import { accountInquiry } from './lib/actions/account-inquiry';
import { callOperation } from './lib/actions/call-operation';
import { customerInquiry } from './lib/actions/customer-inquiry';
import { customerSearch } from './lib/actions/customer-search';
import { internalTransfer } from './lib/actions/internal-transfer';
import { ping } from './lib/actions/ping';
import { jxchangeAuth } from './lib/auth';

export const jxchange = createPiece({
    displayName: 'Jack Henry jXchange',
    description: 'Core banking via the Jack Henry jXchange Third Party Gateway — customers, accounts, transactions, and 600+ SOAP operations.',
    minimumSupportedRelease: '0.36.1',
    logoUrl: 'https://cdn.activepieces.com/pieces/jxchange.png',
    categories: [PieceCategory.PAYMENT_PROCESSING, PieceCategory.ACCOUNTING],
    auth: jxchangeAuth,
    authors: ['vqnguyen1'],
    actions: [
        ping,
        customerSearch,
        customerInquiry,
        accountInquiry,
        accountHistorySearch,
        internalTransfer,
        callOperation,
    ],
    triggers: [],
});
