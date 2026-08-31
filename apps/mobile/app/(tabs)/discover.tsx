import React from 'react';
import { ComingSoonScreen } from '../../src/components/ComingSoonScreen';

// Turf Discovery & Booking is Module 2.3 (being built separately) — this
// tab only needs to exist as a real nav destination for now.
export default function Discover() {
  return (
    <ComingSoonScreen
      title="Discover"
      icon="compass"
      note="Turf discovery is coming in Module 2.3."
    />
  );
}
