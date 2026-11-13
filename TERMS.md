# MSK Terms of Service

**Effective date:** November 12, 2026

These terms cover **MSK** (also called **MeeshySK**): the MSK desktop app ([msk-desktop](https://github.com/meeshyweeshy/msk-desktop)), the MSK browser extension ([msk-extension](https://github.com/meeshyweeshy/msk-extension)), and their source code, releases, files and updates (together, "MSK"). MSK is made by **meeshy** ("I", "me", "my").

**By downloading, installing, building or using MSK, you agree to these terms. If you don't agree, don't use MSK.**

---

## 1. What MSK is

MSK is a free, cosmetic customization tool for TradingView charts. With it you can:

- put your own photos, GIFs or videos behind (or over) your TradingView chart
- set a solid color or gradient behind the chart
- change candle, wick, grid, text and crosshair colors
- animate those settings (pulse, flash, rainbow and more)
- save looks as configs and share them as `.msk` files

How it works:

- **Desktop app (Windows and macOS):** MSK starts TradingView Desktop with Chromium's remote debugging switch, limited to your own computer (`127.0.0.1`), and adds MSK's display code to the chart window.
- **Browser extension (Chrome, Brave, Edge and other Chromium browsers):** MSK runs on tradingview.com and adds a display layer to the page.

MSK only changes how charts look on your screen. It does not place, change or read orders. It doesn't connect to your broker, doesn't read your positions or balances, and doesn't need an account.

## 2. Not affiliated with anyone

MSK is an independent project. It is **not affiliated with, endorsed by or sponsored by TradingView, Inc.**, any broker or exchange, or any other chart-customization product. "TradingView" is a trademark of TradingView, Inc. Other product names belong to their owners and are used only to describe compatibility.

## 3. Not financial advice

**Nothing in MSK is financial, investment or trading advice.** MSK is a visual tool only.

Backgrounds, colors, animations and transparency can make prices, candles, levels or labels harder to see. They can also show the wrong colors or stop working without warning. Always check prices and chart information yourself before you act.

Trading futures, stocks, options, crypto, forex or anything else carries a real risk of losing money. **You alone are responsible for your trading decisions and their results.**

## 4. Risks you accept

- **TradingView's rules.** Using MSK with TradingView is your choice. You're responsible for following TradingView's Terms of Use and the terms of any broker or platform you use. TradingView can change its app or website at any time, and MSK may break when it does. Anything between you and TradingView about your account is between you and TradingView.
- **The debug port (desktop app).** While TradingView runs with MSK, its debug port is open on your computer. Other software on the same computer could use that port to control TradingView. The port closes when TradingView closes. Only use MSK on a computer you trust.
- **Unsigned software.** MSK isn't code-signed by Microsoft or notarized by Apple, so Windows and macOS will show warnings. Only download MSK from the official GitHub repositories linked above. Copies from anywhere else could be changed or harmful.
- **Your computer and data.** Back up anything important. Some features do exactly what they say: **Kill all related processes** closes TradingView, and **Reset MSK** deletes your media and configs.

## 5. Your media and content

- Anything you load into MSK (photos, videos, GIFs, configs) is your content. **You must own it or have permission to use it.**
- MSK doesn't upload your media anywhere. It stays on your computer (desktop app) or in your browser profile (extension).
- `.msk` config files include the media inside them. Only share configs whose media you have the right to share. You're responsible for anything you share.
- Don't use MSK to show anything illegal or anything that infringes someone else's rights.

## 6. Privacy

- No account, no sign-in, no analytics, no ads, no tracking.
- Your settings, configs, media and logs are stored on your own device.
- To check for updates, MSK downloads a public file from GitHub (`api.github.com` for the desktop app, `raw.githubusercontent.com` for the extension). Like any website, GitHub can see your IP address when this happens, and GitHub's privacy policy applies. You can turn automatic update checks off in Settings.
- Logs stay on your device unless you choose to share them.

## 7. Ownership and license

- MSK, including its code, design, logo, the pixel "meeshy" wordmark and the MSK and MeeshySK names, is © 2026 meeshy. All rights not expressly granted here are reserved.
- I give you a free, personal, non-exclusive, revocable license to download, install and use MSK, and to read and change the source code for your own personal use.
- Without my written permission, you may not sell MSK, redistribute it (changed or unchanged) under the MSK name or as your own, or remove these terms or copyright notices.
- If a repository later includes a `LICENSE` file, that file controls how the code in that repository may be used.
- Third-party parts keep their own licenses: Electron (MIT) and Chromium (license files ship with the app), ws (MIT), and the Sora and Manrope fonts (SIL Open Font License 1.1, included in the `fonts` folder).

## 8. No warranty

MSK IS PROVIDED **"AS IS" AND "AS AVAILABLE," WITH ALL FAULTS AND WITHOUT WARRANTY OF ANY KIND.** TO THE FULLEST EXTENT PERMITTED BY LAW, I DISCLAIM ALL WARRANTIES, EXPRESS OR IMPLIED, INCLUDING WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, TITLE, NON-INFRINGEMENT AND ACCURACY, AND ANY WARRANTY THAT MSK WILL BE UNINTERRUPTED, SECURE, ERROR-FREE, OR COMPATIBLE WITH TRADINGVIEW OR ANY OTHER SOFTWARE.

## 9. Limitation of liability

TO THE FULLEST EXTENT PERMITTED BY LAW, **MEESHY AND ANYONE WHO CONTRIBUTES TO MSK WILL NOT BE LIABLE FOR ANY DAMAGES OR LOSSES OF ANY KIND** ARISING OUT OF OR RELATED TO MSK OR THESE TERMS, INCLUDING:

- trading or investment losses, missed trades, lost profits, or any decision made while using MSK
- loss or corruption of data, media, configs or TradingView layouts
- damage to your computer, operating system, browser or other software
- suspension, restriction or termination of your TradingView account or any other account
- security incidents, including misuse of the debug port by other software
- any direct, indirect, incidental, special, consequential, exemplary or punitive damages

THIS APPLIES WHETHER THE CLAIM IS BASED ON CONTRACT, TORT (INCLUDING NEGLIGENCE), STRICT LIABILITY OR ANY OTHER THEORY, EVEN IF I WAS TOLD THE DAMAGE WAS POSSIBLE.

MSK is free. If any liability can't be excluded, my total liability is limited to the amount you paid me for MSK, which is zero. Where the law doesn't allow some of these limits, they apply to the greatest extent the law does allow.

## 10. Indemnity

You agree to defend, indemnify and hold harmless meeshy and MSK contributors from any claims, damages, losses and costs (including reasonable attorneys' fees) that come from your use of MSK, your content (including media and shared `.msk` files), your trading, or your breaking these terms or anyone else's rights or terms (including TradingView's).

## 11. Changes, support and ending

- MSK may change, break or be discontinued at any time without notice. I have no obligation to provide support, fixes or updates.
- I may update these terms. The current version is always `TERMS.md` in the GitHub repositories, with the effective date at the top. Using MSK after a change means you accept the new terms.
- You can stop at any time by uninstalling MSK. These terms end automatically if you break them.
- Sections 3, 5 and 7 through 12 keep applying after you stop using MSK.

## 12. General

- If any part of these terms can't be enforced, it's limited to the minimum needed and the rest stays in effect.
- These terms are the whole agreement between you and me about MSK.
- If I don't enforce part of these terms, that doesn't mean I've waived it.
- If you're under the age of majority where you live, only use MSK with a parent or guardian who has read and agreed to these terms.

## 13. Contact

Questions or problems? Open an issue on the GitHub repository for the [desktop app](https://github.com/meeshyweeshy/msk-desktop/issues) or the [extension](https://github.com/meeshyweeshy/msk-extension/issues).
