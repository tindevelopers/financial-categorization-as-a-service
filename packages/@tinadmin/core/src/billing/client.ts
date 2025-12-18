"use client";

import { loadStripe, Stripe as StripeType } from "@stripe/stripe-js";
import { stripeConfig } from "./config";

let stripePromise: Promise<StripeType | null>;

export const getStripe = () => {
  if (!stripePromise) {
    stripePromise = loadStripe(stripeConfig.publishableKey);
  }
  return stripePromise;
};

