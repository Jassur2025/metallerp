/**
 * Fixed Assets Atomic Service — calls Cloud Functions for server-side operations
 */

import { httpsCallable } from 'firebase/functions';
import { functions } from '../lib/firebase';

interface RunDepreciationResult {
  depreciated: number;
  totalDepreciation: number;
  monthKey?: string;
  message: string;
}

interface DeleteFixedAssetResult {
  success: boolean;
  assetId: string;
}

interface PurchaseFixedAssetInput {
  name: string;
  category: string;
  purchaseDate: string;
  purchaseCost: number;
  amountPaid: number;
  paymentMethod: 'cash' | 'bank' | 'card';
  paymentCurrency: 'USD' | 'UZS';
  exchangeRate: number;
  depreciationRate: number;
}

interface PurchaseFixedAssetResult {
  assetId: string;
  transactionId: string | null;
  purchaseCost: number;
  amountPaid: number;
}

const runDepreciationCF = httpsCallable<Record<string, never>, RunDepreciationResult>(
  functions,
  'runDepreciation'
);

const deleteFixedAssetCF = httpsCallable<{ assetId: string }, DeleteFixedAssetResult>(
  functions,
  'deleteFixedAsset'
);

const purchaseFixedAssetCF = httpsCallable<PurchaseFixedAssetInput, PurchaseFixedAssetResult>(
  functions,
  'purchaseFixedAsset'
);

export const fixedAssetsAtomicService = {
  /**
   * Run monthly depreciation for all fixed assets.
   * Server-side: updates assets + creates ledger entries + journal event.
   * Idempotent per month (safe to call multiple times).
   */
  async runDepreciation(): Promise<RunDepreciationResult> {
    const { data } = await runDepreciationCF({});
    return data;
  },

  /**
   * Soft-delete a fixed asset.
   * Server-side: marks asset as deleted + derecognition ledger + journal event.
   */
  async deleteFixedAsset(assetId: string): Promise<DeleteFixedAssetResult> {
    const { data } = await deleteFixedAssetCF({ assetId });
    return data;
  },

  /**
   * Purchase a new fixed asset.
   * Server-side: creates asset + transaction + ledger entries + journal event.
   */
  async purchaseFixedAsset(input: PurchaseFixedAssetInput): Promise<PurchaseFixedAssetResult> {
    const { data } = await purchaseFixedAssetCF(input);
    return data;
  },
};
