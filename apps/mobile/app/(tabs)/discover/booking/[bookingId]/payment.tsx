import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Platform, Text, TextInput, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import type { PaymentObligation } from '@bfam/shared-types';
import { BFAMApiError } from '@bfam/api-client';
import { apiClient } from '../../../../../src/lib/apiClient';
import { colors } from '../../../../../src/theme/tokens';
import { ScreenContainer } from '../../../../../src/components/ScreenContainer';
import { Button } from '../../../../../src/components/Button';
import { TextField } from '../../../../../src/components/TextField';

// Payment method selector (PRD §12.16 / §17): UPI and Payment Gateway both
// route through the same Razorpay order + Checkout flow (Razorpay's own
// checkout screen presents UPI as one of its payment tabs) — only the
// `payment_method` tag differs, for reconciliation. Cash settles
// immediately. Captain Pays / Split Payment are obligation *structures*
// (who owes what), not settlement instruments — picking either here just
// sets up the obligations, then this screen still needs an instrument
// (UPI/Gateway/Cash) to actually settle them.
type SelectorMethod = 'UPI' | 'RAZORPAY' | 'CASH' | 'CAPTAIN_PAYS' | 'SPLIT';

const METHODS: { key: SelectorMethod; label: string }[] = [
  { key: 'UPI', label: 'UPI' },
  { key: 'RAZORPAY', label: 'Payment Gateway' },
  { key: 'CASH', label: 'Cash' },
  { key: 'CAPTAIN_PAYS', label: 'Captain Pays' },
  { key: 'SPLIT', label: 'Split Payment' },
];

type Stage =
  | 'loading'
  | 'select-method'
  | 'split-setup'
  | 'cash-entry'
  | 'processing'
  | 'confirming'
  | 'done'
  | 'error';

