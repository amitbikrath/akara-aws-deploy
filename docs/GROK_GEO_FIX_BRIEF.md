# Brief for Grok: the India / USA shop fix

Date: 2026-11-11

## Your task

Do these 3 steps in this order.

1. Read what we fixed (section "What we fixed").
2. Open the live shop and confirm each fix (section "Checks").
3. Write the reply to the customer (section "Reply to the customer").

Do not write the reply before the checks. If a check fails, stop and report the failure. Do not tell the customer it works.

## The customer message

Paste the customer message here before you send this file to Grok:

> (customer message)

## The problem before today

- Akara has one Shopify store with two markets: India and the United States.
- The shop at https://www.akara.studio/shop showed only the India shelf, with rupee prices, to every visitor.
- A visitor in the USA saw no US prints and no dollar prices.
- Cause: the shop did not tell Shopify which country the visitor was in. The 13 US prints were also not published to the website sales channel.

## What we fixed

| # | Fix | What the visitor sees now |
|---|---|---|
| 1 | The shop tells Shopify the country on every request. | India visitors get the India shelf. USA visitors get the USA shelf. |
| 2 | An India / USA switch with flags is in the top bar. | Any visitor can change the market with one click. The choice is saved on that device. |
| 3 | A visitor whose device clock is in a US time zone gets a question banner. | "Shipping to the United States?" with two buttons: "Switch to USA" and "Stay on India". The shop never switches by itself. |
| 4 | 13 US prints are published to the website. | 7 metal signs, 2 sets of three, 4 posters. They are printed and shipped inside the USA. |
| 5 | USA prices show in whole US dollars. | For example: From $59, $69, $49, $29, $22. |
| 6 | The USA bag is separate from the India bag. | Items from one market do not mix with the other. |
| 7 | The USA bag tells the truth about the charge. | A note says the card is charged in Indian rupees, with the rupee amount. |
| 8 | A direct link opens a market. | `?region=us` opens the USA shop. `?region=in` opens the India shop. |

## Checks

Open each URL. Write PASS or FAIL for each line. Write what you saw.

| # | Open this | Expected |
|---|---|---|
| 1 | https://www.akara.studio/shop?region=us | The top bar switch shows USA selected. Prices start with `$`. The count shows 13 pieces. |
| 2 | https://www.akara.studio/shop?region=us | The shelf has metal signs and posters. It has no mugs and no clothing. |
| 3 | https://www.akara.studio/shop?region=in | The switch shows India selected. Prices start with `₹`. The count shows 32 pieces. |
| 4 | Either URL | The top bar has both flags: 🇮🇳 India and 🇺🇸 USA. |
| 5 | USA shop, add one print to the bag | The bag shows the dollar price and a note that the card is charged in Indian rupees. |

The shop is a JavaScript page. If your tool reads only the raw HTML, you see an empty shell. Then say "could not check" for that line. Do not guess.

## Known limits (be honest with the customer)

- The USA checkout charges the card in Indian rupees. The dollar price is a display value: rupees ÷ 93.93, rounded. The bank of the customer does the final conversion, so the charged dollar amount can differ a little.
- The USA shelf has prints only (metal signs and posters). Mugs and clothing ship in India only.
- The A3 and 8×11 posters show as separate products on the USA shelf.

## Reply to the customer

Write the reply only after checks 1 to 4 pass.

Rules:

- Put the link on the first line: https://www.akara.studio/shop?region=us
- Maximum 4 short sentences. Plain words. Warm, not salesy.
- Say what is fixed: the USA shop is open, prices are in dollars, prints ship inside the USA.
- Say the one honest limit: the card is charged in Indian rupees at checkout.
- Thank the customer for the report. Their message started this fix.
- Sign as "Akara". Do not name any person.
- No emoji except one 🙏 at the end, if it fits.
- Do not promise a delivery date, a discount, or a product that is not on the shelf.

## Answer format

1. The check table with PASS / FAIL / could not check.
2. One line: "All checks passed" or the list of failures.
3. The customer reply, ready to copy. Leave this out if a check failed.
