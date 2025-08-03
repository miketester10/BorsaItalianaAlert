import { config } from "dotenv";
config();

export const API = {
  BORSA_ITALIANA: process.env.BORSA_ITALIANA_API!,
  BORSA_ITALIANA_TAIL: process.env.BORSA_ITALIANA_API_TAIL!,
};
