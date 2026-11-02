import { EbayAuthProps, ebayClient } from './client';
import { xmlUtils } from './xml';

async function getListingQuantity({ auth, itemId, sku }: { auth: EbayAuthProps; itemId?: string; sku?: string }): Promise<ListingQuantity> {
    const lookup = itemId ? tag({ name: 'ItemID', value: itemId }) : tag({ name: 'SKU', value: sku ?? '' });
    const xml = await ebayClient.tradingCall({
        auth,
        callName: 'GetItem',
        innerXml: `${lookup}${GET_ITEM_OUTPUT_SELECTORS.map((selector) => tag({ name: 'OutputSelector', value: selector })).join('')}`,
        readOnly: true,
    });
    const result = parseResult({ xml });
    const itemXml = xmlUtils.blocks({ xml, tag: 'Item' })[0];
    if (result.ack === 'Failure' || !itemXml) {
        return { found: false, ...result, listing: null };
    }
    return { found: true, ...result, listing: parseListing({ itemXml, sku }) };
}

async function updateListingQuantity({ auth, itemId, sku, quantity, method, isVariation }: QuantityUpdate): Promise<QuantityUpdateResult> {
    const callName = method === 'ReviseItem' ? 'ReviseItem' : 'ReviseInventoryStatus';
    const xml = await ebayClient.tradingCall({
        auth,
        callName,
        innerXml: callName === 'ReviseItem'
            ? reviseItemXml({ itemId, sku, quantity, isVariation })
            : tag({ name: 'InventoryStatus', value: `${optionalTag({ name: 'ItemID', value: itemId })}${optionalTag({ name: 'SKU', value: sku })}<Quantity>${quantity}</Quantity>`, raw: true }),
    });
    const result = parseResult({ xml });
    const quantityIgnored = result.errors.some((error) => error.code === QUANTITY_IGNORED_CODE);
    return {
        ...result,
        call: callName,
        updated: result.ack !== 'Failure' && !quantityIgnored,
        quantity_ignored: quantityIgnored,
        item_id: xmlUtils.firstTag({ xml, tag: 'ItemID' }) ?? itemId ?? null,
        sku: sku ?? null,
        requested_quantity: quantity,
    };
}

async function updateListingPrice({ auth, itemId, sku, price, quantity }: PriceUpdate): Promise<PriceUpdateResult> {
    const xml = await ebayClient.tradingCall({
        auth,
        callName: 'ReviseInventoryStatus',
        innerXml: tag({
            name: 'InventoryStatus',
            value: `${optionalTag({ name: 'ItemID', value: itemId })}${optionalTag({ name: 'SKU', value: sku })}<StartPrice>${price.toFixed(2)}</StartPrice>${quantity === undefined ? '' : `<Quantity>${quantity}</Quantity>`}`,
            raw: true,
        }),
    });
    const result = parseResult({ xml });
    const statusXml = xmlUtils.blocks({ xml, tag: 'InventoryStatus' })[0] ?? '';
    return {
        ...result,
        call: 'ReviseInventoryStatus',
        updated: result.ack !== 'Failure',
        item_id: xmlUtils.firstTag({ xml: statusXml, tag: 'ItemID' }) ?? itemId ?? null,
        sku: xmlUtils.firstTag({ xml: statusXml, tag: 'SKU' }) ?? sku ?? null,
        requested_price: price,
        requested_quantity: quantity ?? null,
        price_now: toNumber({ value: xmlUtils.firstTag({ xml: statusXml, tag: 'StartPrice' }) }),
        quantity_now: toNumber({ value: xmlUtils.firstTag({ xml: statusXml, tag: 'Quantity' }) }),
    };
}

