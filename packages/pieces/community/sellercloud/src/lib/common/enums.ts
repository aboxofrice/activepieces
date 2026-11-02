// Friendly names for SellerCloud enums, taken from the REST spec's parameter descriptions.

function label({ map, code }: { map: Record<number, string>; code: number | null | undefined }): string | null {
    if (code === null || code === undefined) {
        return null;
    }
    return map[code] ?? `Unknown (${code})`;
}

function toOptions({ map }: { map: Record<number, string> }): { label: string; value: number }[] {
    return Object.entries(map).map(([code, name]) => ({ label: `${name} (${code})`, value: Number(code) }));
}

const CHANNELS: Record<number, string> = {
    0: 'Local Store', 1: 'eBay', 2: 'eBay Single Item', 3: 'Yahoo', 4: 'Amazon', 5: 'PriceGrabber',
    6: 'Website', 7: 'Buy.com', 12: 'NewEgg Mall', 15: 'Magento', 16: 'QuickBooks', 17: 'RMS',
    18: 'Cart32', 19: 'Sears', 20: 'Amazon FBA', 21: 'Wholesale', 22: 'Overstock', 23: 'NewEgg.com',
    24: 'Etsy', 25: 'Bonanza', 26: 'PriceFalls', 27: 'Wayfair', 28: 'UnbeatableSale',
    29: 'Amazon Vendor Central', 30: 'Hayneedle', 31: 'SmartBargains', 32: 'uBid', 33: 'ATG Stores',
    34: 'Stacks And Stacks', 35: 'Sharkstores', 36: 'Best Buy', 37: 'Kohls', 38: 'Staples',
    39: 'OneStopPlus', 40: 'Meijer', 41: 'Sonsi', 42: 'Walmart', 43: 'HSN', 44: 'NewEgg Business',
    45: 'KMart', 46: 'Wish', 47: 'SP Richards', 48: 'FingerHut', 49: 'Groupon',
    50: 'Walmart Marketplace', 51: 'ShopHQ', 52: 'PriceMinister', 53: 'GS', 54: 'DrugStore',
    55: 'MercadoLibre', 56: 'Jet', 57: 'ElevenMain', 58: 'Sears Vendor', 59: 'Choxi', 60: 'TradeMe',
    61: 'Tanga', 62: 'Target', 63: 'Groupon Marketplace', 64: 'Reverb', 65: 'Bed Bath And Beyond',
    66: 'Dropship Central', 67: 'DSW', 68: 'Houzz', 69: 'Gilt', 70: 'Best Buy DS', 71: 'TopHatter',
    72: 'Home Depot', 73: 'MassGenie', 74: 'Cdiscount', 75: 'Groupon Gateway', 76: 'SBN',
    77: 'Google Express', 78: 'Target Plus', 79: 'Walmart WFS', 80: 'BackMarket', 81: 'Amazon AWD',
};

const ORDER_STATUSES: Record<number, string> = {
    [-1]: 'Canceled', 1: 'Shopping Cart', 2: 'In Process', 3: 'Completed', 100: 'Problem Order',
    200: 'On Hold', 300: 'Quote', 999: 'Void',
};

const SHIPPING_STATUSES: Record<number, string> = {
    0: 'Unknown', 1: 'Unshipped', 2: 'Partially Shipped', 3: 'Fully Shipped', 4: 'Ready For Pickup',
};

const PAYMENT_STATUSES: Record<number, string> = {
    10: 'No Payment', 20: 'Authorized', 30: 'Charged', 40: 'Uncleared', 50: 'Partially Refunded',
    60: 'Fully Refunded', 70: 'Partial Payment', 80: 'eBay Paid', 99: 'Payment Error',
};

const RMA_STATUSES: Record<number, string> = {
    0: 'Open', 1: 'On Hold', 2: 'Processing', 3: 'Closed',
};

const PO_STATUSES: Record<number, string> = {
    0: 'Saved', 1: 'Ordered', 2: 'Pending', 3: 'Received', 4: 'Cancelled', 5: 'Completed',
};

const PO_RECEIVING_STATUSES: Record<number, string> = {
    0: 'Not Received', 1: 'Partially Received', 2: 'Fully Received',
};

export const sellercloudEnums = {
    label,
    toOptions,
    CHANNELS,
    ORDER_STATUSES,
    SHIPPING_STATUSES,
    PAYMENT_STATUSES,
    RMA_STATUSES,
    PO_STATUSES,
    PO_RECEIVING_STATUSES,
};
