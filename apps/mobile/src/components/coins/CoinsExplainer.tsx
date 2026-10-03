import React from 'react';
import { Text, View } from 'react-native';
import { HubCard, IconBadge, type IconName } from '../hub/HubParts';

// What BFAM Coins are, how a player gets them and what they can do with them. The numbers
// mirror the backend rules - keep them in step if those change:
//   20 coins per match review      apps/backend/src/services/reviewService.ts  COIN_REWARD_PER_REVIEW
//   100 coins per qualified friend apps/backend/src/services/referralService.ts REFERRAL_REWARD_COINS
//   1 coin = Rs 1 at checkout      apps/backend/src/domain/checkout.ts          COIN_VALUE_IN_RUPEES
export const COIN_REVIEW_REWARD = 20;
export const COIN_REFERRAL_REWARD = 100;

interface Row {
  icon: IconName;
  title: string;
  body: string;
  badge?: string;
}

const EARN: Row[] = [
  {
    icon: 'star-circle',
    title: 'Review a match you played',
    body: 'Once the match has finished, rate it from the match page. One review per match.',
    badge: `+${COIN_REVIEW_REWARD}`,
  },
  {
    icon: 'account-group',
    title: 'Refer a friend',
    body: 'Your friend signs up with your referral code. When they finish their first match, the coins land in your balance.',
    badge: `+${COIN_REFERRAL_REWARD}`,
  },
];

const SPEND: Row[] = [
  {
    icon: 'ticket-percent',
    title: 'Pay less for a turf booking',
    body: 'Apply coins at checkout: 1 coin takes ₹1 off. It stacks with a promo code and never takes the price below ₹0.',
  },
  {
    icon: 'gift',
    title: 'Redeem rewards',
    body: 'Swap coins for items from the Rewards list. The turf hands it over once your request is approved.',
  },
  {
    icon: 'card-account-details',
    title: 'Buy a membership',
    body: 'Pay for a membership plan with coins and get a discount on bookings while it is active.',
  },
];

function RowItem({ row, last }: { row: Row; last: boolean }) {
  return (
    <View
      className="flex-row items-start"
      style={{ paddingVertical: 10, borderBottomWidth: last ? 0 : 1, borderBottomColor: '#F1F1F1' }}
    >
      <IconBadge icon={row.icon} size={36} />
      <View className="flex-1" style={{ marginLeft: 12 }}>
        <View className="flex-row items-center justify-between">
          <Text className="font-ui font-bold text-ink-black flex-1" style={{ fontSize: 14 }}>
            {row.title}
          </Text>
          {row.badge ? (
            <Text className="font-ui font-bold text-brand-red" style={{ fontSize: 14 }}>
              {row.badge}
            </Text>
          ) : null}
        </View>
        <Text className="font-ui text-text-secondary" style={{ fontSize: 12.5, marginTop: 2 }}>
          {row.body}
        </Text>
      </View>
    </View>
  );
}

function Group({ label, rows }: { label: string; rows: Row[] }) {
  return (
    <HubCard>
      <Text
        className="font-ui font-bold text-brand-red"
        style={{ fontSize: 11, letterSpacing: 1, marginBottom: 2 }}
      >
        {label}
      </Text>
      {rows.map((r, i) => (
        <RowItem key={r.title} row={r} last={i === rows.length - 1} />
      ))}
    </HubCard>
  );
}

export function CoinsExplainer({ testID }: { testID?: string }) {
  return (
    <View testID={testID}>
      <HubCard>
        <View className="flex-row items-center">
          <IconBadge icon="trophy" size={44} tone="solid" />
          <Text
            className="font-ui font-bold text-ink-black flex-1"
            style={{ fontSize: 17, marginLeft: 12 }}
          >
            What are BFAM Coins?
          </Text>
        </View>
        <Text className="font-ui text-text-secondary" style={{ fontSize: 13, marginTop: 10 }}>
          BFAM Coins are our thank-you for playing and bringing friends. The number beside the
          trophy at the top of Home is your balance. 1 coin is worth ₹1 when you book a turf.
        </Text>
        <Text className="font-ui text-text-tertiary" style={{ fontSize: 12, marginTop: 8 }}>
          Level &amp; XP is separate: XP only builds your level, it can't be spent.
        </Text>
      </HubCard>
      <Group label="HOW YOU EARN THEM" rows={EARN} />
      <Group label="WHAT YOU CAN DO WITH THEM" rows={SPEND} />
    </View>
  );
}
