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

### Location search
If you search for a location by name (`location <name>`), the search term is sent to **geocoding-api.open-meteo.com** to resolve it to coordinates.

### AI chat (optional, opt-in)
If you configure an AI provider in the AI tab, messages you send with `ai <message>` are sent **directly from your browser to the provider you chose** — NK_Terminal has no server in between:
- **Gemini** — generativelanguage.googleapis.com (Google)
- **OpenAI** — api.openai.com
- **Anthropic** — api.anthropic.com
- **Custom** — any OpenAI-compatible endpoint you enter yourself (e.g. a local Ollama/LM Studio server); the extension asks your permission for that specific address the first time you use it

This feature is entirely optional and inactive until you pick a provider and enter an API key. Your API key and chat messages are governed by that provider's own privacy policy once sent.

## Data Storage

All data is stored **locally** in your browser's `chrome.storage.local`:
- Quick links (labels and URLs you add)
- Cached location coordinates (IP geolocation result, stored for up to 1 hour)
- Cached weather data (stored for up to 30 minutes)
- Manually set location (if you use the `location` command)
- Notes, tasks and agenda entries you create
- Your class schedule (course dates, weekly classes and holidays) if you configure the Horario panel
- AI provider/model settings and, if you enter one, your API key — **stored locally only, never synced or sent anywhere except to the provider you configured**

No data is sent to any server operated by the extension developer — NK_Terminal has no server at all.

## Permissions Justification

- **storage**: Saves your quick links, widgets, settings and cached location/weather locally.
- **tabs / webNavigation**: Redirects the browser's new tab page to the terminal.
- **system.memory / system.cpu / system.storage**: Displays system information on the terminal.
- **Host permissions** (`wttr.in`, `ip-api.com`, `ipapi.co`, `ipinfo.io`, `geocoding-api.open-meteo.com`, and the Gemini/OpenAI/Anthropic API hosts): Fetches weather, geolocation and — only if you configure it — AI chat responses.
- **Optional host permission** (`*://*/*`, requested at runtime, not granted upfront): Only used if you set a **custom** AI endpoint, and only for that specific address, so the extension can reach a local/self-hosted model server.

## Changes to This Policy

If this policy changes, the version number in the extension manifest will be updated and the policy will be reviewed on the Chrome Web Store listing.

## Contact

For questions about this privacy policy, open an issue on the extension's repository or contact the developer through the Chrome Web Store listing.
