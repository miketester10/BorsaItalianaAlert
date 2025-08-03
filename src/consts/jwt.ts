import { config } from "dotenv";
config();

export const JWT = {
  BORSA_ITALIANA: process.env.BORSA_ITALIANA_JWT,
};