function parseResult({ xml }: { xml: string }): TradingResult {
    const errors = xmlUtils.blocks({ xml, tag: 'Errors' }).map((errorXml) => {
        const code = Number(xmlUtils.firstTag({ xml: errorXml, tag: 'ErrorCode' }));
        return {
            code,
            severity: xmlUtils.firstTag({ xml: errorXml, tag: 'SeverityCode' }),
            message: xmlUtils.firstTag({ xml: errorXml, tag: 'LongMessage' }) ?? xmlUtils.firstTag({ xml: errorXml, tag: 'ShortMessage' }),
            known_issue: KNOWN_ERRORS[code] ?? null,
        };
    });
    return {
        ack: xmlUtils.firstTag({ xml, tag: 'Ack' }) ?? 'Unknown',
        errors: errors.filter((error) => error.severity === 'Error'),
        warnings: errors.filter((error) => error.severity !== 'Error'),
        timestamp: xmlUtils.firstTag({ xml, tag: 'Timestamp' }),
    };
}

function hasOnlyKnownListingIssues({ errors }: { errors: TradingError[] }): boolean {
    return errors.length > 0 && errors.every((error) => LISTING_QUALITY_CODES.includes(error.code));
}

function parseListing({ itemXml, sku }: { itemXml: string; sku?: string }): ListingDetails {
    const variationsXml = xmlUtils.blocks({ xml: itemXml, tag: 'Variations' })[0] ?? '';
    const topLevel = xmlUtils.withoutBlocks({ xml: itemXml, tag: 'Variations' });
    const sellingStatus = xmlUtils.blocks({ xml: topLevel, tag: 'SellingStatus' })[0] ?? '';
    const quantity = toNumber({ value: xmlUtils.firstTag({ xml: xmlUtils.withoutBlocks({ xml: topLevel, tag: 'SellingStatus' }), tag: 'Quantity' }) });
    const quantitySold = toNumber({ value: xmlUtils.firstTag({ xml: sellingStatus, tag: 'QuantitySold' }) });
    const variations = xmlUtils.blocks({ xml: variationsXml, tag: 'Variation' }).map((variationXml) => parseVariation({ variationXml }));
    const listingSku = xmlUtils.firstTag({ xml: topLevel, tag: 'SKU' });
    const matchedVariation = sku ? variations.find((variation) => variation.sku === sku) ?? null : null;
    const quantityAvailable = available({ quantity, sold: quantitySold });
    return {
        item_id: xmlUtils.firstTag({ xml: topLevel, tag: 'ItemID' }),
        sku: listingSku,
        title: xmlUtils.firstTag({ xml: topLevel, tag: 'Title' }),
        listing_status: xmlUtils.firstTag({ xml: sellingStatus, tag: 'ListingStatus' }),
        view_item_url: xmlUtils.firstTag({ xml: topLevel, tag: 'ViewItemURL' }),
        has_variations: variations.length > 0,
        quantity,
        quantity_sold: quantitySold,
        quantity_available: quantityAvailable,
        sku_matched: !sku || listingSku === sku || matchedVariation !== null,
        matched_variation: matchedVariation,
        matched_quantity_available: matchedVariation ? matchedVariation.quantity_available : quantityAvailable,
        variations,
    };
}

function parseVariation({ variationXml }: { variationXml: string }): ListingVariation {
    const sellingStatus = xmlUtils.blocks({ xml: variationXml, tag: 'SellingStatus' })[0] ?? '';
    const quantity = toNumber({ value: xmlUtils.firstTag({ xml: xmlUtils.withoutBlocks({ xml: variationXml, tag: 'SellingStatus' }), tag: 'Quantity' }) });
    const quantitySold = toNumber({ value: xmlUtils.firstTag({ xml: sellingStatus, tag: 'QuantitySold' }) });
    const specifics = xmlUtils.blocks({ xml: variationXml, tag: 'NameValueList' })
        .map((pairXml) => `${xmlUtils.firstTag({ xml: pairXml, tag: 'Name' }) ?? ''}: ${xmlUtils.blocks({ xml: pairXml, tag: 'Value' }).map((value) => xmlUtils.unescapeXml({ text: value })).join('/')}`)
        .join('; ');
    return {
        sku: xmlUtils.firstTag({ xml: variationXml, tag: 'SKU' }),
        specifics,
        quantity,
        quantity_sold: quantitySold,
        quantity_available: available({ quantity, sold: quantitySold }),
    };
}