export default function PaymentScreen() {
  const { bookingId } = useLocalSearchParams<{ bookingId: string }>();
  const router = useRouter();

  const [stage, setStage] = useState<Stage>('loading');
  const [obligations, setObligations] = useState<PaymentObligation[]>([]);
  const [method, setMethod] = useState<SelectorMethod | null>(null);
  const [shareCount, setShareCount] = useState('2');
  const [cashReference, setCashReference] = useState('');
  const [error, setError] = useState<string | null>(null);
  // Set once a split is created — this screen only ever settles the
  // booker's own share (obligations[0] by construction below); the
  // remaining N-1 shares stay PENDING for other players to pay later
  // (module 2.6 wires real players to the rest of the shares via the
  // same obligations endpoint).
  const [mySplitShareId, setMySplitShareId] = useState<string | null>(null);
  // Backlog B-1: promo code / BFAM Coins applied to the payer's own
  // obligation before choosing a payment method — the discount is applied
  // server-side (payment_obligations.amount_due is reduced directly), so
  // every method below just settles whatever amount_due already reflects.
  const [promoCodeInput, setPromoCodeInput] = useState('');
  const [coinsToRedeemInput, setCoinsToRedeemInput] = useState('');
  const [coinBalance, setCoinBalance] = useState<number | null>(null);
  const [discountBusy, setDiscountBusy] = useState(false);
  const [discountError, setDiscountError] = useState<string | null>(null);
  const [discountApplied, setDiscountApplied] = useState(false);

  const loadObligations = useCallback(async () => {
    const { results } = await apiClient.getObligations(bookingId);
    setObligations(results);
    return results;
  }, [bookingId]);

  useEffect(() => {
    loadObligations()
      .then((results) => setStage(results.length > 0 ? 'select-method' : 'select-method'))
      .catch(() => setError('Could not load payment details for this booking.'));
    apiClient
      .getMyProfile()
      .then((profile) => setCoinBalance(profile.coin_balance))
      .catch(() => {
        // TURF_OWNER/TURF_STAFF booking on behalf of players (or any
        // profile-load hiccup) — just hide the coins option rather than
        // blocking payment on it.
      });
  }, [loadObligations]);

  const myUnpaidObligations = (
    mySplitShareId ? obligations.filter((o) => o.obligation_id === mySplitShareId) : obligations
  ).filter((o) => o.due_status !== 'PAID');

  // Backlog B-1: applies to the first (only, in the common non-split case)
  // unpaid obligation this payer owes — reduces its amount_due server-side,
  // then reloads so every total shown below already reflects the discount.
  async function applyDiscount() {
    const target = myUnpaidObligations[0];
    if (!target) return;
    setDiscountBusy(true);
    setDiscountError(null);
    try {
      const result = await apiClient.applyCheckoutDiscount(target.obligation_id, {
        promo_code: promoCodeInput.trim() || undefined,
        coins_to_redeem: coinsToRedeemInput ? Number(coinsToRedeemInput) : undefined,
      });
      setCoinBalance(result.coin_balance);
      setDiscountApplied(true);
      await loadObligations();
    } catch (err) {
      setDiscountError(
        err instanceof BFAMApiError ? err.message : 'Could not apply that discount.',
      );
    } finally {
      setDiscountBusy(false);
    }
  }

  async function ensureSingleObligation(): Promise<PaymentObligation[]> {
    if (obligations.length > 0) return obligations;
    const { results } = await apiClient.createObligations(bookingId);
    setObligations(results);
    return results;
  }

  async function handleSelect(selected: SelectorMethod) {
    setError(null);
    setMethod(selected);

    if (selected === 'SPLIT') {
      if (obligations.length > 0) {
        setStage('select-method');
        return;
      }
      setStage('split-setup');
      return;
    }

    // UPI / Payment Gateway / Cash / Captain Pays all settle the existing
    // (or newly-created single) obligation(s) via a real instrument.
    try {
      const current = await ensureSingleObligation();
      const scoped = mySplitShareId
        ? current.filter((o) => o.obligation_id === mySplitShareId)
        : current;
      const unpaid = scoped.filter((o) => o.due_status !== 'PAID');
      if (unpaid.length === 0) {
        setStage('done');
        return;
      }
      if (selected === 'CASH') {
        setStage('cash-entry');
      } else {
        await payViaGateway(unpaid, selected === 'CAPTAIN_PAYS' ? 'RAZORPAY' : selected);
      }
    } catch {
      setError('Something went wrong setting up this payment. Please try again.');
      setStage('select-method');
    }
  }

  async function submitSplitSetup() {
    const count = Number(shareCount);
    if (!Number.isInteger(count) || count < 2 || count > 20) {
      setError('Enter a whole number of players between 2 and 20.');
      return;
    }
    setError(null);
    try {
      // Module 2.4 exposes an even N-way split here; splitting by an actual
      // match/team roster is module 2.6's job, calling into this same
      // obligations endpoint with real player_ids instead — so every share
      // here has player_id: null (we don't know who the other N-1 payers
      // are yet, only a count).
      const booking = await apiClient.getBookingDetails(bookingId);
      const total = Number(booking.booking_amount);
      // Split evenly to the paisa, putting the rounding remainder on the
      // last share so the shares sum to exactly `total` (the backend
      // rejects shares whose sum doesn't match the booking amount).
      const baseShare = Math.floor((total / count) * 100) / 100;
      const shares = Array.from({ length: count }, (_, i) => ({
        player_id: null,
        amount: i < count - 1 ? baseShare : Number((total - baseShare * (count - 1)).toFixed(2)),
      }));

      const { results } = await apiClient.createObligations(bookingId, { shares });
      setObligations(results);
      // The booker settles their own share now; the rest stay PENDING for
      // other players to pay later (this module's "partial collection"
      // requirement).
      setMySplitShareId(results[0]?.obligation_id ?? null);
      setStage('select-method');
    } catch (err) {
      if (err instanceof BFAMApiError) setError(err.message);
      else setError('Could not set up the split. Please try again.');
    }
  }

  async function payViaGateway(unpaid: PaymentObligation[], paymentMethod: 'UPI' | 'RAZORPAY') {
    setStage('processing');
    try {
      const order = await apiClient.initiateGatewayPayment(
        unpaid.map((o) => o.obligation_id),
        paymentMethod,
      );

      if (Platform.OS === 'web') {
        setError(
          'Gateway payment requires the native app (Razorpay Checkout has no web SDK in this preview).',
        );
        setStage('select-method');
        return;
      }

      // Loaded lazily so the web preview bundle never touches this
      // native-only module.
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const RazorpayCheckout = require('react-native-razorpay').default;
      await RazorpayCheckout.open({
        key: order.key_id,
        order_id: order.order_id,
        amount: Math.round(order.amount * 100),
        currency: order.currency,
        name: 'BFAM',
        description: 'Turf booking payment',
        theme: { color: '#D80000' },
      });

      await waitForConfirmation();
    } catch (err) {
      const description = (err as { description?: string })?.description;
      setError(description ?? 'Payment was not completed.');
      setStage('select-method');
    }
  }

  async function waitForConfirmation() {
    setStage('confirming');
    for (let attempt = 0; attempt < 6; attempt += 1) {
      await new Promise((resolve) => setTimeout(resolve, 1500));
      const results = await loadObligations();
      if (results.every((o) => o.due_status === 'PAID')) {
        setStage('done');
        return;
      }
    }
    // Webhook confirmation can lag briefly — the payment isn't lost, just
    // not yet reflected. Payment History will show it once the webhook
    // lands.
    setStage('done');
  }

  async function submitCashPayment() {
    setStage('processing');
    setError(null);
    try {
      await apiClient.recordCashPayment(
        myUnpaidObligations.map((o) => o.obligation_id),
        cashReference || undefined,
      );
      await loadObligations();
      setStage('done');
    } catch (err) {
      if (err instanceof BFAMApiError) setError(err.message);
      else setError('Could not record this cash payment.');
      setStage('cash-entry');
    }
  }

  if (stage === 'loading') {
    return (
      <ScreenContainer>
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color={colors.brandRed} testID="payment-loading" />
        </View>
      </ScreenContainer>
    );
  }

  if (stage === 'done') {
    return (
      <ScreenContainer>
        <View className="flex-1 items-center justify-center" testID="payment-done">
          <Text className="font-ui font-bold text-title-xl text-ink-black text-center">
            Payment Recorded
          </Text>
          <Text className="font-ui text-body text-text-secondary text-center mt-3">
            {obligations.every((o) => o.due_status === 'PAID')
              ? 'This booking is fully paid.'
              : "We're confirming your payment — it'll reflect shortly in Payment History."}
          </Text>
          <View className="mt-8 w-full">
            <Button
              label="Create Match"
              onPress={() => router.push(`/(tabs)/matches/create?bookingId=${bookingId}`)}
              testID="payment-done-create-match"
            />
          </View>
          <View className="mt-3 w-full">
            <Button
              label="View My Bookings"
              variant="secondary"
              onPress={() => router.push('/(tabs)/discover/my-bookings')}
              testID="payment-done-my-bookings"
            />
          </View>
          <View className="mt-3 w-full">
            <Button
              label="Payment History"
              variant="ghost"
              onPress={() => router.push('/(tabs)/discover/payment-history')}
            />
          </View>
        </View>
      </ScreenContainer>
    );
  }

  if (stage === 'split-setup') {
    return (
      <ScreenContainer>
        <View className="pt-6" testID="split-setup-screen">
          <Text className="font-ui font-bold text-title-xl text-ink-black">Split Payment</Text>
          <Text className="font-ui text-body text-text-secondary mt-2">
            How many players are splitting this booking?
          </Text>
          <TextInput
            value={shareCount}
            onChangeText={setShareCount}
            keyboardType="number-pad"
            className="bg-surface-alt border border-border-strong rounded-md px-4 py-3 mt-4 font-ui text-body text-text-primary"
            testID="split-share-count-input"
          />
          {error && <Text className="text-brand-red text-body mt-3">{error}</Text>}
          <View className="mt-6">
            <Button label="Create Split" onPress={submitSplitSetup} testID="submit-split-setup" />
          </View>
        </View>
      </ScreenContainer>
    );
  }

  if (stage === 'cash-entry') {
    return (
      <ScreenContainer>
        <View className="pt-6" testID="cash-entry-screen">
          <Text className="font-ui font-bold text-title-xl text-ink-black">Cash Payment</Text>
          <Text className="font-ui text-body text-text-secondary mt-2">
            Recorded as collected by you, effective immediately.
          </Text>
          <TextInput
            value={cashReference}
            onChangeText={setCashReference}
            placeholder="Reference (optional)"
            placeholderTextColor={colors.textTertiary}
            className="bg-surface-alt border border-border-strong rounded-md px-4 py-3 mt-4 font-ui text-body text-text-primary"
            testID="cash-reference-input"
          />
          {error && <Text className="text-brand-red text-body mt-3">{error}</Text>}
          <View className="mt-6">
            <Button
              label="Confirm Cash Payment"
              onPress={submitCashPayment}
              testID="confirm-cash-payment"
            />
          </View>
        </View>
      </ScreenContainer>
    );
  }

  if (stage === 'processing' || stage === 'confirming') {
    return (
      <ScreenContainer>
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color={colors.brandRed} testID="payment-processing" />
          <Text className="font-ui text-body text-text-secondary text-center mt-4">
            {stage === 'processing' ? 'Processing your payment…' : 'Confirming with the bank…'}
          </Text>
        </View>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer>
      <View className="pt-6" testID="payment-method-selector">
        <Text className="font-ui font-bold text-title-xl text-ink-black">Payment</Text>
        <Text className="font-ui text-body text-text-secondary mt-2">
          Choose how you&apos;d like to pay.
        </Text>

        {myUnpaidObligations.length > 0 && (
          <Text className="font-ui text-button text-text-primary mt-3" testID="payment-amount-due">
            ₹{myUnpaidObligations.reduce((sum, o) => sum + Number(o.amount_due), 0)} due
          </Text>
        )}
        {mySplitShareId && obligations.length > 1 && (
          <Text className="font-ui text-micro text-text-tertiary mt-1">
            Split {obligations.length} ways — this is your share. The other {obligations.length - 1}{' '}
            {obligations.length - 1 === 1 ? 'share' : 'shares'} remain
            {obligations.length - 1 === 1 ? 's' : ''} pending for others to pay.
          </Text>
        )}

        {error && (
          <Text className="text-brand-red text-body mt-3" testID="payment-error-message">
            {error}
          </Text>
        )}

        {/* Backlog B-1: promo code / BFAM Coins, applied before picking a
            payment method — reduces the amount shown above. Hidden once
            applied so it isn't accidentally re-submitted (a promo code may
            be one-use-per-player, and re-applying coins would spend more
            than intended). */}
        {myUnpaidObligations.length > 0 && !discountApplied && (
          <View
            className="mt-5 pt-5 border-t border-border-subtle"
            testID="checkout-discount-section"
          >
            <Text className="font-ui font-bold text-text-secondary text-micro uppercase mb-2">
              Promo Code &amp; BFAM Coins
            </Text>
            <TextField
              label="Promo Code"
              value={promoCodeInput}
              onChangeText={setPromoCodeInput}
              placeholder="e.g. SAVE10"
              autoCapitalize="characters"
              testID="promo-code-input"
            />
            {coinBalance != null && coinBalance > 0 && (
              <TextField
                label={`Use BFAM Coins (you have ${coinBalance})`}
                value={coinsToRedeemInput}
                onChangeText={setCoinsToRedeemInput}
                placeholder="0"
                keyboardType="number-pad"
                testID="coins-to-redeem-input"
              />
            )}
            {discountError && (
              <Text className="text-brand-red text-body mb-2" testID="discount-error-message">
                {discountError}
              </Text>
            )}
            <Button
              label="Apply"
              variant="secondary"
              onPress={applyDiscount}
              loading={discountBusy}
              disabled={!promoCodeInput.trim() && !coinsToRedeemInput}
              testID="apply-discount-button"
            />
          </View>
        )}
        {discountApplied && (
          <Text
            className="font-ui text-micro text-text-tertiary mt-3"
            testID="discount-applied-note"
          >
            Discount applied.
          </Text>
        )}

        <View className="mt-6">
          {METHODS.map((m) => (
            <View key={m.key} className="mb-3">
              <Button
                label={m.label}
                variant={method === m.key ? 'primary' : 'secondary'}
                onPress={() => handleSelect(m.key)}
                testID={`payment-method-${m.key}`}
              />
            </View>
          ))}
        </View>
      </View>
    </ScreenContainer>
  );
}
