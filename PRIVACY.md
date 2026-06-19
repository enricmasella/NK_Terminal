# Privacy Policy for NK_Terminal

**Last updated:** June 11, 2026

NK_Terminal does not collect, store, or transmit any personal information beyond what is described below.

## Data Collected by Third-Party Services

NK_Terminal makes the following network requests to provide its functionality:

### IP Geolocation
When the extension needs to determine your approximate location for weather data, it sends your **IP address** to one of the following services (whichever responds first):
- **ip-api.com** — https://ip-api.com/docs/
- **ipapi.co** — https://ipapi.co/api/
- **ipinfo.io** — https://ipinfo.io/

These services return your approximate latitude, longitude, and city name. No identifying information beyond your IP address is sent. NK_Terminal does not store this data on its own servers — it only caches the result locally in your browser's `chrome.storage.local` for up to 1 hour to avoid repeated requests.

### Weather Data
Once your location is determined (or if you set it manually), the extension sends your **latitude and longitude** to:
- **wttr.in** — https://wttr.in/

wttr.in returns weather forecast data. No personal information is included in this request.

## Data Storage

All data is stored **locally** in your browser's `chrome.storage.local`:
- Quick links (labels and URLs you add)
- Cached location coordinates (IP geolocation result, stored for up to 1 hour)
- Cached weather data (stored for up to 30 minutes)
- Manually set location (if you use the `location` command)

No data is sent to any server operated by the extension developer.

## Permissions Justification

- **storage**: Saves your quick links and cached location/weather locally.
- **tabs / webNavigation**: Redirects the browser's new tab page to the terminal.
- **system.memory / system.cpu / system.storage**: Displays system information on the terminal.
- **Host permissions** (`wttr.in`, `ip-api.com`, `ipapi.co`, `ipinfo.io`): Fetches weather and geolocation data as described above.

## Changes to This Policy

If this policy changes, the version number in the extension manifest will be updated and the policy will be reviewed on the Chrome Web Store listing.

## Contact

For questions about this privacy policy, open an issue on the extension's repository or contact the developer through the Chrome Web Store listing.
