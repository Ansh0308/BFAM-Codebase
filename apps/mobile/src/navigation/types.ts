import type { NavigatorScreenParams } from '@react-navigation/native';

export type DiscoverStackParamList = {
  TurfListing: undefined;
  TurfDetails: { turfId: string };
  TurfAvailability: { turfId: string; turfName: string; date?: string };
  BookingConfirmation: { bookingId: string };
  PaymentStub: { bookingId: string };
  MyBookings: undefined;
  BookingDetails: { bookingId: string };
  CancelBooking: { bookingId: string };
};

export type RootTabParamList = {
  Home: undefined;
  Discover: NavigatorScreenParams<DiscoverStackParamList> | undefined;
  Matches: undefined;
  Teams: undefined;
  Profile: undefined;
};