function reviseItemXml({ itemId, sku, quantity, isVariation }: { itemId?: string; sku?: string; quantity: number; isVariation: boolean }): string {
    // A multi-variation listing ignores Item.Quantity (warning 21916619); its stock lives on each Variation.
    const quantityXml = isVariation
        ? `<Variations><Variation>${optionalTag({ name: 'SKU', value: sku })}<Quantity>${quantity}</Quantity></Variation></Variations>`
        : `${optionalTag({ name: 'SKU', value: sku })}<Quantity>${quantity}</Quantity>`;
    return `<Item>${optionalTag({ name: 'ItemID', value: itemId })}${quantityXml}</Item>`;
}

function tag({ name, value, raw = false }: { name: string; value: string; raw?: boolean }): string {
    return `<${name}>${raw ? value : xmlUtils.escapeXml({ text: value.trim() })}</${name}>`;
}

function optionalTag({ name, value }: { name: string; value: string | undefined }): string {
    return value ? tag({ name, value }) : '';
}

function toNumber({ value }: { value: string | null }): number | null {
    if (value === null) {
        return null;
    }
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
}

function available({ quantity, sold }: { quantity: number | null; sold: number | null }): number | null {
    return quantity === null ? null : quantity - (sold ?? 0);
}

const QUANTITY_IGNORED_CODE = 21916619;
const LISTING_QUALITY_CODES = [21919136, 21920443];
const KNOWN_ERRORS: Record<number, string> = {
    21919136: 'Listing has no photo — eBay blocks revisions until a photo is added. Quantity NOT updated.',
    21920443: 'Parts & Accessories return-policy requirement not met — fix the listing\'s return policy. Quantity NOT updated.',
    21916270: 'No SKU-tracked listing has this SKU. Listings created with Item ID tracking (most Trading/Seller Hub listings) can only be found by Item ID.',
    21916619: 'eBay ignored the quantity: this is a multi-variation listing. Send the variation SKU (with the Item ID) instead.',
};
const GET_ITEM_OUTPUT_SELECTORS = [
    'Item.ItemID',
    'Item.SKU',
    'Item.Title',
    'Item.Quantity',
    'Item.SellingStatus',
    'Item.ListingDetails.ViewItemURL',
    'Item.Variations.Variation',
];

export const inventoryCommon = {
    getListingQuantity,
    updateListingQuantity,
    updateListingPrice,
    parseResult,
    hasOnlyKnownListingIssues,
};

export type TradingError = {
    code: number;
    severity: string | null;
    message: string | null;
    known_issue: string | null;
};

export type TradingResult = {
    ack: string;
    errors: TradingError[];
    warnings: TradingError[];
    timestamp: string | null;
};

export type ListingVariation = {
    sku: string | null;
    specifics: string;
    quantity: number | null;
    quantity_sold: number | null;
    quantity_available: number | null;
};

export type ListingDetails = {
    item_id: string | null;
    sku: string | null;
    title: string | null;
    listing_status: string | null;
    view_item_url: string | null;
    has_variations: boolean;
    quantity: number | null;
    quantity_sold: number | null;
    quantity_available: number | null;
    sku_matched: boolean;
    matched_variation: ListingVariation | null;
    matched_quantity_available: number | null;
    variations: ListingVariation[];
};

export type ListingQuantity = TradingResult & {
    found: boolean;
    listing: ListingDetails | null;
};

export type QuantityUpdate = {
    auth: EbayAuthProps;
    itemId?: string;
    sku?: string;
    quantity: number;
    method: 'ReviseInventoryStatus' | 'ReviseItem';
    isVariation: boolean;
};

export type QuantityUpdateResult = TradingResult & {
    call: string;
    updated: boolean;
    quantity_ignored: boolean;
    item_id: string | null;
    sku: string | null;
    requested_quantity: number;
};

export type PriceUpdate = {
    auth: EbayAuthProps;
    itemId?: string;
    sku?: string;
    price: number;
    quantity?: number;
};

export type PriceUpdateResult = TradingResult & {
    call: string;
    updated: boolean;
    item_id: string | null;
    sku: string | null;
    requested_price: number;
    requested_quantity: number | null;
    price_now: number | null;
    quantity_now: number | null;
};
